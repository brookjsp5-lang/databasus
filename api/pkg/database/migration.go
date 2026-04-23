package database

import (
	"fmt"
	"log"
	"os"

	"github.com/datatrue-new/api/internal/models"
	"gorm.io/gorm"
)

// RunMigrations 运行数据库迁移
func RunMigrations(db *gorm.DB) error {
	// 自动迁移模型
	if err := autoMigrate(db); err != nil {
		return fmt.Errorf("auto migration failed: %w", err)
	}

	// 执行SQL迁移文件
	if err := executeSQLMigrations(db); err != nil {
		return fmt.Errorf("SQL migration failed: %w", err)
	}

	log.Println("Database migration completed successfully")
	return nil
}

// autoMigrate 自动迁移GORM模型
func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Workspace{},
		&models.WorkspaceMember{},
		&models.MySQLDatabase{},
		&models.PostgreSQLDatabase{},
		&models.Storage{},
		&models.Backup{},
		&models.Restore{},
		&models.BackupConfig{},
		&models.Task{},
		&models.Alert{},
		&models.SystemSetting{},
		&models.AuditLog{},
		&models.TokenBlacklist{},
	)
}

// executeSQLMigrations 执行SQL迁移文件
func executeSQLMigrations(db *gorm.DB) error {
	// 读取迁移文件
	sqlBytes, err := os.ReadFile("migrations/init.sql")
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// 执行SQL
	result := db.Exec(string(sqlBytes))
	if result.Error != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", result.Error)
	}

	return nil
}