package restore

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/databasus-new/api/internal/models"
)

func PostgreSQLPITRRestore(ctx context.Context, db models.PostgreSQLDatabase, backupPath string, pitrTime *time.Time) error {
	timestamp := time.Now().Format("20060102150405")
	restoreDir := filepath.Join(os.TempDir(), fmt.Sprintf("postgresql_restore_%s", timestamp))

	if err := os.MkdirAll(restoreDir, 0755); err != nil {
		return fmt.Errorf("failed to create restore directory: %w", err)
	}
	defer os.RemoveAll(restoreDir)

	untarCmd := exec.CommandContext(ctx, "tar", "-xzf", backupPath, "-C", restoreDir)
	if err := untarCmd.Run(); err != nil {
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	pgDataDir := filepath.Join(restoreDir, "data")
	if err := os.MkdirAll(pgDataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	entries, err := os.ReadDir(restoreDir)
	if err != nil {
		return fmt.Errorf("failed to read restore directory: %w", err)
	}

	for _, entry := range entries {
		if entry.Name() != "data" {
			src := filepath.Join(restoreDir, entry.Name())
			dst := filepath.Join(pgDataDir, entry.Name())
			if err := os.Rename(src, dst); err != nil {
				return fmt.Errorf("failed to move files to data directory: %w", err)
			}
		}
	}

	restoreConfContent := "restore_command = 'cp " + db.WALPath + "/%f %p'\n"
	if pitrTime != nil {
		restoreConfContent += fmt.Sprintf("recovery_target_time = '%s'\n", pitrTime.Format("2006-01-02 15:04:05"))
		restoreConfContent += "recovery_target_action = 'promote'\n"
	}

	restoreCommandPath := filepath.Join(pgDataDir, "restore_command")
	if err := os.WriteFile(restoreCommandPath, []byte(restoreConfContent), 0644); err != nil {
		return fmt.Errorf("failed to create restore_command: %w", err)
	}

	postgresqlConf := filepath.Join(pgDataDir, "postgresql.conf")
	restoreConf := filepath.Join(pgDataDir, "restore.conf")

	if _, err := os.Stat(postgresqlConf); err == nil {
		confContent, err := os.ReadFile(postgresqlConf)
		if err != nil {
			return fmt.Errorf("failed to read postgresql.conf: %w", err)
		}

		restorePart := "\n# PITR Restore Configuration\n"
		restorePart += "restore_command = 'cp " + db.WALPath + "/%f %p'\n"
		if pitrTime != nil {
			restorePart += fmt.Sprintf("recovery_target_time = '%s'\n", pitrTime.Format("2006-01-02 15:04:05"))
			restorePart += "recovery_target_action = 'promote'\n"
		}

		newContent := append(confContent, []byte(restorePart)...)
		if err := os.WriteFile(postgresqlConf, newContent, 0644); err != nil {
			return fmt.Errorf("failed to update postgresql.conf: %w", err)
		}
	} else {
		if err := os.WriteFile(restoreConf, []byte(restoreConfContent), 0644); err != nil {
			return fmt.Errorf("failed to create restore.conf: %w", err)
		}
	}

	recoverySignal := filepath.Join(pgDataDir, "recovery.signal")
	if err := os.WriteFile(recoverySignal, []byte(""), 0644); err != nil {
		return fmt.Errorf("failed to create recovery.signal: %w", err)
	}

	dataDir := "/var/lib/postgresql/data"
	if db.DatabaseName != "" {
		dataDir = filepath.Join("/var/lib/postgresql", db.DatabaseName, "data")
	}

	stopCmd := exec.CommandContext(ctx, "systemctl", "stop", "postgresql")
	_ = stopCmd.Run()

	clearCmd := exec.CommandContext(ctx, "rm", "-rf", dataDir+"/*")
	if err := clearCmd.Run(); err != nil {
		return fmt.Errorf("failed to clear data directory: %w", err)
	}

	copyCmd := exec.CommandContext(ctx, "cp", "-r", pgDataDir+"/", dataDir)
	if err := copyCmd.Run(); err != nil {
		return fmt.Errorf("failed to copy restore files to data directory: %w", err)
	}

	chownCmd := exec.CommandContext(ctx, "chown", "-R", "postgres:postgres", dataDir)
	_ = chownCmd.Run()

	startCmd := exec.CommandContext(ctx, "systemctl", "start", "postgresql")
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start PostgreSQL service: %w", err)
	}

	return nil
}