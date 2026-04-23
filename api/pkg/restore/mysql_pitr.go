package restore

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/backup"
)

func MySQLPITRRestore(ctx context.Context, db models.MySQLDatabase, backupPath string, pitrTime *time.Time) error {
	if pitrTime == nil {
		return fmt.Errorf("PITR time is required for point-in-time recovery")
	}

	if err := prepareMySQLBackup(ctx, db, backupPath); err != nil {
		return fmt.Errorf("failed to prepare backup: %w", err)
	}

	if err := stopMySQL(ctx, db); err != nil {
		return err
	}

	dataDir := getMySQLDataDir(db)
	if err := clearMySQLDataDirectory(ctx, dataDir); err != nil {
		return err
	}

	if err := copyBackupToMySQLDataDir(ctx, backupPath, dataDir); err != nil {
		return err
	}

	if err := setMySQLFilePermissions(ctx, dataDir); err != nil {
		return err
	}

	if db.BinaryLogEnabled {
		if err := applyBinaryLogsUpToTime(ctx, db, pitrTime); err != nil {
			return fmt.Errorf("failed to apply binary logs for PITR: %w", err)
		}
	}

	if err := startMySQL(ctx, db); err != nil {
		return err
	}

	return nil
}

func prepareMySQLBackup(ctx context.Context, db models.MySQLDatabase, backupPath string) error {
	xtrabackupPath := db.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	prepareCmd := exec.CommandContext(ctx, xtrabackupPath,
		"--prepare",
		"--target-dir="+backupPath,
	)

	var stderr strings.Builder
	prepareCmd.Stderr = &stderr

	if err := prepareCmd.Run(); err != nil {
		return fmt.Errorf("xtrabackup prepare failed: %w, output: %s", err, stderr.String())
	}

	return nil
}

func getMySQLDataDir(db models.MySQLDatabase) string {
	if db.DataDirectory != "" {
		return db.DataDirectory
	}
	return "/var/lib/mysql"
}

func stopMySQL(ctx context.Context, db models.MySQLDatabase) error {
	serviceName := "mysql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("mysql-%s", db.InstanceID)
	}

	stopCmd := exec.CommandContext(ctx, "systemctl", "stop", serviceName)
	if err := stopCmd.Run(); err != nil {
		return fmt.Errorf("failed to stop MySQL: %w", err)
	}
	time.Sleep(2 * time.Second)
	return nil
}

func clearMySQLDataDirectory(ctx context.Context, dataDir string) error {
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

func copyBackupToMySQLDataDir(ctx context.Context, backupPath, dataDir string) error {
	copyCmd := exec.CommandContext(ctx, "cp", "-r", backupPath+"/", dataDir)
	if err := copyCmd.Run(); err != nil {
		return fmt.Errorf("failed to copy backup to data directory: %w", err)
	}
	return nil
}

func setMySQLFilePermissions(ctx context.Context, dataDir string) error {
	chownCmd := exec.CommandContext(ctx, "chown", "-R", "mysql:mysql", dataDir)
	chownCmd.Run()

	chmodCmd := exec.CommandContext(ctx, "chmod", "-R", "755", dataDir)
	chmodCmd.Run()

	return nil
}

func startMySQL(ctx context.Context, db models.MySQLDatabase) error {
	serviceName := "mysql"
	if db.InstanceID != "" {
		serviceName = fmt.Sprintf("mysql-%s", db.InstanceID)
	}

	startCmd := exec.CommandContext(ctx, "systemctl", "start", serviceName)
	if err := startCmd.Run(); err != nil {
		return fmt.Errorf("failed to start MySQL: %w", err)
	}

	for i := 0; i < 30; i++ {
		checkCmd := exec.CommandContext(ctx, "mysqladmin", "ping", "-h", "localhost")
		if err := checkCmd.Run(); err == nil {
			return nil
		}
		time.Sleep(1 * time.Second)
	}

	return fmt.Errorf("MySQL failed to start within timeout")
}

func applyBinaryLogsUpToTime(ctx context.Context, db models.MySQLDatabase, pitrTime *time.Time) error {
	binlogPath := db.BinaryLogPath
	if binlogPath == "" {
		binlogPath = "/var/lib/mysql"
	}

	binlogFiles, err := filepath.Glob(filepath.Join(binlogPath, "mysql-bin.*"))
	if err != nil || len(binlogFiles) == 0 {
		return fmt.Errorf("no binlog files found in %s", binlogPath)
	}

	sortedFiles := sortBinlogFiles(binlogFiles)

	pitrTimeStr := pitrTime.Format("2006-01-02 15:04:05")

	for _, binlogFile := range sortedFiles {
		if err := applySingleBinaryLogUpToTime(ctx, db, binlogFile, pitrTimeStr); err != nil {
			return fmt.Errorf("failed to apply binlog %s: %w", filepath.Base(binlogFile), err)
		}
	}

	return nil
}

func sortBinlogFiles(files []string) []string {
	sort.Slice(files, func(i, j int) bool {
		re := regexp.MustCompile(`mysql-bin\.(\d+)`)
		matchI := re.FindStringSubmatch(files[i])
		matchJ := re.FindStringSubmatch(files[j])
		if matchI == nil || matchJ == nil {
			return files[i] < files[j]
		}
		numI, _ := strconv.ParseUint(matchI[1], 10, 64)
		numJ, _ := strconv.ParseUint(matchJ[1], 10, 64)
		return numI < numJ
	})
	return files
}

func applySingleBinaryLogUpToTime(ctx context.Context, db models.MySQLDatabase, binlogFile string, stopDatetime string) error {
	cmd := exec.CommandContext(ctx, "mysqlbinlog",
		"--stop-datetime="+stopDatetime,
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
		binlogFile,
	)

	mysqlCmd := exec.CommandContext(ctx, "mysql",
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
	)

	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	mysqlCmd.Stdin = pipe

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start mysqlbinlog: %w", err)
	}

	if err := mysqlCmd.Run(); err != nil {
		return fmt.Errorf("failed to apply binlog %s: %w", filepath.Base(binlogFile), err)
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("mysqlbinlog process error: %w", err)
	}

	return nil
}

func MySQLFullRestore(ctx context.Context, db models.MySQLDatabase, backupPath string) error {
	if err := prepareMySQLBackup(ctx, db, backupPath); err != nil {
		return fmt.Errorf("failed to prepare backup: %w", err)
	}

	if err := stopMySQL(ctx, db); err != nil {
		return err
	}

	dataDir := getMySQLDataDir(db)
	if err := clearMySQLDataDirectory(ctx, dataDir); err != nil {
		return err
	}

	if err := copyBackupToMySQLDataDir(ctx, backupPath, dataDir); err != nil {
		return err
	}

	if err := setMySQLFilePermissions(ctx, dataDir); err != nil {
		return err
	}

	return startMySQL(ctx, db)
}

func VerifyMySQLBackup(backupPath string) error {
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup directory does not exist: %s", backupPath)
	}

	requiredFiles := []string{"ibdata1", "xtrabackup_info"}
	for _, file := range requiredFiles {
		if _, err := os.Stat(filepath.Join(backupPath, file)); os.IsNotExist(err) {
			return fmt.Errorf("required backup file missing: %s", file)
		}
	}

	xtrabackupPath := "xtrabackup"
	prepareCmd := exec.CommandContext(context.Background(), xtrabackupPath,
		"--prepare",
		"--target-dir="+backupPath,
		"--check-properties",
	)

	if err := prepareCmd.Run(); err != nil {
		return fmt.Errorf("backup verification failed: %w", err)
	}

	return nil
}

func GetMySQLPITRInfo(backupPath string) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	binlogFile, binlogPos, gtid, err := backup.GetXtraBackupBinlogInfo(backupPath)
	if err == nil {
		info["binlog_file"] = binlogFile
		info["binlog_position"] = binlogPos
		info["gtid_executed"] = gtid
		info["supports_pitr"] = true
	} else {
		info["supports_pitr"] = false
	}

	entries, err := os.ReadDir(backupPath)
	if err == nil {
		info["file_count"] = len(entries)
	}

	return info, nil
}

func CreateBackupBeforeRestore(ctx context.Context, db models.MySQLDatabase, storagePath string) (string, error) {
	timestamp := time.Now().Format("20060102150405")
	backupDir := filepath.Join(storagePath, fmt.Sprintf("pre_restore_backup_%s", timestamp))

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create backup directory: %w", err)
	}

	xtrabackupPath := db.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	cmd := exec.CommandContext(ctx, xtrabackupPath,
		"--backup",
		"--target-dir="+backupDir,
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
	)

	if err := cmd.Run(); err != nil {
		os.RemoveAll(backupDir)
		return "", fmt.Errorf("failed to create pre-restore backup: %w", err)
	}

	return backupDir, nil
}

func CreatePostgreSQLBackupBeforeRestore(ctx context.Context, db models.PostgreSQLDatabase, storagePath string) (string, error) {
	timestamp := time.Now().Format("20060102150405")
	backupFile := filepath.Join(storagePath, fmt.Sprintf("pre_restore_backup_%s.tar.gz", timestamp))

	cmd := exec.CommandContext(ctx, "pg_basebackup",
		"-h", db.Host,
		"-p", fmt.Sprintf("%d", db.Port),
		"-U", db.User,
		"-Ft",
		"-z",
		"-D", storagePath,
		"-P",
	)

	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", db.Password))

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to create pre-restore backup: %w", err)
	}

	return backupFile, nil
}

func VerifyBackup(backupPath, dbType string) (struct {
	IsValid   bool
	ErrorMsg  string
}, error) {
	result := struct {
		IsValid  bool
		ErrorMsg string
	}{IsValid: true}

	switch dbType {
	case "mysql":
		if err := VerifyMySQLBackup(backupPath); err != nil {
			result.IsValid = false
			result.ErrorMsg = err.Error()
		}
	case "postgresql":
		if err := VerifyPostgreSQLBackup(backupPath); err != nil {
			result.IsValid = false
			result.ErrorMsg = err.Error()
		}
	default:
		result.IsValid = false
		result.ErrorMsg = "unsupported database type: " + dbType
	}

	return result, nil
}

func GetBackupInfo(backupPath, dbType string) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	switch dbType {
	case "mysql":
		info["type"] = "innodb"
		info["format"] = "xtrabackup"
		mysqlInfo, err := backup.GetMySQLBackupInfo(backupPath)
		if err == nil {
			for k, v := range mysqlInfo {
				info[k] = v
			}
		}
	case "postgresql":
		info["type"] = "pg_basebackup"
		info["format"] = "tar"
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbType)
	}

	stat, err := os.Stat(backupPath)
	if err != nil {
		return nil, err
	}

	info["size"] = stat.Size()
	info["modified"] = stat.ModTime()

	if strings.HasSuffix(backupPath, ".tar.gz") {
		info["compressed"] = true
	} else {
		info["compressed"] = false
	}

	return info, nil
}