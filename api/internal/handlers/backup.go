package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BackupHandler struct {
	db *gorm.DB
}

func NewBackupHandler(db *gorm.DB) *BackupHandler {
	return &BackupHandler{db: db}
}

type CreateBackupRequest struct {
	WorkspaceID  uint   `json:"workspace_id" binding:"required"`
	DatabaseID   uint   `json:"database_id" binding:"required"`
	DatabaseType string `json:"database_type" binding:"required"`
	BackupType   string `json:"backup_type" binding:"required"`
}

func (h *BackupHandler) GetAll(c *gin.Context) {
	var backups []models.Backup
	if err := h.db.Find(&backups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backups"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"backups": backups})
}

func (h *BackupHandler) Create(c *gin.Context) {
	var req CreateBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	backup := models.Backup{
		WorkspaceID:  req.WorkspaceID,
		DatabaseID:   req.DatabaseID,
		DatabaseType: req.DatabaseType,
		BackupType:   req.BackupType,
		Status:       "pending",
		BackupTime:   time.Now(),
	}

	if err := h.db.Create(&backup).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup"})
		return
	}

	if sched := scheduler.GetScheduler(); sched != nil {
		sched.EnqueueBackupTask(&backup)
	}

	c.JSON(http.StatusCreated, gin.H{"backup": backup})
}

func (h *BackupHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}

	var backup models.Backup
	if err := h.db.First(&backup, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"backup": backup})
}

func (h *BackupHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}

	if err := h.db.Delete(&models.Backup{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete backup"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup deleted successfully"})
}
