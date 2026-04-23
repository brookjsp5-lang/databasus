package compression

import (
	"fmt"
	"time"
)

type CompressionPreset struct {
	Name        string
	Type        CompressionType
	Level       CompressionLevel
	Description string
	BestFor     string
}

var CompressionPresets = []CompressionPreset{
	{
		Name:        "fast",
		Type:        GZip,
		Level:       Level1,
		Description: "Fast compression with minimal CPU usage",
		BestFor:     "Real-time backups, high-frequency schedules",
	},
	{
		Name:        "balanced",
		Type:        GZip,
		Level:       Level6,
		Description: "Balanced compression ratio and speed",
		BestFor:     "Daily backups, general purpose use",
	},
	{
		Name:        "high",
		Type:        GZip,
		Level:       Level9,
		Description: "Maximum compression with higher CPU usage",
		BestFor:     "Long-term storage, limited bandwidth",
	},
	{
		Name:        "ultra",
		Type:        XZ,
		Level:       Level9,
		Description: "Maximum compression for archive storage",
		BestFor:     "Monthly/Yearly archives, disaster recovery",
	},
	{
		Name:        "instant",
		Type:        LZ4,
		Level:       Level1,
		Description: "Very fast compression for instant operations",
		BestFor:     "Transaction logs, incremental backups",
	},
}

func GetPreset(name string) (*CompressionPreset, error) {
	for _, preset := range CompressionPresets {
		if preset.Name == name {
			return &preset, nil
		}
		return nil, fmt.Errorf("compression preset not found: %s", name)
	}
	return nil, nil
}

func GetDefaultPreset() *CompressionPreset {
	return &CompressionPresets[1]
}

func GetCompressionEstimate(originalSize int64, preset *CompressionPreset) CompressionEstimate {
	ratio := EstimateCompressionRatio(preset.Type, preset.Level)
	compressedSize := int64(float64(originalSize) * ratio)

	return CompressionEstimate{
		OriginalSize:    originalSize,
		CompressedSize:  compressedSize,
		Savings:         originalSize - compressedSize,
		SavingsPercent:  (1 - ratio) * 100,
		CompressionTime: estimateCompressionTime(originalSize, preset),
	}
}

type CompressionEstimate struct {
	OriginalSize    int64
	CompressedSize int64
	Savings         int64
	SavingsPercent  float64
	CompressionTime time.Duration
}

func estimateCompressionTime(dataSize int64, preset *CompressionPreset) time.Duration {
	var bytesPerSecond int64

	switch preset.Type {
	case GZip:
		switch preset.Level {
		case Level1:
			bytesPerSecond = 100 * 1024 * 1024
		case Level2, Level3:
			bytesPerSecond = 80 * 1024 * 1024
		case Level4, Level5:
			bytesPerSecond = 60 * 1024 * 1024
		case Level6, Level7:
			bytesPerSecond = 40 * 1024 * 1024
		case Level8, Level9:
			bytesPerSecond = 20 * 1024 * 1024
		default:
			bytesPerSecond = 50 * 1024 * 1024
		}
	case BZip2:
		bytesPerSecond = 30 * 1024 * 1024
	case XZ:
		bytesPerSecond = 10 * 1024 * 1024
	case LZ4:
		bytesPerSecond = 200 * 1024 * 1024
	case Zstandard:
		bytesPerSecond = 150 * 1024 * 1024
	default:
		bytesPerSecond = 50 * 1024 * 1024
	}

	seconds := dataSize / bytesPerSecond
	return time.Duration(seconds) * time.Second
}

type CompressionStats struct {
	TotalOriginalSize   int64
	TotalCompressedSize int64
	TotalSavings        int64
	AverageRatio        float64
	TotalFiles          int
	CompressedFiles     int
	FailedFiles         int
}

func NewCompressionStats() *CompressionStats {
	return &CompressionStats{}
}

func (cs *CompressionStats) AddFile(originalSize, compressedSize int64) {
	cs.TotalOriginalSize += originalSize
	cs.TotalCompressedSize += compressedSize
	cs.TotalFiles++
	if compressedSize > 0 {
		cs.CompressedFiles++
	}
}

func (cs *CompressionStats) IncrementFailed() {
	cs.TotalFiles++
	cs.FailedFiles++
}

func (cs *CompressionStats) CalculateStats() {
	if cs.TotalOriginalSize > 0 {
		cs.AverageRatio = float64(cs.TotalCompressedSize) / float64(cs.TotalOriginalSize)
		cs.TotalSavings = cs.TotalOriginalSize - cs.TotalCompressedSize
	}
}

func (cs *CompressionStats) GetSavingsPercent() float64 {
	if cs.TotalOriginalSize == 0 {
		return 0
	}
	return (1 - cs.AverageRatio) * 100
}

func FormatBytes(bytes int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
		TB = GB * 1024
	)

	switch {
	case bytes >= TB:
		return fmt.Sprintf("%.2f TB", float64(bytes)/TB)
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/GB)
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/MB)
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/KB)
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}
