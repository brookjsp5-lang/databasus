package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

type BackupExecutor struct {
	backupDir string
}

func NewBackupExecutor(backupDir string) *BackupExecutor {
	return &BackupExecutor{
		backupDir: backupDir,
	}
}

func (be *BackupExecutor) ExecutePostgreSQLPhysicalBackup(ctx context.Context, req BackupRequest, progressCallback func(float64)) (string, int64, error) {
	progressCallback(10)

	var opts struct {
		Host         string `json:"host"`
		Port        int    `json:"port"`
		User        string `json:"user"`
		Password    string `json:"password"`
		DatabaseName string `json:"database_name"`
		CompressLevel int   `json:"compress_level"`
	}

	if err := json.Unmarshal(req.Options, &opts); err != nil {
		return "", 0, fmt.Errorf("failed to parse options: %w", err)
	}

	progressCallback(20)

	backupName := fmt.Sprintf("pg_physical_%d", time.Now().Unix())
	backupPath := filepath.Join(be.backupDir, backupName)
	
	if err := os.MkdirAll(backupPath, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	progressCallback(30)

	cmd := exec.CommandContext(ctx, "pg_basebackup",
		"-h", opts.Host,
		"-p", strconv.Itoa(opts.Port),
		"-U", opts.User,
		"-Ft",
		"-z",
		"-D", backupPath,
		"-P",
		"-v",
	)
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", opts.Password))

	progressCallback(40)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", 0, fmt.Errorf("pg_basebackup failed: %w, output: %s", err, string(output))
	}

	progressCallback(80)

	size, err := be.getDirectorySize(backupPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to calculate backup size: %w", err)
	}

	progressCallback(100)

	return backupPath, size, nil
}

func (be *BackupExecutor) ExecuteMySQLPhysicalBackup(ctx context.Context, req BackupRequest, progressCallback func(float64)) (string, int64, error) {
	progressCallback(10)

	var opts struct {
		Host         string `json:"host"`
		Port        int    `json:"port"`
		User        string `json:"user"`
		Password    string `json:"password"`
		XtraBackupPath string `json:"xtrabackup_path"`
		CompressLevel int   `json:"compress_level"`
	}

	if err := json.Unmarshal(req.Options, &opts); err != nil {
		return "", 0, fmt.Errorf("failed to parse options: %w", err)
	}

	progressCallback(20)

	backupName := fmt.Sprintf("mysql_physical_%d", time.Now().Unix())
	backupPath := filepath.Join(be.backupDir, backupName)
	
	if err := os.MkdirAll(backupPath, 0755); err != nil {
		return "", 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	progressCallback(30)

	xtrabackupPath := opts.XtraBackupPath
	if xtrabackupPath == "" {
		xtrabackupPath = "xtrabackup"
	}

	args := []string{
		"--backup",
		"--host=" + opts.Host,
		"--port=" + strconv.Itoa(opts.Port),
		"--user=" + opts.User,
		"--password=" + opts.Password,
		"--target-dir=" + backupPath,
	}

	cmd := exec.CommandContext(ctx, xtrabackupPath, args...)

	progressCallback(40)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", 0, fmt.Errorf("xtrabackup failed: %w, output: %s", err, string(output))
	}

	progressCallback(80)

	size, err := be.getDirectorySize(backupPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to calculate backup size: %w", err)
	}

	progressCallback(100)

	return backupPath, size, nil
}

func (be *BackupExecutor) ExecuteMySQLLogicalBackup(ctx context.Context, req BackupRequest, progressCallback func(float64)) (string, int64, error) {
	progressCallback(10)

	var opts struct {
		Host         string `json:"host"`
		Port        int    `json:"port"`
		User        string `json:"user"`
		Password    string `json:"password"`
		DatabaseName string `json:"database_name"`
		CompressLevel int   `json:"compress_level"`
	}

	if err := json.Unmarshal(req.Options, &opts); err != nil {
		return "", 0, fmt.Errorf("failed to parse options: %w", err)
	}

	progressCallback(20)

	backupName := fmt.Sprintf("mysql_logical_%d.sql", time.Now().Unix())
	backupPath := filepath.Join(be.backupDir, backupName)

	progressCallback(30)

	cmd := exec.CommandContext(ctx, "mysqldump",
		"-h", opts.Host,
		"-P", strconv.Itoa(opts.Port),
		"-u", opts.User,
		"-p"+opts.Password,
		"--single-transaction",
		"--quick",
		"--lock-tables=false",
		opts.DatabaseName,
	)

	outputFile, err := os.Create(backupPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer outputFile.Close()

	progressCallback(40)

	cmd.Stdout = outputFile
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return "", 0, fmt.Errorf("mysqldump failed: %w", err)
	}

	progressCallback(80)

	stat, err := outputFile.Stat()
	if err != nil {
		return "", 0, fmt.Errorf("failed to stat backup file: %w", err)
	}

	progressCallback(100)

	return backupPath, stat.Size(), nil
}

func (be *BackupExecutor) getDirectorySize(path string) (int64, error) {
	var size int64

	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})

	return size, err
}

func (be *BackupExecutor) StreamBackupToServer(backupPath, serverURL, authToken string) error {
	file, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer file.Close()

	req, err := http.NewRequest("POST", serverURL+"/api/v1/agent/backup/upload", file)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("Content-Type", "application/octet-stream")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to upload backup: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upload failed with status: %d", resp.StatusCode)
	}

	return nil
}

func (be *BackupExecutor) StartProgressReporter(ctx context.Context, progressCallback func(float64)) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	progress := 0.0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			progress += 5.0
			if progress > 90 {
				progress = 90
			}
			progressCallback(progress)
		}
	}
}

func (be *BackupExecutor) CreateCompressedBackup(ctx context.Context, backupPath string, compressLevel int) (string, error) {
	compressedPath := backupPath + ".gz"

	cmd := exec.CommandContext(ctx, "gzip", "-"+strconv.Itoa(compressLevel), "-c", backupPath)

	outputFile, err := os.Create(compressedPath)
	if err != nil {
		return "", fmt.Errorf("failed to create compressed file: %w", err)
	}
	defer outputFile.Close()

	cmd.Stdout = outputFile
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("compression failed: %w", err)
	}

	return compressedPath, nil
}

func (be *BackupExecutor) CleanupOldBackups(maxAge time.Duration) error {
	cutoff := time.Now().Add(-maxAge)

	return filepath.Walk(be.backupDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && info.ModTime().Before(cutoff) {
			if err := os.Remove(path); err != nil {
				fmt.Printf("Failed to remove old backup %s: %v\n", path, err)
			}
		}

		return nil
	})
}

func CopyDirectory(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := CopyDirectory(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	return dstFile.Sync()
}

func tailFile(filename string, n int) ([]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) > n {
			lines = lines[1:]
		}
	}

	return lines, scanner.Err()
}
