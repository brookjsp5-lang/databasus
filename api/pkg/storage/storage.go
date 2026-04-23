package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type StorageType string

const (
	StorageTypeLocal StorageType = "local"
	StorageTypeS3    StorageType = "s3"
	StorageTypeNAS   StorageType = "nas"
)

type StorageConfig struct {
	Type          StorageType
	LocalPath     string
	S3Bucket      string
	S3Region      string
	S3Endpoint    string
	S3AccessKey   string
	S3SecretKey   string
	NASPath       string
	NASHost       string
}

type Storage interface {
	Upload(ctx context.Context, key string, data io.Reader, size int64) error
	Download(ctx context.Context, key string, writer io.WriterAt) error
	Delete(ctx context.Context, key string) error
	Exists(ctx context.Context, key string) (bool, error)
	List(ctx context.Context, prefix string) ([]string, error)
	GetURL(ctx context.Context, key string) (string, error)
}

func NewStorage(cfg StorageConfig) (Storage, error) {
	switch cfg.Type {
	case StorageTypeLocal:
		return NewLocalStorage(cfg.LocalPath), nil
	case StorageTypeS3:
		return NewS3Storage(cfg)
	case StorageTypeNAS:
		return NewNASStorage(cfg.NASPath), nil
	default:
		return nil, fmt.Errorf("unsupported storage type: %s", cfg.Type)
	}
}

type LocalStorage struct {
	basePath string
}

func NewLocalStorage(basePath string) *LocalStorage {
	return &LocalStorage{basePath: basePath}
}

func (s *LocalStorage) fullPath(key string) string {
	return filepath.Join(s.basePath, key)
}

func (s *LocalStorage) Upload(ctx context.Context, key string, data io.Reader, size int64) error {
	fullPath := s.fullPath(key)

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	written, err := io.Copy(file, data)
	if err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	if size > 0 && written != size {
		return fmt.Errorf("written bytes (%d) does not match expected size (%d)", written, size)
	}

	return nil
}

func (s *LocalStorage) Download(ctx context.Context, key string, writer io.WriterAt) error {
	fullPath := s.fullPath(key)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	_, err = writer.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	return nil
}

func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	fullPath := s.fullPath(key)
	return os.Remove(fullPath)
}

func (s *LocalStorage) Exists(ctx context.Context, key string) (bool, error) {
	fullPath := s.fullPath(key)
	_, err := os.Stat(fullPath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (s *LocalStorage) List(ctx context.Context, prefix string) ([]string, error) {
	fullPath := s.fullPath(prefix)

	var files []string
	err := filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			relPath, _ := filepath.Rel(s.basePath, path)
			files = append(files, relPath)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return files, nil
}

func (s *LocalStorage) GetURL(ctx context.Context, key string) (string, error) {
	absPath, _ := filepath.Abs(s.fullPath(key))
	return fmt.Sprintf("file://%s", absPath), nil
}

type S3Storage struct {
	bucket   string
	endpoint string
	region   string
	accessKey string
	secretKey string
	client   *http.Client
}

func NewS3Storage(cfg StorageConfig) (*S3Storage, error) {
	return &S3Storage{
		bucket:    cfg.S3Bucket,
		endpoint:  cfg.S3Endpoint,
		region:    cfg.S3Region,
		accessKey: cfg.S3AccessKey,
		secretKey: cfg.S3SecretKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func (s *S3Storage) buildURL(key string) string {
	if s.endpoint != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimSuffix(s.endpoint, "/"), s.bucket, key)
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, key)
}

func (s *S3Storage) Upload(ctx context.Context, key string, data io.Reader, size int64) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("failed to read data: %w", err)
	}

	url := s.buildURL(key)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if s.accessKey != "" && s.secretKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s", s.accessKey, s.region))
	}

	req.Header.Set("Content-Type", "application/octet-stream")
	if size > 0 {
		req.Header.Set("Content-Length", fmt.Sprintf("%d", size))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to upload to S3: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("S3 returned error status: %d", resp.StatusCode)
	}

	return nil
}

func (s *S3Storage) Download(ctx context.Context, key string, writer io.WriterAt) error {
	url := s.buildURL(key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if s.accessKey != "" && s.secretKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s", s.accessKey, s.region))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download from S3: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("S3 returned error status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	_, err = writer.Write(body)
	if err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	return nil
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	url := s.buildURL(key)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	if s.accessKey != "" && s.secretKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s", s.accessKey, s.region))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete from S3: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

func (s *S3Storage) Exists(ctx context.Context, key string) (bool, error) {
	url := s.buildURL(key)

	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	if s.accessKey != "" && s.secretKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s", s.accessKey, s.region))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == 200, nil
}

func (s *S3Storage) List(ctx context.Context, prefix string) ([]string, error) {
	url := s.buildURL(prefix)
	if !strings.HasSuffix(url, "/") {
		url += "/"
	}
	url += "?list-type=2&prefix=" + prefix

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if s.accessKey != "" && s.secretKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s", s.accessKey, s.region))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list S3 objects: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("S3 returned error status: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var keys []string
	content := string(body)
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if strings.Contains(line, "<Key>") {
			start := strings.Index(line, "<Key>") + 5
			end := strings.Index(line, "</Key>")
			if start > 4 && end > start {
				keys = append(keys, line[start:end])
			}
		}
	}

	return keys, nil
}

func (s *S3Storage) GetURL(ctx context.Context, key string) (string, error) {
	return s.buildURL(key), nil
}

type NASStorage struct {
	basePath string
}

func NewNASStorage(basePath string) *NASStorage {
	return &NASStorage{basePath: basePath}
}

func (s *NASStorage) Upload(ctx context.Context, key string, data io.Reader, size int64) error {
	fullPath := filepath.Join(s.basePath, key)

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	written, err := io.Copy(file, data)
	if err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	if size > 0 && written != size {
		return fmt.Errorf("written bytes (%d) does not match expected size (%d)", written, size)
	}

	return nil
}

func (s *NASStorage) Download(ctx context.Context, key string, writer io.WriterAt) error {
	fullPath := filepath.Join(s.basePath, key)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	_, err = writer.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	return nil
}

func (s *NASStorage) Delete(ctx context.Context, key string) error {
	fullPath := filepath.Join(s.basePath, key)
	return os.Remove(fullPath)
}

func (s *NASStorage) Exists(ctx context.Context, key string) (bool, error) {
	fullPath := filepath.Join(s.basePath, key)
	_, err := os.Stat(fullPath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (s *NASStorage) List(ctx context.Context, prefix string) ([]string, error) {
	fullPath := filepath.Join(s.basePath, prefix)

	var files []string
	err := filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			relPath, _ := filepath.Rel(s.basePath, path)
			files = append(files, relPath)
		}
		return nil
	})

	return files, err
}

func (s *NASStorage) GetURL(ctx context.Context, key string) (string, error) {
	return fmt.Sprintf("smb://%s/%s", s.basePath, key), nil
}

type BackupStorage struct {
	storage      Storage
	storageType  StorageType
	compress     bool
	encrypt      bool
	encryptionKey []byte
}

func NewBackupStorage(cfg StorageConfig, compress, encrypt bool, encryptionKey []byte) *BackupStorage {
	storage, _ := NewStorage(cfg)
	return &BackupStorage{
		storage:      storage,
		storageType:  cfg.Type,
		compress:     compress,
		encrypt:      encrypt,
		encryptionKey: encryptionKey,
	}
}

func (s *BackupStorage) SaveBackup(ctx context.Context, backupID string, data io.Reader, size int64) error {
	key := fmt.Sprintf("backups/%s/%s_%d.tar.gz", s.storageType, backupID, time.Now().Unix())

	if err := s.storage.Upload(ctx, key, data, size); err != nil {
		return fmt.Errorf("failed to save backup: %w", err)
	}

	return nil
}

func (s *BackupStorage) GetBackup(ctx context.Context, key string) (io.ReadCloser, error) {
	return nil, nil
}

func (s *BackupStorage) ListBackups(ctx context.Context, prefix string) ([]string, error) {
	return s.storage.List(ctx, fmt.Sprintf("backups/%s/%s", s.storageType, prefix))
}

func (s *BackupStorage) DeleteBackup(ctx context.Context, key string) error {
	return s.storage.Delete(ctx, key)
}