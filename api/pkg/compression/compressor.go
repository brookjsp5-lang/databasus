package compression

import (
	"archive/tar"
	"compress/bzip2"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type CompressionLevel int

const (
	NoCompression   CompressionLevel = 0
	BestSpeed       CompressionLevel = 1
	BestCompression CompressionLevel = 9
	DefaultCompression CompressionLevel = 6
	Level1          CompressionLevel = 1
	Level2          CompressionLevel = 2
	Level3          CompressionLevel = 3
	Level4          CompressionLevel = 4
	Level5          CompressionLevel = 5
	Level6          CompressionLevel = 6
	Level7          CompressionLevel = 7
	Level8          CompressionLevel = 8
	Level9          CompressionLevel = 9
)

type CompressionType string

const (
	GZip     CompressionType = "gzip"
	BZip2    CompressionType = "bzip2"
	XZ       CompressionType = "xz"
	LZ4      CompressionType = "lz4"
	Zstandard CompressionType = "zstd"
)

type CompressionConfig struct {
	Type  CompressionType
	Level CompressionLevel
}

type Compressor struct {
	config CompressionConfig
}

func NewCompressor(config CompressionConfig) *Compressor {
	return &Compressor{config: config}
}

func (c *Compressor) CompressDirectory(srcDir, destFile string) error {
	if c.config.Type == NoCompression {
		return c.copyDirectory(srcDir, destFile)
	}

	switch c.config.Type {
	case GZip:
		return c.compressWithGzip(srcDir, destFile)
	case BZip2:
		return c.compressWithBzip2(srcDir, destFile)
	case XZ:
		return c.compressWithXZ(srcDir, destFile)
	case LZ4:
		return c.compressWithLZ4(srcDir, destFile)
	case Zstandard:
		return c.compressWithZstandard(srcDir, destFile)
	default:
		return fmt.Errorf("unsupported compression type: %s", c.config.Type)
	}
}

func (c *Compressor) DecompressArchive(srcFile, destDir string) error {
	switch c.config.Type {
	case GZip:
		return c.decompressGzip(srcFile, destDir)
	case BZip2:
		return c.decompressBzip2(srcFile, destDir)
	case XZ:
		return c.decompressXZ(srcFile, destDir)
	case LZ4:
		return c.decompressLZ4(srcFile, destDir)
	case Zstandard:
		return c.decompressZstandard(srcFile, destDir)
	default:
		return fmt.Errorf("unsupported compression type: %s", c.config.Type)
	}
}

func (c *Compressor) compressWithGzip(srcDir, destFile string) error {
	file, err := os.Create(destFile)
	if err != nil {
		return fmt.Errorf("failed to create archive file: %w", err)
	}
	defer file.Close()

	gzipWriter, err := gzip.NewWriterLevel(file, int(c.config.Level))
	if err != nil {
		return fmt.Errorf("failed to create gzip writer: %w", err)
	}
	defer gzipWriter.Close()

	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
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
		return fmt.Errorf("failed to create tar archive: %w", err)
	}

	return nil
}

func (c *Compressor) compressWithBzip2(srcDir, destFile string) error {
	return fmt.Errorf("bzip2 compression not yet implemented")
}

func (c *Compressor) compressWithXZ(srcDir, destFile string) error {
	return fmt.Errorf("xz compression not yet implemented")
}

func (c *Compressor) compressWithLZ4(srcDir, destFile string) error {
	return fmt.Errorf("lz4 compression not yet implemented")
}

func (c *Compressor) compressWithZstandard(srcDir, destFile string) error {
	return fmt.Errorf("zstandard compression not yet implemented")
}

func (c *Compressor) decompressGzip(srcFile, destDir string) error {
	file, err := os.Open(srcFile)
	if err != nil {
		return fmt.Errorf("failed to open archive file: %w", err)
	}
	defer file.Close()

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	tarReader := tar.NewReader(file)

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

func (c *Compressor) decompressBzip2(srcFile, destDir string) error {
	file, err := os.Open(srcFile)
	if err != nil {
		return fmt.Errorf("failed to open archive file: %w", err)
	}
	defer file.Close()

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	reader := bzip2.NewReader(file)
	tarReader := tar.NewReader(reader)

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

func (c *Compressor) decompressXZ(srcFile, destDir string) error {
	return fmt.Errorf("xz decompression not yet implemented")
}

func (c *Compressor) decompressLZ4(srcFile, destDir string) error {
	return fmt.Errorf("lz4 decompression not yet implemented")
}

func (c *Compressor) decompressZstandard(srcFile, destDir string) error {
	return fmt.Errorf("zstandard decompression not yet implemented")
}

func (c *Compressor) copyDirectory(srcDir, destDir string) error {
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		target := filepath.Join(destDir, relPath)

		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		return copyFile(path, target)
	})
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

func GetCompressionLevelFromConfig(level int) CompressionLevel {
	switch {
	case level <= 0:
		return NoCompression
	case level == 1:
		return Level1
	case level <= 3:
		return Level3
	case level <= 5:
		return Level5
	case level <= 7:
		return Level7
	case level == 8:
		return Level8
	case level >= 9:
		return Level9
	default:
		return DefaultCompression
	}
}

func EstimateCompressionRatio(compressionType CompressionType, level CompressionLevel) float64 {
	switch compressionType {
	case GZip:
		switch level {
		case Level1, Level2:
			return 0.4
		case Level3, Level4, Level5:
			return 0.3
		case Level6, Level7:
			return 0.25
		case Level8, Level9:
			return 0.2
		default:
			return 0.25
		}
	case BZip2:
		return 0.22
	case XZ:
		return 0.18
	case LZ4:
		return 0.35
	case Zstandard:
		return 0.23
	default:
		return 0.25
	}
}
