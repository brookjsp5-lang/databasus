package restore

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/databasus-new/api/internal/models"
)

type PITRRestoreResult struct {
	Success       bool
	RestoreDir    string
	TargetTime    time.Time
	WALStartLSN   string
	WALEndLSN     string
	TimelineID    uint
	ErrorMsg      string
}

func PostgreSQLPITRRestore(ctx context.Context, db models.PostgreSQLDatabase, backupPath string, pitrTime *time.Time) error {
	if pitrTime == nil {
		return fmt.Errorf("PITR time is required for point-in-time recovery")
	}

	timestamp := time.Now().Format("20060102150405")
	restoreBaseDir := filepath.Join(os.TempDir(), "databasus_pitr")
	restoreDir := filepath.Join(restoreBaseDir, fmt.Sprintf("restore_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(restoreDir, 0755); err != nil {
		return fmt.Errorf("failed to create restore directory: %w", err)
	}

	backupLabel, err := parseBackupLabel(backupPath)
	if err != nil {
		return fmt.Errorf("failed to parse backup label: %w", err)
	}

	if err := extractPostgreSQLBackup(ctx, backupPath, restoreDir); err != nil {
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	pgDataDir := filepath.Join(restoreDir, "data")
	if err := setupPostgreSQLDataDir(restoreDir, pgDataDir); err != nil {
		return err
	}

	if err := configurePITRRecovery(ctx, pgDataDir, db, pitrTime, backupLabel); err != nil {
		return err
	}

	dataDir := getPostgreSQLDataDir(db)

	if err := stopPostgreSQL(ctx, db); err != nil {
		return err
	}

	if err := clearDataDirectory(ctx, dataDir); err != nil {
		return err
	}

	if err := copyDataToPostgresDataDir(ctx, pgDataDir, dataDir); err != nil {
		return err
	}

	if err := startPostgreSQL(ctx, db); err != nil {
		return err
	}

	return nil
}

type BackupLabel struct {
	StartWALLogSeg string
	StartLSN       string
	TimelineID     uint
	BackupTime    string
	SystemID      uint64
}

func parseBackupLabel(backupPath string) (*BackupLabel, error) {
	labelPath := filepath.Join(backupPath, "backup_label")
	if _, err := os.Stat(labelPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("backup_label file not found")
	}

	file, err := os.Open(labelPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open backup_label: %w", err)
	}
	defer file.Close()

	label := &BackupLabel{}
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "START WAL LOCATION:") {
			parts := strings.Split(line, "(")
			if len(parts) > 1 {
				lsnPart := strings.Split(parts[1], ")")[0]
				label.StartLSN = strings.TrimSpace(lsnPart)
			}
		}
		if strings.HasPrefix(line, "START TIMELINE:") {
			timelineStr := strings.TrimSpace(strings.Split(line, ":")[1])
			timeline, _ := strconv.ParseUint(timelineStr, 10, 32)
			label.TimelineID = uint(timeline)
		}
		if strings.HasPrefix(line, "BACKUP TIME:") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				label.BackupTime = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(line, "SYSTEM ID:") {
			systemIDStr := strings.TrimSpace(strings.Split(line, ":")[1])
			systemID, _ := strconv.ParseUint(systemIDStr, 10, 64)
			label.SystemID = systemID
		}
	}

	return label, nil
}

func configurePITRRecovery(ctx context.Context, pgDataDir string, db models.PostgreSQLDatabase, pitrTime *time.Time, backupLabel *BackupLabel) error {
	walDir := db.WALPath
	if walDir == "" {
		walDir = "/var/lib/postgresql/wal_archive"
	}

	pgConfPath := filepath.Join(pgDataDir, "postgresql.conf")
	pgConfContent, err := os.ReadFile(pgConfPath)
	if err != nil {
		return fmt.Errorf("failed to read postgresql.conf: %w", err)
	}

	restoreCommand := fmt.Sprintf("restore_command = 'cp %s/%%f %%p'", walDir)
	recoveryTargetTime := fmt.Sprintf("recovery_target_time = '%s'", pitrTime.Format("2006-01-02 15:04:05 MST"))
	recoveryTargetAction := "recovery_target_action = 'promote'"
	restoreRecovery := fmt.Sprintf("%s\n%s\n%s\n", restoreCommand, recoveryTargetTime, recoveryTargetAction)

	newConfContent := string(pgConfContent) + "\n" + restoreRecovery

	tmpConfPath := filepath.Join(pgDataDir, "postgresql.conf.tmp")
	if err := os.WriteFile(tmpConfPath, []byte(newConfContent), 0600); err != nil {
		return fmt.Errorf("failed to write postgresql.conf: %w", err)
	}
	os.Rename(tmpConfPath, pgConfPath)

	recoverySignal := filepath.Join(pgDataDir, "recovery.signal")
	if err := os.WriteFile(recoverySignal, []byte(""), 0644); err != nil {
		return fmt.Errorf("failed to create recovery.signal: %w", err)
	}

	return nil
}

func PostgreSQLFullRestore(ctx context.Context, db models.PostgreSQLDatabase, backupPath string) error {
	timestamp := time.Now().Format("20060102150405")
	restoreBaseDir := filepath.Join(os.TempDir(), "databasus_restore")
	restoreDir := filepath.Join(restoreBaseDir, fmt.Sprintf("restore_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(restoreDir, 0755); err != nil {
		return fmt.Errorf("failed to create restore directory: %w", err)
	}
	defer os.RemoveAll(restoreBaseDir)

	if err := extractPostgreSQLBackup(ctx, backupPath, restoreDir); err != nil {
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	pgDataDir := filepath.Join(restoreDir, "data")
	os.MkdirAll(pgDataDir, 0755)

	entries, err := os.ReadDir(restoreDir)
	if err != nil {
		return fmt.Errorf("failed to read restore directory: %w", err)
	}

	for _, entry := range entries {
		if entry.Name() == "data" || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		src := filepath.Join(restoreDir, entry.Name())
		dst := filepath.Join(pgDataDir, entry.Name())
		if err := os.Rename(src, dst); err != nil {
			return fmt.Errorf("failed to move files to data directory: %w", err)
		}
	}

	dataDir := getPostgreSQLDataDir(db)

	if err := stopPostgreSQL(ctx, db); err != nil {
		return err
	}

	if err := clearDataDirectory(ctx, dataDir); err != nil {
		return err
	}

	if err := copyDataToPostgresDataDir(ctx, pgDataDir, dataDir); err != nil {
		return err
	}

	return startPostgreSQL(ctx, db)
}

func VerifyPostgreSQLBackup(backupPath string) error {
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file does not exist: %s", backupPath)
	}

	entries, err := os.ReadDir(backupPath)
	if err != nil {
		return fmt.Errorf("failed to read backup directory: %w", err)
	}

	if len(entries) == 0 {
		return fmt.Errorf("backup directory is empty")
	}

	labelPath := filepath.Join(backupPath, "backup_label")
	if _, err := os.Stat(labelPath); os.IsNotExist(err) {
		return fmt.Errorf("backup_label file not found - not a valid pg_basebackup backup")
	}

	return nil
}

func getPostgreSQLDataDir(db models.PostgreSQLDatabase) string {
	if db.DataDirectory != "" {
		return db.DataDirectory
	}
	dataDir := "/var/lib/postgresql/data"
	if db.DatabaseName != "" {
		dataDir = filepath.Join("/var/lib/postgresql", db.DatabaseName, "data")
	}
	return dataDir
}

func stopPostgreSQL(ctx context.Context, db models.PostgreSQLDatabase) error {
	serviceName := "postgresql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("postgresql-%s", db.InstanceID)
	}

	stopCmd := exec.CommandContext(ctx, "systemctl", "stop", serviceName)
	if err := stopCmd.Run(); err != nil {
		logCmd := exec.CommandContext(ctx, "systemctl", "status", serviceName)
		logCmd.Run()
		return fmt.Errorf("failed to stop PostgreSQL: %w", err)
	}
	time.Sleep(2 * time.Second)
	return nil
}

func clearDataDirectory(ctx context.Context, dataDir string) error {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	entries, err := os.ReadDir(dataDir)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to read data directory: %w", err)
	}

	for _, entry := range entries {
		entryPath := filepath.Join(dataDir, entry.Name())
		os.RemoveAll(entryPath)
	}

	return nil
}

func copyDataToPostgresDataDir(ctx context.Context, srcDir, dstDir string) error {
	copyCmd := exec.CommandContext(ctx, "cp", "-r", srcDir+"/", dstDir)
	if err := copyCmd.Run(); err != nil {
		return fmt.Errorf("failed to copy restore files to data directory: %w", err)
	}

	chownCmd := exec.CommandContext(ctx, "chown", "-R", "postgres:postgres", dstDir)
	chownCmd.Run()

	chmodCmd := exec.CommandContext(ctx, "chmod", "-R", "700", dstDir)
	chmodCmd.Run()

	return nil
}

func startPostgreSQL(ctx context.Context, db models.PostgreSQLDatabase) error {
	serviceName := "postgresql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("postgresql-%s", db.InstanceID)
	}

	startCmd := exec.CommandContext(ctx, "systemctl", "start", serviceName)
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start PostgreSQL: %w", err)
	}

	for i := 0; i < 30; i++ {
		checkCmd := exec.CommandContext(ctx, "pg_isready", "-h", "localhost", "-p", fmt.Sprintf("%d", db.Port))
		if err := checkCmd.Run(); err == nil {
			return nil
		}
		time.Sleep(1 * time.Second)
	}

	return fmt.Errorf("PostgreSQL failed to start within timeout")
}

func extractPostgreSQLBackup(ctx context.Context, backupPath string, restoreDir string) error {
	isTarGz := strings.HasSuffix(backupPath, ".tar.gz") || strings.HasSuffix(backupPath, ".tgz")

	if isTarGz {
		untarCmd := exec.CommandContext(ctx, "tar", "-xzf", backupPath, "-C", restoreDir)
		if err := untarCmd.Run(); err != nil {
			return fmt.Errorf("failed to extract backup: %w", err)
		}
	} else {
		copyCmd := exec.CommandContext(ctx, "cp", "-r", backupPath+"/", restoreDir)
		if err := copyCmd.Run(); err != nil {
			return fmt.Errorf("failed to copy backup: %w", err)
		}
	}

	return nil
}

func setupPostgreSQLDataDir(restoreDir, pgDataDir string) error {
	if err := os.MkdirAll(pgDataDir, 0700); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	entries, err := os.ReadDir(restoreDir)
	if err != nil {
		return fmt.Errorf("failed to read restore directory: %w", err)
	}

	for _, entry := range entries {
		if entry.Name() == "data" || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		src := filepath.Join(restoreDir, entry.Name())
		dst := filepath.Join(pgDataDir, entry.Name())
		if err := os.Rename(src, dst); err != nil {
			srcInfo, _ := os.Stat(src)
			dstInfo, _ := os.Stat(dst)
			if srcInfo != nil && dstInfo != nil && !os.SameFile(srcInfo, dstInfo) {
				return fmt.Errorf("failed to move files to data directory: %w", err)
			}
		}
	}

	return nil
}