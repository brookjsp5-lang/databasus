package handlers

import (
	"net/http"
	"strconv"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BackupConfigHandler struct {
	db *gorm.DB
}

func NewBackupConfigHandler(db *gorm.DB) *BackupConfigHandler {
	return &BackupConfigHandler{db: db}
}

type CreateBackupConfigRequest struct {
	Name            string `json:"name" binding:"required"`
	WorkspaceID     uint   `json:"workspace_id" binding:"required"`
	DatabaseID      uint   `json:"database_id" binding:"required"`
	DatabaseType    string `json:"database_type" binding:"required"`
	StorageID       uint   `json:"storage_id" binding:"required"`
	BackupType      string `json:"backup_type" binding:"required"`
	ScheduleType    string `json:"schedule_type"`
	CronExpression  string `json:"cron_expression" binding:"required"`
	RetentionType   string `json:"retention_type"`
	RetentionDays   int    `json:"retention_days" binding:"min=1"`
	RetentionCount  int    `json:"retention_count"`
	Compress        bool   `json:"compress"`
	CompressLevel   int    `json:"compress_level"`
	EncryptionEnabled bool `json:"encryption_enabled"`
	EncryptionKey   string `json:"encryption_key,omitempty"`
	EmailEnabled    bool   `json:"email_enabled"`
	Email           string `json:"email,omitempty"`
	WebhookEnabled  bool   `json:"webhook_enabled"`
	WebhookURL      string `json:"webhook_url,omitempty"`
	NotifyOnSuccess bool   `json:"notify_on_success"`
	NotifyOnFailure bool   `json:"notify_on_failure"`
	IsEnabled       bool   `json:"is_enabled"`
}

type UpdateBackupConfigRequest struct {
	Name            string `json:"name" binding:"required"`
	DatabaseID      uint   `json:"database_id" binding:"required"`
	DatabaseType    string `json:"database_type" binding:"required"`
	StorageID       uint   `json:"storage_id" binding:"required"`
	BackupType      string `json:"backup_type" binding:"required"`
	ScheduleType    string `json:"schedule_type"`
	CronExpression  string `json:"cron_expression" binding:"required"`
	RetentionType   string `json:"retention_type"`
	RetentionDays   int    `json:"retention_days" binding:"min=1"`
	RetentionCount  int    `json:"retention_count"`
	Compress        bool   `json:"compress"`
	CompressLevel   int    `json:"compress_level"`
	EncryptionEnabled bool `json:"encryption_enabled"`
	EncryptionKey   string `json:"encryption_key,omitempty"`
	EmailEnabled    bool   `json:"email_enabled"`
	Email           string `json:"email,omitempty"`
	WebhookEnabled  bool   `json:"webhook_enabled"`
	WebhookURL      string `json:"webhook_url,omitempty"`
	NotifyOnSuccess bool   `json:"notify_on_success"`
	NotifyOnFailure bool   `json:"notify_on_failure"`
	IsEnabled       bool   `json:"is_enabled"`
}

func (h *BackupConfigHandler) GetAll(c *gin.Context) {
	var configs []models.BackupConfig
	if err := h.db.Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backup configs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"configs": configs})
}

func (h *BackupConfigHandler) Create(c *gin.Context) {
	var req CreateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := models.BackupConfig{
		Name:              req.Name,
		WorkspaceID:       req.WorkspaceID,
		DatabaseID:        req.DatabaseID,
		DatabaseType:      req.DatabaseType,
		StorageID:         req.StorageID,
		BackupType:        req.BackupType,
		ScheduleType:      req.ScheduleType,
		CronExpression:    req.CronExpression,
		RetentionType:     req.RetentionType,
		RetentionDays:     req.RetentionDays,
		RetentionCount:    req.RetentionCount,
		Compress:          req.Compress,
		CompressLevel:     req.CompressLevel,
		EncryptionEnabled: req.EncryptionEnabled,
		EncryptionKey:     req.EncryptionKey,
		EmailEnabled:      req.EmailEnabled,
		Email:             req.Email,
		WebhookEnabled:    req.WebhookEnabled,
		WebhookURL:        req.WebhookURL,
		NotifyOnSuccess:   req.NotifyOnSuccess,
		NotifyOnFailure:   req.NotifyOnFailure,
		IsEnabled:        req.IsEnabled,
	}

	if err := h.db.Create(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup config"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"config": config})
}

func (h *BackupConfigHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

func (h *BackupConfigHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	var req UpdateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	config.Name = req.Name
	config.DatabaseID = req.DatabaseID
	config.DatabaseType = req.DatabaseType
	config.StorageID = req.StorageID
	config.BackupType = req.BackupType
	config.ScheduleType = req.ScheduleType
	config.CronExpression = req.CronExpression
	config.RetentionType = req.RetentionType
	config.RetentionDays = req.RetentionDays
	config.RetentionCount = req.RetentionCount
	config.Compress = req.Compress
	config.CompressLevel = req.CompressLevel
	config.EncryptionEnabled = req.EncryptionEnabled
	config.EncryptionKey = req.EncryptionKey
	config.EmailEnabled = req.EmailEnabled
	config.Email = req.Email
	config.WebhookEnabled = req.WebhookEnabled
	config.WebhookURL = req.WebhookURL
	config.NotifyOnSuccess = req.NotifyOnSuccess
	config.NotifyOnFailure = req.NotifyOnFailure
	config.IsEnabled = req.IsEnabled

	if err := h.db.Save(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update backup config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

func (h *BackupConfigHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	if err := h.db.Delete(&models.BackupConfig{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete backup config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup config deleted successfully"})
}
