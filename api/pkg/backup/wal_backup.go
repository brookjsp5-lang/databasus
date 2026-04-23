package backup

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/datatrue-new/api/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type WALBackupService struct {
	db          *gorm.DB
	redisClient *redis.Client
	storagePath string
	running     map[uint]bool
	mutex       sync.RWMutex
	stopChan    chan uint
}

var walServiceInstance *WALBackupService
var walServiceOnce sync.Once

func NewWALBackupService(db *gorm.DB, redisClient *redis.Client, storagePath string) *WALBackupService {
	walServiceOnce.Do(func() {
		if storagePath == "" {
			storagePath = "/tmp/wal_backups"
		}
		walServiceInstance = &WALBackupService{
			db:          db,
			redisClient: redisClient,
			storagePath: storagePath,
			running:     make(map[uint]bool),
			stopChan:    make(chan uint),
		}
	})
	return walServiceInstance
}

func GetWALBackupService() *WALBackupService {
	return walServiceInstance
}

func (s *WALBackupService) Start() {
	log.Println("Starting WAL/Binlog backup service...")
	go s.watchDatabases()
	log.Println("WAL/Binlog backup service started")
}

func (s *WALBackupService) Stop() {
	log.Println("Stopping WAL/Binlog backup service...")
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for dbID := range s.running {
		s.stopChan <- dbID
	}
	s.running = make(map[uint]bool)
	log.Println("WAL/Binlog backup service stopped")
}

func (s *WALBackupService) watchDatabases() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.checkAndStartWALBackup()
	}
}

func (s *WALBackupService) checkAndStartWALBackup() {
	var mysqlDBs []models.MySQLDatabase
	if err := s.db.Where("binary_log_enabled = ?", true).Find(&mysqlDBs).Error; err == nil {
		for _, db := range mysqlDBs {
			s.startMySQLBinlogBackup(db)
		}
	}

	var pgDBs []models.PostgreSQLDatabase
	if err := s.db.Where("wal_enabled = ?", true).Find(&pgDBs).Error; err == nil {
		for _, db := range pgDBs {
			s.startPostgreSQLWALBackup(db)
		}
	}
}

func (s *WALBackupService) startMySQLBinlogBackup(db models.MySQLDatabase) {
	s.mutex.Lock()
	if s.running[db.ID] {
		s.mutex.Unlock()
		return
	}
	s.running[db.ID] = true
	stopChan := make(chan struct{})
	s.mutex.Unlock()

	go func() {
		defer func() {
			s.mutex.Lock()
			delete(s.running, db.ID)
			s.mutex.Unlock()
		}()

		s.backupMySQLBinlog(db, stopChan)
	}()
}

func (s *WALBackupService) backupMySQLBinlog(db models.MySQLDatabase, stopChan <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	archiveDir := filepath.Join(s.storagePath, fmt.Sprintf("mysql_binlog_%s_%d", time.Now().Format("20060102"), db.ID))
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		log.Printf("Failed to create binlog archive directory: %v", err)
		return
	}

	for {
		select {
		case <-stopChan:
			log.Printf("Stopping MySQL binlog backup for database %d", db.ID)
			return
		case <-ticker.C:
			if err := s.archiveMySQLBinlog(db, archiveDir); err != nil {
				log.Printf("MySQL binlog backup error for database %d: %v", db.ID, err)
			}
		}
	}
}

func (s *WALBackupService) archiveMySQLBinlog(db models.MySQLDatabase, archiveDir string) error {
	if db.BinaryLogPath == "" {
		db.BinaryLogPath = "/var/lib/mysql"
	}

	timestamp := time.Now().Format("20060102150405")
	outputFile := filepath.Join(archiveDir, fmt.Sprintf("binlog_%s", timestamp))

	cmd := exec.CommandContext(context.Background(), "mysqlbinlog",
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
		"--raw",
		"--read-from-remote-server",
		"--result-file="+outputFile,
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("mysqlbinlog failed: %w, output: %s", err, stderr.String())
	}

	s.publishBinlogProgress(db.ID, archiveDir)
	return nil
}

func (s *WALBackupService) startPostgreSQLWALBackup(db models.PostgreSQLDatabase) {
	s.mutex.Lock()
	if s.running[db.ID] {
		s.mutex.Unlock()
		return
	}
	s.running[db.ID] = true
	s.mutex.Unlock()

	go func() {
		defer func() {
			s.mutex.Lock()
			delete(s.running, db.ID)
			s.mutex.Unlock()
		}()

		s.backupPostgreSQLWAL(db)
	}()
}

func (s *WALBackupService) backupPostgreSQLWAL(db models.PostgreSQLDatabase) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	archiveDir := filepath.Join(s.storagePath, fmt.Sprintf("postgresql_wal_%s_%d", time.Now().Format("20060102"), db.ID))
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		log.Printf("Failed to create WAL archive directory: %v", err)
		return
	}

	for {
		select {
		case <-s.stopChan:
			log.Printf("Stopping PostgreSQL WAL backup for database %d", db.ID)
			return
		case <-ticker.C:
			if err := s.archivePostgreSQLWAL(db, archiveDir); err != nil {
				log.Printf("PostgreSQL WAL backup error for database %d: %v", db.ID, err)
			}
		}
	}
}

func (s *WALBackupService) archivePostgreSQLWAL(db models.PostgreSQLDatabase, archiveDir string) error {
	cmd := exec.CommandContext(context.Background(), "pg_receivewal",
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--username="+db.User,
		"--directory="+archiveDir,
		"--compress=gzip",
	)

	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", db.Password))

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_receivewal failed: %w, output: %s", err, stderr.String())
	}

	s.publishWALProgress(db.ID, archiveDir)
	return nil
}

func (s *WALBackupService) publishBinlogProgress(databaseID uint, archiveDir string) {
	if s.redisClient == nil {
		return
	}

	ctx := context.Background()
	info := map[string]interface{}{
		"database_id": databaseID,
		"type":        "mysql_binlog",
		"archive_dir": archiveDir,
		"last_update": time.Now().Format(time.RFC3339),
	}

	key := fmt.Sprintf("wal_backup:mysql:%d", databaseID)
	s.redisClient.HSet(ctx, key, info)
	s.redisClient.Expire(ctx, key, 24*time.Hour)
}

func (s *WALBackupService) publishWALProgress(databaseID uint, archiveDir string) {
	if s.redisClient == nil {
		return
	}

	ctx := context.Background()
	info := map[string]interface{}{
		"database_id": databaseID,
		"type":        "postgresql_wal",
		"archive_dir": archiveDir,
		"last_update": time.Now().Format(time.RFC3339),
	}

	key := fmt.Sprintf("wal_backup:postgresql:%d", databaseID)
	s.redisClient.HSet(ctx, key, info)
	s.redisClient.Expire(ctx, key, 24*time.Hour)
}

func (s *WALBackupService) GetBackupStatus(databaseID uint, dbType string) (map[string]string, error) {
	key := fmt.Sprintf("wal_backup:%s:%d", dbType, databaseID)
	if s.redisClient == nil {
		return nil, fmt.Errorf("redis not available")
	}

	ctx := context.Background()
	result, err := s.redisClient.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *WALBackupService) StopBackup(databaseID uint, dbType string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running[databaseID] {
		return fmt.Errorf("backup not running for database %d", databaseID)
	}

	s.stopChan <- databaseID
	delete(s.running, databaseID)

	return nil
}