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

func MySQLPITRRestore(ctx context.Context, db models.MySQLDatabase, backupPath string, pitrTime *time.Time) error {
	timestamp := time.Now().Format("20060102150405")
	restoreDir := filepath.Join(os.TempDir(), fmt.Sprintf("mysql_restore_%s", timestamp))

	if err := os.MkdirAll(restoreDir, 0755); err != nil {
		return fmt.Errorf("failed to create restore directory: %w", err)
	}
	defer os.RemoveAll(restoreDir)

	stopCmd := exec.CommandContext(ctx, "systemctl", "stop", "mysql")
	if err := stopCmd.Run(); err != nil {
		return fmt.Errorf("failed to stop MySQL service: %w", err)
	}

	xtrabackupPath := db.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	prepareCmd := exec.CommandContext(ctx, xtrabackupPath,
		"--prepare",
		"--target-dir="+backupPath,
	)
	if err := prepareCmd.Run(); err != nil {
		return fmt.Errorf("failed to prepare backup: %w", err)
	}

	dataDir := "/var/lib/mysql"
	clearCmd := exec.CommandContext(ctx, "rm", "-rf", dataDir+"/*")
	if err := clearCmd.Run(); err != nil {
		return fmt.Errorf("failed to clear data directory: %w", err)
	}

	copyCmd := exec.CommandContext(ctx, "cp", "-r", backupPath+"/", dataDir)
	if err := copyCmd.Run(); err != nil {
		return fmt.Errorf("failed to copy backup to data directory: %w", err)
	}

	chownCmd := exec.CommandContext(ctx, "chown", "-R", "mysql:mysql", dataDir)
	_ = chownCmd.Run()

	if pitrTime != nil && db.BinaryLogEnabled {
		binlogPath := db.BinaryLogPath
		if binlogPath == "" {
			binlogPath = "/var/lib/mysql"
		}

		binlogFiles, err := filepath.Glob(filepath.Join(binlogPath, "mysql-bin.*"))
		if err == nil && len(binlogFiles) > 0 {
			for _, binlogFile := range binlogFiles {
				binlogCmd := exec.CommandContext(ctx, "mysqlbinlog",
					"--stop-datetime="+pitrTime.Format("2006-01-02 15:04:05"),
					binlogFile,
				)

				mysqlCmd := exec.CommandContext(ctx, "mysql",
					"--host="+db.Host,
					fmt.Sprintf("--port=%d", db.Port),
					"--user="+db.User,
					"--password="+db.Password,
				)

				mysqlCmd.Stdin, err = binlogCmd.StdoutPipe()
				if err != nil {
					return fmt.Errorf("failed to create pipe: %w", err)
				}

				if err := mysqlCmd.Run(); err != nil {
					return fmt.Errorf("failed to apply binary log %s: %w", binlogFile, err)
				}
			}
		}
	}

	startCmd := exec.CommandContext(ctx, "systemctl", "start", "mysql")
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start MySQL service: %w", err)
	}

	return nil
}