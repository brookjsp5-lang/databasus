package handlers

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 内存存储备份信息
type memoryBackupStorage struct {
	backups map[uint]*models.Backup
	mutex   sync.RWMutex
	nextID  uint
}

var (
	backupMemStorage = &memoryBackupStorage{
		backups: make(map[uint]*models.Backup),
		nextID:  1,
	}
)

// BackupHandler 备份处理器
type BackupHandler struct {
	db *gorm.DB
}

// NewBackupHandler 创建备份处理器
func NewBackupHandler(db *gorm.DB) *BackupHandler {
	return &BackupHandler{db: db}
}

// CreateBackupRequest 创建备份请求
type CreateBackupRequest struct {
	WorkspaceID  uint   `json:"workspace_id" binding:"required"`
	DatabaseID   uint   `json:"database_id" binding:"required"`
	DatabaseType string `json:"database_type" binding:"required"`
	BackupType   string `json:"backup_type" binding:"required"`
}

// GetAll 获取所有备份
func (h *BackupHandler) GetAll(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		backupMemStorage.mutex.RLock()
		var backups []models.Backup
		for _, backup := range backupMemStorage.backups {
			backups = append(backups, *backup)
		}
		backupMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"backups": backups})
		return
	}
	var backups []models.Backup
	if err := h.db.Find(&backups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backups"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"backups": backups})
}

// Create 创建备份
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

	if h.db == nil {
		// 使用内存存储
		backupMemStorage.mutex.Lock()
		backup.ID = backupMemStorage.nextID
		backupMemStorage.backups[backup.ID] = &backup
		backupMemStorage.nextID++
		backupMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"backup": backup})
		return
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

// GetByID 根据ID获取备份
func (h *BackupHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		backupMemStorage.mutex.RLock()
		backup, exists := backupMemStorage.backups[uint(id)]
		backupMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"backup": backup})
		return
	}

	var backup models.Backup
	if err := h.db.First(&backup, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"backup": backup})
}

// Delete 删除备份
func (h *BackupHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		backupMemStorage.mutex.Lock()
		_, exists := backupMemStorage.backups[uint(id)]
		if !exists {
			backupMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
			return
		}
		delete(backupMemStorage.backups, uint(id))
		backupMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "Backup deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.Backup{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete backup"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup deleted successfully"})
}