package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/restore"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusSuccess   TaskStatus = "success"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusRetrying  TaskStatus = "retrying"
)

type TaskType string

const (
	TaskTypeBackup  TaskType = "backup"
	TaskTypeRestore TaskType = "restore"
)

type Task struct {
	ID          uint       `json:"id"`
	Type        TaskType   `json:"type"`
	Status      TaskStatus `json:"status"`
	RetryCount  int       `json:"retry_count"`
	MaxRetries  int       `json:"max_retries"`
	ErrorMsg    string     `json:"error_msg,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type TaskPayload struct {
	Type         TaskType            `json:"type"`
	TaskID       uint               `json:"task_id"`
	WorkspaceID  uint               `json:"workspace_id"`
	DatabaseID   uint               `json:"database_id"`
	DatabaseType string             `json:"database_type"`
	BackupType   string             `json:"backup_type,omitempty"`
	BackupID     uint               `json:"backup_id,omitempty"`
	PITRTime    *time.Time         `json:"pitr_time,omitempty"`
	Config      map[string]any     `json:"config,omitempty"`
}

type Scheduler struct {
	db            *gorm.DB
	redisClient   *redis.Client
	taskQueue     chan TaskPayload
	wg            sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc
	maxRetries    int
	retryInterval time.Duration
	storagePath   string
}

var (
	schedulerInstance *Scheduler
	schedulerOnce     sync.Once
)

func NewScheduler(db *gorm.DB, redisClient *redis.Client, storagePath string) *Scheduler {
	schedulerOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		if storagePath == "" {
			storagePath = "/tmp/backups"
		}
		schedulerInstance = &Scheduler{
			db:            db,
			redisClient:   redisClient,
			taskQueue:     make(chan TaskPayload, 100),
			ctx:           ctx,
			cancel:        cancel,
			maxRetries:    3,
			retryInterval: 30 * time.Second,
			storagePath:   storagePath,
		}
	})
	return schedulerInstance
}

func GetScheduler() *Scheduler {
	return schedulerInstance
}

func (s *Scheduler) Start(workerCount int) {
	log.Println("Starting task scheduler with", workerCount, "workers")
	for i := 0; i < workerCount; i++ {
		s.wg.Add(1)
		go s.worker(i)
	}
	s.wg.Add(1)
	go s.retryWorker()
	log.Println("Task scheduler started successfully")
}

func (s *Scheduler) Stop() {
	log.Println("Stopping task scheduler...")
	s.cancel()
	close(s.taskQueue)
	s.wg.Wait()
	log.Println("Task scheduler stopped")
}

func (s *Scheduler) worker(id int) {
	defer s.wg.Done()
	log.Printf("Worker %d started", id)

	for payload := range s.taskQueue {
		select {
		case <-s.ctx.Done():
			log.Printf("Worker %d received stop signal", id)
			return
		default:
			s.processTask(payload)
		}
	}
	log.Printf("Worker %d stopped", id)
}

func (s *Scheduler) retryWorker() {
	defer s.wg.Done()
	ticker := time.NewTicker(s.retryInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.processRetries()
		}
	}
}

func (s *Scheduler) processTask(payload TaskPayload) {
	log.Printf("Processing task: %+v", payload)

	now := time.Now()
	task := &models.Task{
		Type:      string(TaskTypeBackup),
		Status:    string(TaskStatusRunning),
		StartedAt: &now,
	}

	if payload.BackupID > 0 {
		task.BackupID = &payload.BackupID
	}
	task.DatabaseID = payload.DatabaseID
	task.DatabaseType = payload.DatabaseType
	task.WorkspaceID = payload.WorkspaceID

	if err := s.db.Create(task).Error; err != nil {
		log.Printf("Failed to create task record: %v", err)
	}

	var err error
	switch payload.Type {
	case TaskTypeBackup:
		err = s.executeBackup(payload)
	case TaskTypeRestore:
		err = s.executeRestore(payload)
	default:
		err = fmt.Errorf("unknown task type: %s", payload.Type)
	}

	completedAt := time.Now()
	if err != nil {
		task.Status = string(TaskStatusFailed)
		task.ErrorMsg = err.Error()
		log.Printf("Task failed: %v", err)

		if payload.Type == TaskTypeBackup {
			s.updateBackupStatus(payload.BackupID, "failed", err.Error())
		}
	} else {
		task.Status = string(TaskStatusSuccess)
		log.Printf("Task completed successfully")

		if payload.Type == TaskTypeBackup {
			s.updateBackupStatus(payload.BackupID, "success", "")
		}
	}

	task.CompletedAt = &completedAt
	s.db.Save(task)

	if err != nil && payload.Type == TaskTypeBackup {
		s.handleTaskFailure(payload, err)
	}
}

func (s *Scheduler) executeBackup(payload TaskPayload) error {
	var dbInfo interface{}

	switch payload.DatabaseType {
	case "mysql":
		var mysqlDB models.MySQLDatabase
		if err := s.db.First(&mysqlDB, payload.DatabaseID).Error; err != nil {
			return fmt.Errorf("failed to get MySQL database: %w", err)
		}
		dbInfo = mysqlDB
	case "postgresql":
		var pgDB models.PostgreSQLDatabase
		if err := s.db.First(&pgDB, payload.DatabaseID).Error; err != nil {
			return fmt.Errorf("failed to get PostgreSQL database: %w", err)
		}
		dbInfo = pgDB
	default:
		return fmt.Errorf("unsupported database type: %s", payload.DatabaseType)
	}

	storagePath := s.storagePath
	if payload.Config != nil {
		if path, ok := payload.Config["storage_path"].(string); ok {
			storagePath = path
		}
	}

	switch payload.DatabaseType {
	case "mysql":
		mysqlDB := dbInfo.(models.MySQLDatabase)
		backupPath, size, bErr := s.performMySQLBackup(payload, mysqlDB, storagePath)
		if bErr != nil {
			return bErr
		}
		s.updateBackupFileInfo(payload.BackupID, backupPath, size)
	case "postgresql":
		pgDB := dbInfo.(models.PostgreSQLDatabase)
		backupPath, size, bErr := s.performPostgreSQLBackup(payload, pgDB, storagePath)
		if bErr != nil {
			return bErr
		}
		s.updateBackupFileInfo(payload.BackupID, backupPath, size)
	}

	return nil
}

func (s *Scheduler) performMySQLBackup(payload TaskPayload, db models.MySQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupDir := fmt.Sprintf("%s/mysql_%s_%d", storagePath, timestamp, payload.BackupID)

	cmd := NewCommand("xtrabackup",
		"--backup",
		"--target-dir="+backupDir,
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	output, err := cmd.Run(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("xtrabackup failed: %w, output: %s", err, string(output))
	}

	size := CalculateDirSize(backupDir)
	return backupDir, size, nil
}

func (s *Scheduler) performPostgreSQLBackup(payload TaskPayload, db models.PostgreSQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupFile := fmt.Sprintf("%s/postgresql_%s_%d.tar.gz", storagePath, timestamp, payload.BackupID)

	cmd := NewCommand("pg_basebackup",
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--username="+db.User,
		"--format=t",
		"--gzip",
		"--file="+backupFile,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	output, err := cmd.Run(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("pg_basebackup failed: %w, output: %s", err, string(output))
	}

	size := GetFileSize(backupFile)
	return backupFile, size, nil
}

func (s *Scheduler) executeRestore(payload TaskPayload) error {
	var backup models.Backup
	if err := s.db.First(&backup, payload.BackupID).Error; err != nil {
		return fmt.Errorf("failed to get backup: %w", err)
	}

	if backup.FilePath == "" {
		return fmt.Errorf("backup file path is empty")
	}

	switch payload.DatabaseType {
	case "mysql":
		return s.performMySQLRestore(payload, backup)
	case "postgresql":
		return s.performPostgreSQLRestore(payload, backup)
	default:
		return fmt.Errorf("unsupported database type: %s", payload.DatabaseType)
	}
}

func (s *Scheduler) getDatabaseInfo(databaseType string, databaseID uint) (interface{}, error) {
	switch databaseType {
	case "mysql":
		var mysqlDB models.MySQLDatabase
		if err := s.db.First(&mysqlDB, databaseID).Error; err != nil {
			return nil, fmt.Errorf("failed to get MySQL database: %w", err)
		}
		return mysqlDB, nil
	case "postgresql":
		var pgDB models.PostgreSQLDatabase
		if err := s.db.First(&pgDB, databaseID).Error; err != nil {
			return nil, fmt.Errorf("failed to get PostgreSQL database: %w", err)
		}
		return pgDB, nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", databaseType)
	}
}

func (s *Scheduler) performMySQLRestore(payload TaskPayload, backup models.Backup) error {
	dbInfo, err := s.getDatabaseInfo(payload.DatabaseType, payload.DatabaseID)
	if err != nil {
		return err
	}

	mysqlDB := dbInfo.(models.MySQLDatabase)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	if payload.PITRTime != nil {
		err = restore.MySQLPITRRestore(ctx, mysqlDB, backup.FilePath, payload.PITRTime)
	} else {
		cmd := NewCommand("xtrabackup",
			"--prepare",
			"--target-dir="+backup.FilePath,
		)

		output, err := cmd.Run(ctx)
		if err != nil {
			return fmt.Errorf("xtrabackup prepare failed: %w, output: %s", err, string(output))
		}

		cmd = NewCommand("xtrabackup",
			"--copy-back",
			"--target-dir="+backup.FilePath,
		)

		output, err = cmd.Run(ctx)
		if err != nil {
			return fmt.Errorf("xtrabackup copy-back failed: %w, output: %s", err, string(output))
		}
	}

	return err
}

func (s *Scheduler) performPostgreSQLRestore(payload TaskPayload, backup models.Backup) error {
	dbInfo, err := s.getDatabaseInfo(payload.DatabaseType, payload.DatabaseID)
	if err != nil {
		return err
	}

	pgDB := dbInfo.(models.PostgreSQLDatabase)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	if payload.PITRTime != nil {
		err = restore.PostgreSQLPITRRestore(ctx, pgDB, backup.FilePath, payload.PITRTime)
	} else {
		restoreDir := backup.FilePath + "_restore"

		cmd := NewCommand("mkdir", "-p", restoreDir)
		if _, err := cmd.Run(context.Background()); err != nil {
			return fmt.Errorf("failed to create restore directory: %w", err)
		}

		cmd = NewCommand("tar", "-xzf", backup.FilePath, "-C", restoreDir)
		output, err := cmd.Run(ctx)
		if err != nil {
			return fmt.Errorf("failed to extract backup: %w, output: %s", err, string(output))
		}
	}

	return err
}

func (s *Scheduler) updateBackupStatus(backupID uint, status, errorMsg string) {
	updates := map[string]interface{}{
		"status": status,
	}
	if errorMsg != "" {
		updates["error_msg"] = errorMsg
	}
	s.db.Model(&models.Backup{}).Where("id = ?", backupID).Updates(updates)
}

func (s *Scheduler) updateBackupFileInfo(backupID uint, filePath string, fileSize int64) {
	s.db.Model(&models.Backup{}).Where("id = ?", backupID).Updates(map[string]interface{}{
		"file_path": filePath,
		"file_size": fileSize,
	})
}

func (s *Scheduler) handleTaskFailure(payload TaskPayload, taskErr error) {
	if payload.Type != TaskTypeBackup {
		return
	}

	var task models.Task
	if err := s.db.Where("backup_id = ? AND status = ?", payload.BackupID, string(TaskStatusFailed)).
		Order("created_at DESC").First(&task).Error; err != nil {
		return
	}

	if task.RetryCount >= s.maxRetries {
		log.Printf("Task %d exceeded max retries, not scheduling retry", task.ID)
		s.sendAlert(payload, taskErr.Error())
		return
	}

	task.RetryCount++
	task.Status = string(TaskStatusRetrying)
	s.db.Save(&task)

	go func() {
		time.Sleep(s.retryInterval)
		s.EnqueueTask(payload)
	}()
}

func (s *Scheduler) processRetries() {
	var tasks []models.Task
	s.db.Where("status = ? AND retry_count < ?", string(TaskStatusRetrying), s.maxRetries).Find(&tasks)

	for _, task := range tasks {
		log.Printf("Processing retry for task %d", task.ID)
	}
}

func (s *Scheduler) sendAlert(payload TaskPayload, errorMsg string) {
	log.Printf("ALERT: Backup task failed for database %d (%s): %s",
		payload.DatabaseID, payload.DatabaseType, errorMsg)

	if s.redisClient != nil {
		alert := map[string]interface{}{
			"type":       "backup_failed",
			"database_id": payload.DatabaseID,
			"error":      errorMsg,
			"time":       time.Now().Format(time.RFC3339),
		}
		alertJSON, _ := json.Marshal(alert)
		s.redisClient.Publish(s.ctx, "alerts", string(alertJSON))
	}
}

func (s *Scheduler) EnqueueTask(payload TaskPayload) bool {
	select {
	case s.taskQueue <- payload:
		log.Printf("Task enqueued: %+v", payload)
		return true
	default:
		log.Printf("Task queue is full, cannot enqueue task")
		return false
	}
}

func (s *Scheduler) EnqueueBackupTask(backup *models.Backup) {
	payload := TaskPayload{
		Type:        TaskTypeBackup,
		TaskID:      backup.ID,
		WorkspaceID: backup.WorkspaceID,
		DatabaseID:  backup.DatabaseID,
		DatabaseType: backup.DatabaseType,
		BackupType:  backup.BackupType,
		BackupID:    backup.ID,
	}
	s.EnqueueTask(payload)
}

func (s *Scheduler) EnqueueRestoreTask(restore *models.Restore) {
	payload := TaskPayload{
		Type:         TaskTypeRestore,
		WorkspaceID:  restore.WorkspaceID,
		DatabaseID:   restore.DatabaseID,
		DatabaseType: restore.DatabaseType,
		BackupID:     restore.BackupID,
		PITRTime:    restore.PITRTime,
	}
	s.EnqueueTask(payload)
}

func (s *Scheduler) StartCleanupWorker(interval time.Duration, retentionDays int) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			s.cleanupOldBackups(retentionDays)
		}
	}()
	log.Printf("Backup cleanup worker started with retention days: %d", retentionDays)
}

func (s *Scheduler) cleanupOldBackups(retentionDays int) {
	log.Println("Starting backup cleanup...")

	var backups []models.Backup
	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)

	if err := s.db.Where("backup_time < ? AND status = ?", cutoffTime, "success").Find(&backups).Error; err != nil {
		log.Printf("Failed to query old backups: %v", err)
		return
	}

	deletedCount := 0
	for _, backup := range backups {
		if backup.FilePath == "" {
			continue
		}

		if err := os.RemoveAll(backup.FilePath); err != nil {
			log.Printf("Failed to delete backup file %s: %v", backup.FilePath, err)
			continue
		}

		s.db.Delete(&backup)
		deletedCount++
		log.Printf("Deleted old backup: %d, path: %s", backup.ID, backup.FilePath)
	}

	log.Printf("Backup cleanup completed, deleted %d old backups", deletedCount)
}