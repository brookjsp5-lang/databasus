package handlers

import (
	"net/http"
	"strconv"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SettingsHandler struct {
	db *gorm.DB
}

func NewSettingsHandler(db *gorm.DB) *SettingsHandler {
	return &SettingsHandler{db: db}
}

type SystemSettingRequest struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value" binding:"required"`
	Type  string `json:"type"`
}

func (h *SettingsHandler) GetAll(c *gin.Context) {
	var settings []models.SystemSetting

	if err := h.db.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{"settings": result})
}

func (h *SettingsHandler) GetByKey(c *gin.Context) {
	key := c.Param("key")

	var setting models.SystemSetting
	if err := h.db.Where("key = ?", key).First(&setting).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Setting not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"setting": setting})
}

func (h *SettingsHandler) Set(c *gin.Context) {
	var req SystemSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settingType := req.Type
	if settingType == "" {
		settingType = "string"
	}

	setting := models.SystemSetting{
		Key:   req.Key,
		Value: req.Value,
		Type:  settingType,
	}

	result := h.db.Where("key = ?", req.Key).Assign(setting).FirstOrCreate(&setting)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save setting"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"setting": setting})
}

func (h *SettingsHandler) Delete(c *gin.Context) {
	key := c.Param("key")

	if err := h.db.Where("key = ?", key).Delete(&models.SystemSetting{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete setting"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Setting deleted"})
}

func (h *SettingsHandler) GetAlertSettings(c *gin.Context) {
	keys := []string{
		"alert_email_enabled",
		"alert_email",
		"alert_dingtalk_enabled",
		"alert_dingtalk_webhook",
	}

	var settings []models.SystemSetting
	if err := h.db.Where("key IN ?", keys).Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get alert settings"})
		return
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{"settings": result})
}

func (h *SettingsHandler) SetAlertSettings(c *gin.Context) {
	var req struct {
		AlertEmailEnabled    bool   `json:"alert_email_enabled"`
		AlertEmail          string `json:"alert_email"`
		AlertDingtalkEnabled bool  `json:"alert_dingtalk_enabled"`
		AlertDingtalkWebhook string `json:"alert_dingtalk_webhook"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings := []models.SystemSetting{
		{Key: "alert_email_enabled", Value: boolToString(req.AlertEmailEnabled), Type: "boolean"},
		{Key: "alert_email", Value: req.AlertEmail, Type: "string"},
		{Key: "alert_dingtalk_enabled", Value: boolToString(req.AlertDingtalkEnabled), Type: "boolean"},
		{Key: "alert_dingtalk_webhook", Value: req.AlertDingtalkWebhook, Type: "string"},
	}

	for _, s := range settings {
		h.db.Where("key = ?", s.Key).Assign(s).FirstOrCreate(&s)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert settings saved"})
}

func (h *SettingsHandler) GetBackupSettings(c *gin.Context) {
	keys := []string{
		"backup_storage_path",
		"backup_retention_days",
		"backup_compression_enabled",
	}

	var settings []models.SystemSetting
	if err := h.db.Where("key IN ?", keys).Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backup settings"})
		return
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{"settings": result})
}

func (h *SettingsHandler) SetBackupSettings(c *gin.Context) {
	var req struct {
		BackupStoragePath       string `json:"backup_storage_path"`
		BackupRetentionDays     int    `json:"backup_retention_days"`
		BackupCompressionEnabled bool   `json:"backup_compression_enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	storagePath := "/tmp/backups"
	if req.BackupStoragePath != "" {
		storagePath = req.BackupStoragePath
	}

	retentionDays := 7
	if req.BackupRetentionDays > 0 {
		retentionDays = req.BackupRetentionDays
	}

	settings := []models.SystemSetting{
		{Key: "backup_storage_path", Value: storagePath, Type: "string"},
		{Key: "backup_retention_days", Value: intToString(retentionDays), Type: "number"},
		{Key: "backup_compression_enabled", Value: boolToString(req.BackupCompressionEnabled), Type: "boolean"},
	}

	for _, s := range settings {
		h.db.Where("key = ?", s.Key).Assign(s).FirstOrCreate(&s)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup settings saved"})
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func intToString(i int) string {
	return strconv.Itoa(i)
}