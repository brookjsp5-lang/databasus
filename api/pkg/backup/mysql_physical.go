package backup

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

type XtraBackupInfo struct {
	UUID           string
	Name           string
	BackupTime     string
	BackupType     string
	FromLSN        uint64
	ToLSN          uint64
	LastLSN        uint64
	BinaryLogPos   uint64
	BinlogDoDB     string
	BinlogIgnoreDB string
	GTIDExecuted   string
	GTIDPurged     string
}

func MySQLPhysicalBackup(ctx context.Context, db models.MySQLDatabase, storagePath string) (string, int64, error) {
	timestamp := time.Now().Format("20060102150405")
	backupDir := filepath.Join(storagePath, fmt.Sprintf("mysql_backup_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
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

	if db.DatabaseName != "" {
		cmd.Args = append(cmd.Args, "--databases="+db.DatabaseName)
	}

	if db.CompressionEnabled {
		cmd.Args = append(cmd.Args, "--compress")
		cmd.Args = append(cmd.Args, "--compress-method=gzip")
	}

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", 0, fmt.Errorf("xtrabackup backup failed: %w, stderr: %s", err, stderr.String())
	}

	backupInfo, err := parseXtraBackupInfo(backupDir)
	if err != nil {
		return "", 0, fmt.Errorf("failed to parse backup info: %w", err)
	}

	if backupInfo != nil && db.BinaryLogEnabled {
		binlogInfoPath := filepath.Join(backupDir, "xtrabackup_binlog_info")
		binlogContent := fmt.Sprintf("%s\n%s\n% d\n",
			backupInfo.BinaryLogPos,
			backupInfo.GTIDExecuted,
			backupInfo.LastLSN)
		os.WriteFile(binlogInfoPath, []byte(binlogContent), 0644)
	}

	var totalSize int64
	entries, err := os.ReadDir(backupDir)
	if err == nil {
		for _, entry := range entries {
			info, err := entry.Info()
			if err == nil {
				if !entry.IsDir() {
					totalSize += info.Size()
				} else {
					subDirSize := calculateDirSize(filepath.Join(backupDir, entry.Name()))
					totalSize += subDirSize
				}
			}
		}
	}

	return backupDir, totalSize, nil
}

func calculateDirSize(path string) int64 {
	var size int64
	entries, err := os.ReadDir(path)
	if err != nil {
		return 0
	}
	for _, entry := range entries {
		info, err := entry.Info()
		if err == nil {
			if !entry.IsDir() {
				size += info.Size()
			} else {
				size += calculateDirSize(filepath.Join(path, entry.Name()))
			}
		}
	}
	return size
}

func parseXtraBackupInfo(backupDir string) (*XtraBackupInfo, error) {
	infoPath := filepath.Join(backupDir, "xtrabackup_info")
	file, err := os.Open(infoPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	info := &XtraBackupInfo{}
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "uuid":
			info.UUID = value
		case "name":
			info.Name = value
		case "backup_time":
			info.BackupTime = value
		case "backup_type":
			info.BackupType = value
		case "from_lsn":
			if lsn, err := strconv.ParseUint(value, 10, 64); err == nil {
				info.FromLSN = lsn
			}
		case "to_lsn":
			if lsn, err := strconv.ParseUint(value, 10, 64); err == nil {
				info.ToLSN = lsn
			}
		case "last_lsn":
			if lsn, err := strconv.ParseUint(value, 10, 64); err == nil {
				info.LastLSN = lsn
			}
		case "binlog_pos":
			posParts := strings.Split(value, ":")
			if len(posParts) == 2 {
				if pos, err := strconv.ParseUint(posParts[1], 10, 64); err == nil {
					info.BinaryLogPos = pos
				}
			}
		case "gtid_executed":
			info.GTIDExecuted = value
		case "gtid_purged":
			info.GTIDPurged = value
		}
	}

	return info, nil
}

func GetXtraBackupBinlogInfo(backupDir string) (binlogFile string, binlogPos uint64, gtid string, err error) {
	binlogInfoPath := filepath.Join(backupDir, "xtrabackup_binlog_info")
	file, err := os.Open(binlogInfoPath)
	if err != nil {
		binlogInfoPath = filepath.Join(backupDir, "xtrabackup_slave_info")
		file, err = os.Open(binlogInfoPath)
		if err != nil {
			return "", 0, "", fmt.Errorf("binlog info file not found")
		}
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var lineNum int
	for scanner.Scan() {
		line := scanner.Text()
		lineNum++
		if lineNum == 1 {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				binlogFile = strings.TrimSpace(parts[0])
				pos, _ := strconv.ParseUint(strings.TrimSpace(parts[1]), 10, 64)
				binlogPos = pos
			} else {
				binlogFile = line
			}
		} else if lineNum == 2 && strings.Contains(line, "-") {
			gtid = line
		}
	}

	return binlogFile, binlogPos, gtid, nil
}

func MySQLBinaryLogArchive(ctx context.Context, db models.MySQLDatabase, storagePath string) error {
	timestamp := time.Now().Format("20060102150405")
	archiveDir := filepath.Join(storagePath, fmt.Sprintf("mysql_binlog_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return fmt.Errorf("failed to create archive directory: %w", err)
	}

	binlogPath := db.BinaryLogPath
	if binlogPath == "" {
		binlogPath = "/var/lib/mysql"
	}

	binlogFiles, err := filepath.Glob(filepath.Join(binlogPath, "mysql-bin.*"))
	if err != nil || len(binlogFiles) == 0 {
		return fmt.Errorf("no binlog files found in %s", binlogPath)
	}

	return nil
}

func MySQLIncrementalBackup(ctx context.Context, db models.MySQLDatabase, baseBackupDir string, storagePath string) (string, uint64, error) {
	timestamp := time.Now().Format("20060102150405")
	incrementalDir := filepath.Join(storagePath, fmt.Sprintf("mysql_incr_backup_%s_%d", timestamp, db.ID))

	if err := os.MkdirAll(incrementalDir, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create incremental backup directory: %w", err)
	}

	baseInfo, err := parseXtraBackupInfo(baseBackupDir)
	if err != nil {
		return "", 0, fmt.Errorf("failed to parse base backup info: %w", err)
	}

	xtrabackupPath := db.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	cmd := exec.CommandContext(ctx, xtrabackupPath,
		"--backup",
		"--target-dir="+incrementalDir,
		"--incremental-basedir="+baseBackupDir,
		"--host="+db.Host,
		fmt.Sprintf("--port=%d", db.Port),
		"--user="+db.User,
		"--password="+db.Password,
	)

	var stderr strings.Builder
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", 0, fmt.Errorf("xtrabackup incremental backup failed: %w, stderr: %s", err, stderr.String())
	}

	var totalSize int64
	entries, _ := os.ReadDir(incrementalDir)
	for _, entry := range entries {
		info, _ := entry.Info()
		if info != nil {
			totalSize += info.Size()
		}
	}

	return incrementalDir, baseInfo.ToLSN, nil
}

func GetMySQLBackupInfo(backupDir string) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	var totalSize int64
	for _, entry := range entries {
		if entry.IsDir() {
			totalSize += calculateDirSize(filepath.Join(backupDir, entry.Name()))
		} else {
			fi, _ := entry.Info()
			if fi != nil {
				totalSize += fi.Size()
			}
		}
	}

	info["total_size"] = totalSize
	info["file_count"] = len(entries)

	if _, err := os.Stat(filepath.Join(backupDir, "xtrabackup_info")); err == nil {
		info["has_xtrabackup_info"] = true
	}

	if _, err := os.Stat(filepath.Join(backupDir, "xtrabackup_binlog_info")); err == nil {
		info["has_binlog_info"] = true
		binlogFile, binlogPos, gtid, _ := GetXtraBackupBinlogInfo(backupDir)
		info["binlog_file"] = binlogFile
		info["binlog_pos"] = binlogPos
		info["gtid"] = gtid
	}

	return info, nil
}