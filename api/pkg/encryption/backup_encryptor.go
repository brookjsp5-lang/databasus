package encryption

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type BackupEncryptor struct {
	cipher *AES256GCM
}

func NewBackupEncryptor(key string) (*BackupEncryptor, error) {
	cipher, err := NewAES256GCM(key)
	if err != nil {
		return nil, err
	}
	return &BackupEncryptor{cipher: cipher}, nil
}

func (be *BackupEncryptor) EncryptFile(srcPath, destPath string) error {
	plaintext, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("failed to read source file: %w", err)
	}

	ciphertext, err := be.cipher.Encrypt(plaintext)
	if err != nil {
		return fmt.Errorf("failed to encrypt data: %w", err)
	}

	if err := os.WriteFile(destPath, ciphertext, 0644); err != nil {
		return fmt.Errorf("failed to write encrypted file: %w", err)
	}

	return nil
}

func (be *BackupEncryptor) DecryptFile(srcPath, destPath string) error {
	ciphertext, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("failed to read encrypted file: %w", err)
	}

	plaintext, err := be.cipher.Decrypt(ciphertext)
	if err != nil {
		return fmt.Errorf("failed to decrypt data: %w", err)
	}

	if err := os.WriteFile(destPath, plaintext, 0644); err != nil {
		return fmt.Errorf("failed to write decrypted file: %w", err)
	}

	return nil
}

func (be *BackupEncryptor) EncryptDirectory(srcDir, destDir string) error {
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	encryptedTarPath := filepath.Join(destDir, "backup.tar.enc")
	tarFile, err := os.Create(encryptedTarPath)
	if err != nil {
		return fmt.Errorf("failed to create tar file: %w", err)
	}
	defer tarFile.Close()

	plaintext, err := be.createTarGz(srcDir)
	if err != nil {
		return fmt.Errorf("failed to create tar archive: %w", err)
	}

	ciphertext, err := be.cipher.Encrypt(plaintext)
	if err != nil {
		return fmt.Errorf("failed to encrypt tar archive: %w", err)
	}

	if _, err := tarFile.Write(ciphertext); err != nil {
		return fmt.Errorf("failed to write encrypted data: %w", err)
	}

	return nil
}

func (be *BackupEncryptor) DecryptDirectory(srcPath, destDir string) error {
	ciphertext, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("failed to read encrypted file: %w", err)
	}

	plaintext, err := be.cipher.Decrypt(ciphertext)
	if err != nil {
		return fmt.Errorf("failed to decrypt data: %w", err)
	}

	if err := be.extractTarGz(plaintext, destDir); err != nil {
		return fmt.Errorf("failed to extract tar archive: %w", err)
	}

	return nil
}

func (be *BackupEncryptor) createTarGz(srcDir string) ([]byte, error) {
	tarData := &bytes.Buffer{}
	gzWriter := gzip.NewWriter(tarData)
	tarWriter := tar.NewWriter(gzWriter)

	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}

		if !info.IsDir() {
			data, err := os.Open(path)
			if err != nil {
				return err
			}
			defer data.Close()

			if _, err := io.Copy(tarWriter, data); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	if err := tarWriter.Close(); err != nil {
		return nil, err
	}
	if err := gzWriter.Close(); err != nil {
		return nil, err
	}

	return tarData.Bytes(), nil
}

func (be *BackupEncryptor) extractTarGz(data []byte, destDir string) error {
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	tarData := &bytes.Reader{}
	gzReader, err := gzip.NewReader(tarData)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzip.NewReader(bytes.NewReader(data)))

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(destDir, header.Name)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}

			outFile, err := os.OpenFile(target, os.O_CREATE|os.O_RDWR, os.FileMode(header.Mode))
			if err != nil {
				return err
			}

			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()
		}
	}

	return nil
}
