package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/datatrue-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RetentionHandler struct {
	db *gorm.DB
}

func NewRetentionHandler(db *gorm.DB) *RetentionHandler {
	return &RetentionHandler{db: db}
}

type GFSConfigRequest struct {
	ConfigID   uint `json:"config_id" binding:"required"`
	SonEnabled bool `json:"son_enabled"`
	SonDays    int  `json:"son_days"`
	FatherEnabled    bool `json:"father_enabled"`
	FatherWeeks      int  `json:"father_weeks"`
	GrandfatherEnabled bool   `json:"grandfather_enabled"`
	GrandfatherMonths int   `json:"grandfather_months"`
}

type GFSCleanupResult struct {
	DeletedCount   int      `json:"deleted_count"`
	DeletedBackups []uint   `json:"deleted_backups"`
	RetainedCount  int      `json:"retained_count"`
	Errors         []string `json:"errors,omitempty"`
}

func (h *RetentionHandler) GetGFSConfig(c *gin.Context) {
	configID := c.Param("config_id")
	var config models.BackupConfig
	if err := h.db.First(&config, configID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"config": gin.H{
			"gfs_tier_enabled":                   config.GFSTierEnabled,
			"gfs_son_enabled":                    config.GFSSonEnabled,
			"gfs_son_retention_days":             config.GFSSonRetentionDays,
			"gfs_father_enabled":                 config.GFSFatherEnabled,
			"gfs_father_retention_weeks":         config.GFSFatherRetentionWeeks,
			"gfs_grandfather_enabled":            config.GFSGrandfatherEnabled,
			"gfs_grandfather_retention_months":  config.GFSGrandfatherRetentionMonths,
		},
	})
}

func (h *RetentionHandler) UpdateGFSConfig(c *gin.Context) {
	var req GFSConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, req.ConfigID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	config.GFSTierEnabled = req.SonEnabled || req.FatherEnabled
	config.GFSSonEnabled = req.SonEnabled
	config.GFSSonRetentionDays = req.SonDays
	config.GFSFatherEnabled = req.FatherEnabled
	config.GFSFatherRetentionWeeks = req.FatherWeeks
	config.GFSGrandfatherEnabled = req.GrandfatherEnabled
	config.GFSGrandfatherRetentionMonths = req.GrandfatherMonths

	if err := h.db.Save(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update GFS config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "GFS config updated successfully",
		"config":  config,
	})
}

func (h *RetentionHandler) ExecuteGFSCleanup(c *gin.Context) {
	var req struct {
		ConfigID uint `json:"config_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.executeGFSCleanupForConfig(req.ConfigID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "GFS cleanup completed",
		"result":  result,
	})
}

func (h *RetentionHandler) executeGFSCleanupForConfig(configID uint) (*GFSCleanupResult, error) {
	var config models.BackupConfig
	if err := h.db.First(&config, configID).Error; err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	result := &GFSCleanupResult{
		DeletedBackups: []uint{},
		Errors:         []string{},
	}

	var backups []models.Backup
	if err := h.db.Where("database_id = ? AND database_type = ?", config.DatabaseID, config.DatabaseType).
		Order("backup_time DESC").Find(&backups).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch backups: %w", err)
	}

	result.RetainedCount = len(backups)

	if config.GFSTierEnabled {
		sonCutoff := time.Now().AddDate(0, 0, -config.GFSSonRetentionDays)
		fatherCutoff := time.Now().AddDate(0, 0, -config.GFSFatherRetentionWeeks*7)
		grandfatherCutoff := time.Now().AddDate(0, -config.GFSGrandfatherRetentionMonths, 0)

		for _, backup := range backups {
			keep := false
			level := h.determineGFSLevel(backup, config)

			switch level {
			case models.GFSLevelGrandfather:
				if backup.BackupTime.After(grandfatherCutoff) || backup.BackupTime.Equal(grandfatherCutoff) {
					keep = true
				}
			case models.GFSLevelFather:
				if backup.BackupTime.After(fatherCutoff) || backup.BackupTime.Equal(fatherCutoff) {
					keep = true
				}
			case models.GFSLevelSon:
				if backup.BackupTime.After(sonCutoff) || backup.BackupTime.Equal(sonCutoff) {
					keep = true
				}
			}

			if !keep {
				if err := h.db.Delete(&backup).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("failed to delete backup %d: %v", backup.ID, err))
				} else {
					result.DeletedBackups = append(result.DeletedBackups, backup.ID)
					result.DeletedCount++
					result.RtainedCount--
				}
			}
		}
	} else {
		retentionCutoff := time.Now().AddDate(0, 0, -config.RetentionDays)
		for _, backup := range backups {
			if backup.BackupTime.Before(retentionCutoff) {
				if err := h.db.Delete(&backup).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("failed to delete backup %d: %v", backup.ID, err))
				} else {
					result.DeletedBackups = append(result.DeletedBackups, backup.ID)
					result.DeletedCount++
					result.RtainedCount--
				}
			}
		}
	}

	return result, nil
}

func (h *RetentionHandler) determineGFSLevel(backup models.Backup, config models.BackupConfig) models.GFSBackupLevel {
	backupTime := backup.BackupTime

	isYearStart := backupTime.Month() == time.January && backupTime.Day() == 1
	isMonthStart := backupTime.Day() <= 7
	isWeekStart := backupTime.Weekday() == time.Monday

	if config.GFSGrandfatherEnabled && isYearStart {
		return models.GFSLevelGrandfather
	}

	if config.GFSFatherEnabled && isMonthStart && isWeekStart {
		return models.GFSLevelFather
	}

	return models.GFSLevelSon
}

func (h *RetentionHandler) GetBackupGFSInfo(c *gin.Context) {
	backupID := c.Param("backup_id")
	var backup models.Backup
	if err := h.db.First(&backup, backupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	var config models.BackupConfig
	if err := h.db.Where("database_id = ? AND database_type = ?", backup.DatabaseID, backup.DatabaseType).First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	level := h.determineGFSLevel(backup, config)
	backupTime := backup.BackupTime

	info := models.BackupGFSInfo{
		BackupID:     backup.ID,
		DatabaseID:   backup.DatabaseID,
		Level:        level,
		BackupTime:   backupTime,
		IsYearlyBackup:  backupTime.Month() == time.January && backupTime.Day() == 1,
		IsMonthlyBackup: backupTime.Day() <= 7,
		IsWeeklyBackup:  backupTime.Weekday() == time.Monday,
	}

	c.JSON(http.StatusOK, gin.H{"gfs_info": info})
}

func (h *RetentionHandler) PreviewGFSCleanup(c *gin.Context) {
	var req struct {
		ConfigID uint `json:"config_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, req.ConfigID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	var backups []models.Backup
	if err := h.db.Where("database_id = ? AND database_type = ?", config.DatabaseID, config.DatabaseType).
		Order("backup_time DESC").Find(&backups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch backups"})
		return
	}

	type BackupPreview struct {
		ID          uint   `json:"id"`
		BackupTime  string `json:"backup_time"`
		Level       string `json:"level"`
		WillDelete  bool   `json:"will_delete"`
		Reason      string `json:"reason"`
	}

	previews := []BackupPreview{}

	if config.GFSTierEnabled {
		sonCutoff := time.Now().AddDate(0, 0, -config.GFSSonRetentionDays)
		fatherCutoff := time.Now().AddDate(0, 0, -config.GFSFatherRetentionWeeks*7)
		grandfatherCutoff := time.Now().AddDate(0, -config.GFSGrandfatherRetentionMonths, 0)

		for _, backup := range backups {
			level := h.determineGFSLevel(backup, config)
			willDelete := false
			reason := ""

			switch level {
			case models.GFSLevelGrandfather:
				if backup.BackupTime.Before(grandfatherCutoff) {
					willDelete = true
					reason = fmt.Sprintf("年度备份超过 %d 个月保留期", config.GFSGrandfatherRetentionMonths)
				}
			case models.GFSLevelFather:
				if backup.BackupTime.Before(fatherCutoff) {
					willDelete = true
					reason = fmt.Sprintf("月度备份超过 %d 周保留期", config.GFSFatherRetentionWeeks)
				}
			case models.GFSLevelSon:
				if backup.BackupTime.Before(sonCutoff) {
					willDelete = true
					reason = fmt.Sprintf("日/周备份超过 %d 天保留期", config.GFSSonRetentionDays)
				}
			}

			previews = append(previews, BackupPreview{
				ID:         backup.ID,
				BackupTime: backup.BackupTime.Format("2006-01-02 15:04:05"),
				Level:      string(level),
				WillDelete: willDelete,
				Reason:     reason,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"previews":        previews,
		"total_backups":   len(backups),
		"will_delete":     len(func() []BackupPreview {
			var deleted []BackupPreview
			for _, p := range previews {
				if p.WillDelete {
					deleted = append(deleted, p)
				}
			}
			return deleted
		}()),
	})
}
