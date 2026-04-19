package scheduler

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type Command struct {
	name   string
	args   []string
}

func NewCommand(name string, args ...string) *Command {
	return &Command{
		name: name,
		args: args,
	}
}

func (c *Command) Run(ctx context.Context) ([]byte, error) {
	cmd := exec.CommandContext(ctx, c.name, c.args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("command %s failed: %w, stderr: %s", c.name, err, stderr.String())
	}

	return stdout.Bytes(), nil
}

func CalculateDirSize(path string) int64 {
	cmd := exec.Command("du", "-sb", path)
	var output bytes.Buffer
	cmd.Stdout = &output

	if err := cmd.Run(); err != nil {
		return 0
	}

	var size int64
	fmt.Sscanf(output.String(), "%d", &size)
	return size
}

func GetFileSize(path string) int64 {
	cmd := exec.Command("stat", "-c", "%s", path)
	var output bytes.Buffer
	cmd.Stdout = &output

	if err := cmd.Run(); err != nil {
		return 0
	}

	var size int64
	fmt.Sscanf(output.String(), "%d", &size)
	return size
}

type BackupVerification struct {
	IsValid     bool
	ErrorMsg    string
	FileCount   int
	TotalSize   int64
	LastModTime time.Time
}

func VerifyBackup(backupPath, databaseType string) (*BackupVerification, error) {
	result := &BackupVerification{
		IsValid: true,
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		result.IsValid = false
		result.ErrorMsg = fmt.Sprintf("backup path does not exist: %w", err)
		return result, nil
	}

	result.TotalSize = CalculateDirSize(backupPath)
	result.LastModTime = info.ModTime()

	switch databaseType {
	case "mysql":
		requiredFiles := []string{"xtrabackup_checkpoints", "xtrabackup_info"}
		for _, file := range requiredFiles {
			filePath := filepath.Join(backupPath, file)
			if _, err := os.Stat(filePath); err != nil {
				result.IsValid = false
				result.ErrorMsg = fmt.Sprintf("missing required file: %s", file)
				return result, nil
			}
		}
	case "postgresql":
		if filepath.Ext(backupPath) == ".gz" {
			cmd := exec.Command("tar", "-tzf", backupPath)
			var output bytes.Buffer
			cmd.Stdout = &output
			if err := cmd.Run(); err != nil {
				result.IsValid = false
				result.ErrorMsg = fmt.Sprintf("failed to verify tar archive: %w", err)
				return result, nil
			}
			lines := bytes.Split(output.Bytes(), []byte("\n"))
			result.FileCount = len(lines) - 1
		} else if info.IsDir() {
			count, err := countFiles(backupPath)
			if err != nil {
				result.IsValid = false
				result.ErrorMsg = fmt.Sprintf("failed to count files: %w", err)
				return result, nil
			}
			result.FileCount = count
		}
	}

	if result.TotalSize == 0 {
		result.IsValid = false
		result.ErrorMsg = "backup file is empty"
	}

	return result, nil
}

func countFiles(dir string) (int, error) {
	var count int
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			count++
		}
		return nil
	})
	return count, err
}