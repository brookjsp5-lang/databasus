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

// 内存存储恢复信息
type memoryRestoreStorage struct {
	restores map[uint]*models.Restore
	mutex    sync.RWMutex
	nextID   uint
}

var (
	restoreMemStorage = &memoryRestoreStorage{
		restores: make(map[uint]*models.Restore),
		nextID:   1,
	}
)

// RestoreHandler 恢复处理器
type RestoreHandler struct {
	db *gorm.DB
}

// NewRestoreHandler 创建恢复处理器
func NewRestoreHandler(db *gorm.DB) *RestoreHandler {
	return &RestoreHandler{db: db}
}

// CreateRestoreRequest 创建恢复请求
type CreateRestoreRequest struct {
	WorkspaceID  uint       `json:"workspace_id" binding:"required"`
	BackupID     uint       `json:"backup_id" binding:"required"`
	DatabaseID   uint       `json:"database_id" binding:"required"`
	DatabaseType string     `json:"database_type" binding:"required"`
	PITRTime     *time.Time `json:"pitr_time"`
}

// GetAll 获取所有恢复
func (h *RestoreHandler) GetAll(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		restoreMemStorage.mutex.RLock()
		var restores []models.Restore
		for _, restore := range restoreMemStorage.restores {
			restores = append(restores, *restore)
		}
		restoreMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"restores": restores})
		return
	}

	var restores []models.Restore
	if err := h.db.Find(&restores).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get restores"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"restores": restores})
}

// Create 创建恢复
func (h *RestoreHandler) Create(c *gin.Context) {
	var req CreateRestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	restore := models.Restore{
		WorkspaceID:  req.WorkspaceID,
		BackupID:     req.BackupID,
		DatabaseID:   req.DatabaseID,
		DatabaseType: req.DatabaseType,
		Status:       "pending",
		RestoreTime:  time.Now(),
		PITRTime:     req.PITRTime,
	}

	if h.db == nil {
		// 使用内存存储
		restoreMemStorage.mutex.Lock()
		restore.ID = restoreMemStorage.nextID
		restoreMemStorage.restores[restore.ID] = &restore
		restoreMemStorage.nextID++
		restoreMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"restore": restore})
		return
	}

	if err := h.db.Create(&restore).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create restore"})
		return
	}

	if sched := scheduler.GetScheduler(); sched != nil {
		sched.EnqueueRestoreTask(&restore)
	}

	c.JSON(http.StatusCreated, gin.H{"restore": restore})
}

// GetByID 根据ID获取恢复
func (h *RestoreHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		restoreMemStorage.mutex.RLock()
		restore, exists := restoreMemStorage.restores[uint(id)]
		restoreMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"restore": restore})
		return
	}

	var restore models.Restore
	if err := h.db.First(&restore, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"restore": restore})
}