package handlers

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 内存存储备份配置信息
type memoryBackupConfigStorage struct {
	configs map[uint]*models.BackupConfig
	mutex   sync.RWMutex
	nextID  uint
}

var (
	backupConfigMemStorage = &memoryBackupConfigStorage{
		configs: make(map[uint]*models.BackupConfig),
		nextID:  1,
	}
)

// BackupConfigHandler 备份配置处理器
type BackupConfigHandler struct {
	db *gorm.DB
}

// NewBackupConfigHandler 创建备份配置处理器
func NewBackupConfigHandler(db *gorm.DB) *BackupConfigHandler {
	return &BackupConfigHandler{db: db}
}

// CreateBackupConfigRequest 创建备份配置请求
type CreateBackupConfigRequest struct {
	WorkspaceID     uint   `json:"workspace_id" binding:"required"`
	DatabaseID      uint   `json:"database_id" binding:"required"`
	DatabaseType    string `json:"database_type" binding:"required"`
	BackupType      string `json:"backup_type" binding:"required"`
	CronExpression  string `json:"cron_expression" binding:"required"`
	RetentionDays   int    `json:"retention_days" binding:"required,min=1"`
	IsEnabled       bool   `json:"is_enabled"`
}

// UpdateBackupConfigRequest 更新备份配置请求
type UpdateBackupConfigRequest struct {
	DatabaseID      uint   `json:"database_id" binding:"required"`
	DatabaseType    string `json:"database_type" binding:"required"`
	BackupType      string `json:"backup_type" binding:"required"`
	CronExpression  string `json:"cron_expression" binding:"required"`
	RetentionDays   int    `json:"retention_days" binding:"required,min=1"`
	IsEnabled       bool   `json:"is_enabled"`
}

// GetAll 获取所有备份配置
func (h *BackupConfigHandler) GetAll(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		backupConfigMemStorage.mutex.RLock()
		var configs []models.BackupConfig
		for _, config := range backupConfigMemStorage.configs {
			configs = append(configs, *config)
		}
		backupConfigMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"configs": configs})
		return
	}

	var configs []models.BackupConfig
	if err := h.db.Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backup configs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"configs": configs})
}

// Create 创建备份配置
func (h *BackupConfigHandler) Create(c *gin.Context) {
	var req CreateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := models.BackupConfig{
		WorkspaceID:     req.WorkspaceID,
		DatabaseID:      req.DatabaseID,
		DatabaseType:    req.DatabaseType,
		BackupType:      req.BackupType,
		CronExpression:  req.CronExpression,
		RetentionDays:   req.RetentionDays,
		IsEnabled:       req.IsEnabled,
	}

	if h.db == nil {
		// 使用内存存储
		backupConfigMemStorage.mutex.Lock()
		config.ID = backupConfigMemStorage.nextID
		backupConfigMemStorage.configs[config.ID] = &config
		backupConfigMemStorage.nextID++
		backupConfigMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"config": config})
		return
	}

	if err := h.db.Create(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup config"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"config": config})
}

// GetByID 根据ID获取备份配置
func (h *BackupConfigHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		backupConfigMemStorage.mutex.RLock()
		config, exists := backupConfigMemStorage.configs[uint(id)]
		backupConfigMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"config": config})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// Update 更新备份配置
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

	if h.db == nil {
		// 使用内存存储
		backupConfigMemStorage.mutex.Lock()
		config, exists := backupConfigMemStorage.configs[uint(id)]
		if !exists {
			backupConfigMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
			return
		}
		config.DatabaseID = req.DatabaseID
		config.DatabaseType = req.DatabaseType
		config.BackupType = req.BackupType
		config.CronExpression = req.CronExpression
		config.RetentionDays = req.RetentionDays
		config.IsEnabled = req.IsEnabled
		backupConfigMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"config": config})
		return
	}

	var config models.BackupConfig
	if err := h.db.First(&config, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
		return
	}

	config.DatabaseID = req.DatabaseID
	config.DatabaseType = req.DatabaseType
	config.BackupType = req.BackupType
	config.CronExpression = req.CronExpression
	config.RetentionDays = req.RetentionDays
	config.IsEnabled = req.IsEnabled

	if err := h.db.Save(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update backup config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// Delete 删除备份配置
func (h *BackupConfigHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		backupConfigMemStorage.mutex.Lock()
		_, exists := backupConfigMemStorage.configs[uint(id)]
		if !exists {
			backupConfigMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Backup config not found"})
			return
		}
		delete(backupConfigMemStorage.configs, uint(id))
		backupConfigMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "Backup config deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.BackupConfig{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete backup config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup config deleted successfully"})
}