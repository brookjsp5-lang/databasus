package backup

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/databasus-new/api/internal/models"
)

// MySQLPhysicalBackup MySQL物理备份
func MySQLPhysicalBackup(ctx context.Context, db models.MySQLDatabase, storagePath string) (string, int64, error) {
	// 生成备份文件名
	timestamp := time.Now().Format("20060102150405")
	backupDir := filepath.Join(storagePath, fmt.Sprintf("mysql_backup_%s", timestamp))

	// 创建备份目录
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	// 构建xtrabackup命令
	cmd := exec.CommandContext(ctx, db.XtraBackupPath, 
		"--backup",
		"--target-dir=", backupDir,
		"--host=", db.Host,
		"--port=", fmt.Sprintf("%d", db.Port),
		"--user=", db.User,
		"--password=", db.Password,
	)

	// 执行备份
	if err := cmd.Run(); err != nil {
		return "", 0, fmt.Errorf("failed to run xtrabackup: %w", err)
	}

	// 计算备份大小
	var totalSize int64
	err := filepath.Walk(backupDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})
	if err != nil {
		return "", 0, fmt.Errorf("failed to calculate backup size: %w", err)
	}

	return backupDir, totalSize, nil
}

// MySQLBinaryLogArchive MySQL二进制日志归档
func MySQLBinaryLogArchive(ctx context.Context, db models.MySQLDatabase, storagePath string) error {
	// 生成归档目录
	timestamp := time.Now().Format("20060102150405")
	archiveDir := filepath.Join(storagePath, fmt.Sprintf("mysql_binlog_%s", timestamp))

	// 创建归档目录
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return fmt.Errorf("failed to create archive directory: %w", err)
	}

	// 构建mysqlbinlog命令
	cmd := exec.CommandContext(ctx, "mysqlbinlog",
		"--host=", db.Host,
		"--port=", fmt.Sprintf("%d", db.Port),
		"--user=", db.User,
		"--password=", db.Password,
		"--raw",
		"--read-from-remote-server",
		"--result-file=", archiveDir,
	)

	// 执行归档
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to archive binary logs: %w", err)
	}

	return nil
}