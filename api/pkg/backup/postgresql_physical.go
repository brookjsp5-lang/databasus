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

// PostgreSQLPhysicalBackup PostgreSQL物理备份
func PostgreSQLPhysicalBackup(ctx context.Context, db models.PostgreSQLDatabase, storagePath string) (string, int64, error) {
	// 生成备份文件名
	timestamp := time.Now().Format("20060102150405")
	backupDir := filepath.Join(storagePath, fmt.Sprintf("postgresql_backup_%s", timestamp))

	// 创建备份目录
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	// 构建pg_basebackup命令
	cmd := exec.CommandContext(ctx, "pg_basebackup",
		"--host=", db.Host,
		"--port=", fmt.Sprintf("%d", db.Port),
		"--username=", db.User,
		"--pgpassfile=", "/tmp/pgpass",
		"--format=tar",
		"--gzip",
		"--target=", backupDir,
	)

	// 设置环境变量
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PGPASSWORD=%s", db.Password),
	)

	// 执行备份
	if err := cmd.Run(); err != nil {
		return "", 0, fmt.Errorf("failed to run pg_basebackup: %w", err)
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

// PostgreSQLWALArchive PostgreSQL WAL日志归档
func PostgreSQLWALArchive(ctx context.Context, db models.PostgreSQLDatabase, storagePath string) error {
	// 生成归档目录
	timestamp := time.Now().Format("20060102150405")
	archiveDir := filepath.Join(storagePath, fmt.Sprintf("postgresql_wal_%s", timestamp))

	// 创建归档目录
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return fmt.Errorf("failed to create archive directory: %w", err)
	}

	// 构建pg_receivewal命令
	cmd := exec.CommandContext(ctx, "pg_receivewal",
		"--host=", db.Host,
		"--port=", fmt.Sprintf("%d", db.Port),
		"--username=", db.User,
		"--directory=", archiveDir,
	)

	// 设置环境变量
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PGPASSWORD=%s", db.Password),
	)

	// 执行归档
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to archive WAL logs: %w", err)
	}

	return nil
}