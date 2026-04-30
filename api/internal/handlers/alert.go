package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/datatrue-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AlertHandler struct {
	db *gorm.DB
}

func NewAlertHandler(db *gorm.DB) *AlertHandler {
	return &AlertHandler{db: db}
}

func (h *AlertHandler) GetAll(c *gin.Context) {
	var alerts []models.Alert
	query := h.db.Model(&models.Alert{})

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if level := c.Query("level"); level != "" {
		query = query.Where("level = ?", level)
	}

	if isRead := c.Query("is_read"); isRead != "" {
		query = query.Where("is_read = ?", isRead)
	}

	if err := query.Order("created_at DESC").Find(&alerts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (h *AlertHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	var alert models.Alert
	if err := h.db.First(&alert, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alert": alert})
}

func (h *AlertHandler) MarkAsRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	if err := h.db.Model(&models.Alert{}).Where("id = ?", id).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark alert as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert marked as read"})
}

func (h *AlertHandler) MarkAllAsRead(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	query := h.db.Model(&models.Alert{}).Where("is_read = ?", false)

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark alerts as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All alerts marked as read"})
}

func (h *AlertHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	if err := h.db.Delete(&models.Alert{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert deleted"})
}

func (h *AlertHandler) GetUnreadCount(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	query := h.db.Model(&models.Alert{}).Where("is_read = ?", false)

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}

type AlertPreferences struct {
	EmailEnabled    bool   `json:"email_enabled"`
	DingtalkEnabled bool   `json:"dingtalk_enabled"`
	WechatEnabled   bool   `json:"wechat_enabled"`
	MinAlertLevel   string `json:"min_alert_level"`
	AlertFrequency  string `json:"alert_frequency"`
}

type alertPreferencesRequest struct {
	Preferences *AlertPreferences `json:"preferences"`
	AlertPreferences
}

func getWorkspaceID(c *gin.Context) uint {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		return 1
	}

	id, err := strconv.ParseUint(workspaceID, 10, 32)
	if err != nil || id == 0 {
		return 1
	}

	return uint(id)
}

func defaultAlertPreferences() AlertPreferences {
	return AlertPreferences{
		EmailEnabled:    true,
		DingtalkEnabled: false,
		WechatEnabled:   false,
		MinAlertLevel:   "warning",
		AlertFrequency:  "immediate",
	}
}

func (h *AlertHandler) GetPreferences(c *gin.Context) {
	workspaceID := getWorkspaceID(c)

	prefs := defaultAlertPreferences()
	var setting models.SystemSetting

	if err := h.db.Where("key = ? AND workspace_id = ?", "alert_preferences", workspaceID).First(&setting).Error; err == nil {
		if setting.Type == "json" {
			json.Unmarshal([]byte(setting.Value), &prefs)
		}
	}

	c.JSON(http.StatusOK, gin.H{"preferences": prefs})
}

func (h *AlertHandler) SavePreferences(c *gin.Context) {
	workspaceID := getWorkspaceID(c)

	var req alertPreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	prefs := req.AlertPreferences
	if req.Preferences != nil {
		prefs = *req.Preferences
	}

	prefsJSON, _ := json.Marshal(prefs)

	setting := models.SystemSetting{
		Key:         "alert_preferences",
		Value:       string(prefsJSON),
		Type:        "json",
		WorkspaceID: workspaceID,
	}

	h.db.Where("key = ? AND workspace_id = ?", "alert_preferences", workspaceID).Assign(&setting).FirstOrCreate(&setting)

	c.JSON(http.StatusOK, gin.H{"message": "Preferences saved successfully", "preferences": prefs})
}
