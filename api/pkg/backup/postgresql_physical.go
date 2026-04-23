package backup

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/datatrue-new/api/internal/models"
)

func PostgreSQLPhysicalBackup(ctx context.Context, db models.PostgreSQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupFile := filepath.Join(storagePath, fmt.Sprintf("postgresql_backup_%s_%d.tar.gz", timestamp, db.ID))

	if err := os.MkdirAll(storagePath, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create storage directory: %w", err)
	}

	cmd := exec.CommandContext(ctx, "pg_basebackup",
		"-h", db.Host,
		"-p", fmt.Sprintf("%d", db.Port),
		"-U", db.User,
		"-Ft",
		"-z",
		"-D", storagePath,
		"-P",
		"-v",
	)

	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", db.Password))

	if db.PasswordFile != "" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("PGPASSFILE=%s", db.PasswordFile))
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", 0, fmt.Errorf("pg_basebackup failed: %w, output: %s", err, string(output))
	}

	var totalSize int64
	entries, err := os.ReadDir(storagePath)
	if err == nil {
		for _, entry := range entries {
			info, err := entry.Info()
			if err == nil {
				totalSize += info.Size()
			}
		}
	}

	backupDir := filepath.Join(storagePath, fmt.Sprintf("postgresql_backup_%s_%d", timestamp, db.ID))
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	globPattern := filepath.Join(storagePath, "*.tar.gz")
	matches, _ := filepath.Glob(globPattern)
	for _, match := range matches {
		src := match
		dst := filepath.Join(backupDir, filepath.Base(match))
		if err := os.Rename(src, dst); err != nil {
			return "", 0, fmt.Errorf("failed to move backup file: %w", err)
		}
		backupFile = dst
		totalSize, _ = getFileSize(dst)
	}

	return backupFile, totalSize, nil
}

func getFileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func PostgreSQLWALArchive(ctx context.Context, db models.PostgreSQLDatabase, storagePath string) error {
	timestamp := time.Now().Format("20060102150405")
	archiveDir := filepath.Join(storagePath, fmt.Sprintf("postgresql_wal_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return fmt.Errorf("failed to create archive directory: %w", err)
	}

	if db.WALPath == "" {
		db.WALPath = "/var/lib/postgresql/wal_archive"
	}

	cmd := exec.CommandContext(ctx, "pg_receivewal",
		"-h", db.Host,
		"-p", fmt.Sprintf("%d", db.Port),
		"-U", db.User,
		"-D", archiveDir,
		"--compress=gzip",
		"--slot", fmt.Sprintf("datatrue_slot_%d", db.ID),
		"--no-loop",
	)

	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", db.Password))

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_receivewal failed: %w, output: %s", err, string(output))
	}

	return nil
}

func GetPostgreSQLBackupInfo(backupDir string) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	var totalSize int64

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info_entry, _ := entry.Info()
		totalSize += info_entry.Size()

		filename := entry.Name()
		if filename == "backup_label" || filename == "backup_label.old" {
			info["has_backup_label"] = true
		}
		if filepath.Ext(filename) == ".gz" {
			info["compressed"] = true
		}
	}

	info["total_size"] = totalSize
	info["file_count"] = len(entries)
	info["backup_format"] = "tar-gz"

	return info, nil
}