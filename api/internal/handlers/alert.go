package handlers

import (
	"net/http"
	"strconv"

	"github.com/databasus-new/api/internal/models"
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