package handlers

import (
	"net/http"
	"strconv"

	"github.com/datatrue-new/api/internal/models"
	"github.com/datatrue-new/api/pkg/notification"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SettingsHandler struct {
	db           *gorm.DB
	smtpService  *notification.SMTPService
}

func NewSettingsHandler(db *gorm.DB) *SettingsHandler {
	return &SettingsHandler{
		db:          db,
		smtpService: notification.NewSMTPService(db),
	}
}

type SystemSettingRequest struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value" binding:"required"`
	Type  string `json:"type"`
}

type SMTPConfigRequest struct {
	Host        string `json:"host" binding:"required"`
	Port        int    `json:"port" binding:"required"`
	Username    string `json:"username" binding:"required"`
	Password    string `json:"password" binding:"required"`
	Encryption  string `json:"encryption" binding:"required"`
	FromAddress string `json:"from_address" binding:"required"`
	FromName    string `json:"from_name" binding:"required"`
	IsEnabled   bool   `json:"is_enabled"`
}

type TestEmailRequest struct {
	ToAddress string `json:"to_address" binding:"required"`
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

func (h *SettingsHandler) GetSMTPConfig(c *gin.Context) {
	config, err := h.smtpService.GetConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get SMTP config"})
		return
	}

	config.Password = ""
	c.JSON(http.StatusOK, gin.H{"smtp_config": config})
}

func (h *SettingsHandler) SaveSMTPConfig(c *gin.Context) {
	var req SMTPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Port < 1 || req.Port > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid port number"})
		return
	}

	if req.Encryption != "none" && req.Encryption != "tls" && req.Encryption != "ssl" && req.Encryption != "starttls" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid encryption type. Must be: none, tls, ssl, or starttls"})
		return
	}

	config := notification.SMTPConfig{
		Host:        req.Host,
		Port:        req.Port,
		Username:    req.Username,
		Password:    req.Password,
		Encryption:  req.Encryption,
		FromAddress: req.FromAddress,
		FromName:    req.FromName,
		IsEnabled:   req.IsEnabled,
	}

	if err := h.smtpService.SaveConfig(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save SMTP config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP config saved successfully"})
}

func (h *SettingsHandler) TestSMTPConnection(c *gin.Context) {
	var req SMTPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := notification.SMTPConfig{
		Host:        req.Host,
		Port:        req.Port,
		Username:    req.Username,
		Password:    req.Password,
		Encryption:  req.Encryption,
		FromAddress: req.FromAddress,
		FromName:    req.FromName,
		IsEnabled:   true,
	}

	if err := h.smtpService.TestConnection(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP connection test successful", "success": true})
}

func (h *SettingsHandler) TestEmail(c *gin.Context) {
	var req TestEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, err := h.smtpService.GetConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "SMTP not configured"})
		return
	}

	if !config.IsEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP is not enabled"})
		return
	}

	config.Password = ""

	emailNotifier := notification.NewEmailNotifier(*config)
	if err := emailNotifier.Test(req.ToAddress); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Test email sent successfully", "success": true})
}