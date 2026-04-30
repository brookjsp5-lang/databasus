package scheduler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/datatrue-new/api/internal/models"
	"github.com/datatrue-new/api/pkg/restore"
	"github.com/datatrue-new/api/pkg/websocket"
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
	TaskStatusCancelled TaskStatus = "cancelled"
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
	RetryCount  int        `json:"retry_count"`
	MaxRetries  int        `json:"max_retries"`
	ErrorMsg    string     `json:"error_msg,omitempty"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type TaskPayload struct {
	Type         TaskType       `json:"type"`
	TaskID       uint           `json:"task_id"`
	WorkspaceID  uint           `json:"workspace_id"`
	DatabaseID   uint           `json:"database_id"`
	DatabaseType string         `json:"database_type"`
	TargetKind   string         `json:"target_kind,omitempty"`
	BackupType   string         `json:"backup_type,omitempty"`
	BackupID     uint           `json:"backup_id,omitempty"`
	PITRTime     *time.Time     `json:"pitr_time,omitempty"`
	Config       map[string]any `json:"config,omitempty"`
}

type BackupProgress struct {
	TaskID     uint      `json:"task_id"`
	BackupID   uint      `json:"backup_id"`
	DatabaseID uint      `json:"database_id"`
	Status     string    `json:"status"`
	Progress   float64   `json:"progress"`
	Message    string    `json:"message"`
	StartedAt  time.Time `json:"started_at"`
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
	progressMap   sync.Map
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
	websocket.NewHub()
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

	s.broadcastProgress(payload, "running", 0, "任务开始执行")

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
			s.broadcastProgress(payload, "failed", 100, fmt.Sprintf("备份失败: %v", err))
		} else {
			s.broadcastProgress(payload, "failed", 100, fmt.Sprintf("恢复失败: %v", err))
		}
	} else {
		task.Status = string(TaskStatusSuccess)
		log.Printf("Task completed successfully")

		if payload.Type == TaskTypeBackup {
			s.updateBackupStatus(payload.BackupID, "success", "")
			s.broadcastProgress(payload, "success", 100, "任务执行成功")
		} else {
			s.broadcastProgress(payload, "success", 100, "恢复任务执行成功")
		}
	}

	task.CompletedAt = &completedAt
	s.db.Save(task)

	if err != nil && payload.Type == TaskTypeBackup {
		s.handleTaskFailure(payload, err)
	}
}

func (s *Scheduler) broadcastProgress(payload TaskPayload, status string, progress float64, message string) {
	progressUpdate := &websocket.ProgressUpdate{
		TaskID:   payload.TaskID,
		Type:     string(payload.Type),
		Status:   status,
		Progress: progress,
		Message:  message,
	}

	if payload.BackupID > 0 {
		progressUpdate.BackupID = payload.BackupID
	}

	hub := websocket.GetHub()
	if hub != nil {
		hub.BroadcastProgress(progressUpdate)
	}

	key := fmt.Sprintf("progress:%s:%d", payload.Type, payload.TaskID)
	progressData, _ := json.Marshal(progressUpdate)
	if s.redisClient != nil {
		s.redisClient.Set(context.Background(), key, progressData, 24*time.Hour)
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

	s.broadcastProgress(payload, "running", 10, "正在准备备份环境")

	var backupPath string
	var size int64
	var err error

	switch payload.DatabaseType {
	case "mysql":
		mysqlDB := dbInfo.(models.MySQLDatabase)
		s.broadcastProgress(payload, "running", 20, "开始执行MySQL物理备份")
		backupPath, size, err = s.performMySQLBackup(payload, mysqlDB, storagePath)
		if err != nil {
			return err
		}
		s.broadcastProgress(payload, "running", 80, "正在压缩备份文件")
		compressedPath, compressErr := s.compressBackup(backupPath)
		if compressErr != nil {
			log.Printf("Compression failed, using original path: %v", compressErr)
		} else {
			backupPath = compressedPath
			size = GetFileSize(backupPath)
		}
	case "postgresql":
		pgDB := dbInfo.(models.PostgreSQLDatabase)
		s.broadcastProgress(payload, "running", 20, "开始执行PostgreSQL物理备份")
		backupPath, size, err = s.performPostgreSQLBackup(payload, pgDB, storagePath)
		if err != nil {
			return err
		}
		s.broadcastProgress(payload, "running", 80, "正在压缩备份文件")
	}

	s.broadcastProgress(payload, "running", 95, "正在保存备份信息")
	s.updateBackupFileInfo(payload.BackupID, backupPath, size)

	return nil
}

func (s *Scheduler) compressBackup(sourcePath string) (string, error) {
	filename := filepath.Base(sourcePath)
	compressedFile := sourcePath + ".tar.gz"

	cmd := exec.Command("tar", "-czf", compressedFile, "-C", filepath.Dir(sourcePath), filename)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to compress backup: %w", err)
	}

	os.RemoveAll(sourcePath)

	return compressedFile, nil
}

func (s *Scheduler) performMySQLBackup(payload TaskPayload, db models.MySQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupDir := filepath.Join(storagePath, fmt.Sprintf("mysql_backup_%s_%d", timestamp, payload.BackupID))

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	xtrabackupPath := db.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	cmd := exec.CommandContext(context.Background(), xtrabackupPath,
		"--backup",
		"--target-dir="+backupDir,
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		s.broadcastProgress(payload, "failed", 0, fmt.Sprintf("xtrabackup执行失败: %s", stderr.String()))
		return "", 0, fmt.Errorf("xtrabackup failed: %w, output: %s", err, stderr.String())
	}

	size := CalculateDirSize(backupDir)
	return backupDir, size, nil
}

func (s *Scheduler) performPostgreSQLBackup(payload TaskPayload, db models.PostgreSQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupFile := filepath.Join(storagePath, fmt.Sprintf("postgresql_backup_%s_%d.tar.gz", timestamp, payload.BackupID))

	cmd := exec.Command("pg_basebackup",
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--username="+db.User,
		"--format=t",
		"--gzip",
		"--file="+backupFile,
	)

	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", db.Password))

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		s.broadcastProgress(payload, "failed", 0, fmt.Sprintf("pg_basebackup执行失败: %s", stderr.String()))
		return "", 0, fmt.Errorf("pg_basebackup failed: %w, output: %s", err, stderr.String())
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

	s.broadcastProgress(payload, "running", 10, "正在验证备份文件")

	verifyResult, err := VerifyBackup(backup.FilePath, payload.DatabaseType)
	if err != nil || !verifyResult.IsValid {
		return fmt.Errorf("backup verification failed: %v, %s", err, verifyResult.ErrorMsg)
	}

	s.broadcastProgress(payload, "running", 20, "备份文件验证通过")

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

func (s *Scheduler) getRestoreInstanceInfo(databaseType string, instanceID uint) (interface{}, error) {
	var instance models.RestoreInstance
	if err := s.db.First(&instance, instanceID).Error; err != nil {
		return nil, fmt.Errorf("failed to get restore instance: %w", err)
	}
	if instance.DatabaseType != databaseType {
		return nil, fmt.Errorf("restore instance database type mismatch")
	}

	switch databaseType {
	case "mysql":
		return models.MySQLDatabase{
			ID:             instance.ID,
			Name:           instance.Name,
			Host:           instance.Host,
			Port:           instance.Port,
			User:           instance.User,
			Password:       instance.Password,
			DatabaseName:   instance.DatabaseName,
			EngineVersion:  instance.EngineVersion,
			DataDirectory:  instance.DataDirectory,
			InstanceID:     instance.InstanceID,
			BinaryLogPath:  instance.BinaryLogPath,
			XtraBackupPath: instance.XtraBackupPath,
		}, nil
	case "postgresql":
		return models.PostgreSQLDatabase{
			ID:            instance.ID,
			Name:          instance.Name,
			Host:          instance.Host,
			Port:          instance.Port,
			User:          instance.User,
			Password:      instance.Password,
			DatabaseName:  instance.DatabaseName,
			EngineVersion: instance.EngineVersion,
			DataDirectory: instance.DataDirectory,
			InstanceID:    instance.InstanceID,
			WALPath:       instance.WALPath,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", databaseType)
	}
}

func (s *Scheduler) performMySQLRestore(payload TaskPayload, backup models.Backup) error {
	var (
		dbInfo interface{}
		err    error
	)
	if payload.TargetKind == "restore_instance" {
		dbInfo, err = s.getRestoreInstanceInfo(payload.DatabaseType, payload.DatabaseID)
	} else {
		dbInfo, err = s.getDatabaseInfo(payload.DatabaseType, payload.DatabaseID)
	}
	if err != nil {
		return err
	}

	mysqlDB := dbInfo.(models.MySQLDatabase)
	if payload.TargetKind == "restore_instance" {
		sourceInfo, sourceErr := s.getDatabaseInfo(backup.DatabaseType, backup.DatabaseID)
		if sourceErr == nil {
			sourceDB := sourceInfo.(models.MySQLDatabase)
			mysqlDB.BinaryLogEnabled = sourceDB.BinaryLogEnabled
			mysqlDB.BinaryLogPath = sourceDB.BinaryLogPath
			if mysqlDB.XtraBackupPath == "" {
				mysqlDB.XtraBackupPath = sourceDB.XtraBackupPath
			}
		}
	}

	s.broadcastProgress(payload, "running", 30, "正在准备恢复环境")

	xtrabackupPath := mysqlDB.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	s.broadcastProgress(payload, "running", 40, "正在执行xtrabackup prepare")

	prepareCmd := exec.CommandContext(context.Background(), xtrabackupPath,
		"--prepare",
		"--target-dir="+backup.FilePath,
	)
	prepareCmd.Run()

	if payload.PITRTime != nil && mysqlDB.BinaryLogEnabled {
		s.broadcastProgress(payload, "running", 60, fmt.Sprintf("正在执行PITR时间点恢复至: %s", payload.PITRTime.Format("2006-01-02 15:04:05")))
		err = restore.MySQLPITRRestore(context.Background(), mysqlDB, backup.FilePath, payload.PITRTime)
	} else {
		s.broadcastProgress(payload, "running", 70, "正在复制备份文件到数据目录")
		err = s.directMySQLRestore(mysqlDB, backup.FilePath, xtrabackupPath)
	}

	if err != nil {
		s.broadcastProgress(payload, "failed", 0, fmt.Sprintf("恢复失败: %v", err))
		return err
	}

	s.broadcastProgress(payload, "success", 100, "数据库恢复成功")
	return nil
}

func (s *Scheduler) directMySQLRestore(db models.MySQLDatabase, backupPath, xtrabackupPath string) error {
	serviceName := "mysql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("mysql-%s", db.InstanceID)
	}

	stopCmd := exec.CommandContext(context.Background(), "systemctl", "stop", serviceName)
	if err := stopCmd.Run(); err != nil {
		log.Printf("Warning: failed to stop MySQL: %v", err)
	}

	dataDir := db.DataDirectory
	if dataDir == "" {
		dataDir = "/var/lib/mysql"
	}

	clearCmd := exec.CommandContext(context.Background(), "rm", "-rf", dataDir+"/*")
	if err := clearCmd.Run(); err != nil {
		return fmt.Errorf("failed to clear data directory: %w", err)
	}

	copyCmd := exec.CommandContext(context.Background(), "cp", "-r", backupPath+"/", dataDir)
	if err := copyCmd.Run(); err != nil {
		return fmt.Errorf("failed to copy backup to data directory: %w", err)
	}

	chownCmd := exec.CommandContext(context.Background(), "chown", "-R", "mysql:mysql", dataDir)
	chownCmd.Run()

	startCmd := exec.CommandContext(context.Background(), "systemctl", "start", serviceName)
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start MySQL service: %w", err)
	}

	return nil
}

func (s *Scheduler) performPostgreSQLRestore(payload TaskPayload, backup models.Backup) error {
	var (
		dbInfo interface{}
		err    error
	)
	if payload.TargetKind == "restore_instance" {
		dbInfo, err = s.getRestoreInstanceInfo(payload.DatabaseType, payload.DatabaseID)
	} else {
		dbInfo, err = s.getDatabaseInfo(payload.DatabaseType, payload.DatabaseID)
	}
	if err != nil {
		return err
	}

	pgDB := dbInfo.(models.PostgreSQLDatabase)
	if payload.TargetKind == "restore_instance" {
		sourceInfo, sourceErr := s.getDatabaseInfo(backup.DatabaseType, backup.DatabaseID)
		if sourceErr == nil {
			sourceDB := sourceInfo.(models.PostgreSQLDatabase)
			if pgDB.WALPath == "" {
				pgDB.WALPath = sourceDB.WALPath
			}
		}
	}

	s.broadcastProgress(payload, "running", 30, "正在准备恢复环境")

	if payload.PITRTime != nil {
		s.broadcastProgress(payload, "running", 40, fmt.Sprintf("正在执行PITR时间点恢复至: %s", payload.PITRTime.Format("2006-01-02 15:04:05")))
		err = restore.PostgreSQLPITRRestore(context.Background(), pgDB, backup.FilePath, payload.PITRTime)
	} else {
		s.broadcastProgress(payload, "running", 50, "正在解压备份文件")
		err = s.directPostgreSQLRestore(pgDB, backup.FilePath)
	}

	if err != nil {
		s.broadcastProgress(payload, "failed", 0, fmt.Sprintf("恢复失败: %v", err))
		return err
	}

	s.broadcastProgress(payload, "success", 100, "数据库恢复成功")
	return nil
}

func (s *Scheduler) directPostgreSQLRestore(db models.PostgreSQLDatabase, backupFile string) error {
	timestamp := time.Now().Format("20060102150405")
	restoreDir := filepath.Join(os.TempDir(), fmt.Sprintf("pg_restore_%s", timestamp))

	if err := os.MkdirAll(restoreDir, 0755); err != nil {
		return fmt.Errorf("failed to create restore directory: %w", err)
	}
	defer os.RemoveAll(restoreDir)

	serviceName := "postgresql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("postgresql-%s", db.InstanceID)
	}

	stopCmd := exec.CommandContext(context.Background(), "systemctl", "stop", serviceName)
	if err := stopCmd.Run(); err != nil {
		log.Printf("Warning: failed to stop PostgreSQL: %v", err)
	}

	dataDir := db.DataDirectory
	if dataDir == "" {
		dataDir = "/var/lib/postgresql/data"
		if db.DatabaseName != "" {
			dataDir = filepath.Join("/var/lib/postgresql", db.DatabaseName, "data")
		}
	}

	untarCmd := exec.CommandContext(context.Background(), "tar", "-xzf", backupFile, "-C", restoreDir)
	if err := untarCmd.Run(); err != nil {
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	clearCmd := exec.CommandContext(context.Background(), "rm", "-rf", dataDir+"/*")
	if err := clearCmd.Run(); err != nil {
		return fmt.Errorf("failed to clear data directory: %w", err)
	}

	entries, err := os.ReadDir(restoreDir)
	if err != nil {
		return fmt.Errorf("failed to read restore directory: %w", err)
	}

	for _, entry := range entries {
		src := filepath.Join(restoreDir, entry.Name())
		dst := filepath.Join(dataDir, entry.Name())
		if err := os.Rename(src, dst); err != nil {
			return fmt.Errorf("failed to move files: %w", err)
		}
	}

	chownCmd := exec.CommandContext(context.Background(), "chown", "-R", "postgres:postgres", dataDir)
	chownCmd.Run()

	startCmd := exec.CommandContext(context.Background(), "systemctl", "start", serviceName)
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start PostgreSQL service: %w", err)
	}

	return nil
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
			"type":        "backup_failed",
			"database_id": payload.DatabaseID,
			"error":       errorMsg,
			"time":        time.Now().Format(time.RFC3339),
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
		Type:         TaskTypeBackup,
		TaskID:       backup.ID,
		WorkspaceID:  backup.WorkspaceID,
		DatabaseID:   backup.DatabaseID,
		DatabaseType: backup.DatabaseType,
		BackupType:   backup.BackupType,
		BackupID:     backup.ID,
	}
	s.EnqueueTask(payload)
}

func (s *Scheduler) EnqueueRestoreTask(restore *models.Restore) {
	payload := TaskPayload{
		Type:         TaskTypeRestore,
		WorkspaceID:  restore.WorkspaceID,
		DatabaseID:   restore.DatabaseID,
		DatabaseType: restore.DatabaseType,
		TargetKind:   restore.TargetKind,
		BackupID:     restore.BackupID,
		PITRTime:     restore.PITRTime,
	}
	s.EnqueueTask(payload)
}

func (s *Scheduler) EnqueueRestoreTaskWithConfig(payload TaskPayload) {
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

func (s *Scheduler) GetTaskProgress(taskID uint, taskType TaskType) *websocket.ProgressUpdate {
	key := fmt.Sprintf("progress:%s:%d", taskType, taskID)
	if s.redisClient != nil {
		data, err := s.redisClient.Get(context.Background(), key).Result()
		if err == nil {
			var progress websocket.ProgressUpdate
			if json.Unmarshal([]byte(data), &progress) == nil {
				return &progress
			}
		}
	}
	return nil
}
