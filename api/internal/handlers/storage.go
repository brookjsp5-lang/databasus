package handlers

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 内存存储存储信息
type memoryStorageStorage struct {
	storages map[uint]*models.Storage
	mutex    sync.RWMutex
	nextID   uint
}

var (
	storageMemStorage = &memoryStorageStorage{
		storages: make(map[uint]*models.Storage),
		nextID:   1,
	}
)

// StorageHandler 存储处理器
type StorageHandler struct {
	db *gorm.DB
}

// NewStorageHandler 创建存储处理器
func NewStorageHandler(db *gorm.DB) *StorageHandler {
	return &StorageHandler{db: db}
}

// CreateStorageRequest 创建存储请求
type CreateStorageRequest struct {
	WorkspaceID uint   `json:"workspace_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Type        string `json:"type" binding:"required"`
	Config      string `json:"config" binding:"required"`
}

// UpdateStorageRequest 更新存储请求
type UpdateStorageRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Config string `json:"config" binding:"required"`
}

// GetAll 获取所有存储
func (h *StorageHandler) GetAll(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		storageMemStorage.mutex.RLock()
		var storages []models.Storage
		for _, storage := range storageMemStorage.storages {
			storages = append(storages, *storage)
		}
		storageMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"storages": storages})
		return
	}

	var storages []models.Storage
	if err := h.db.Find(&storages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get storages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storages": storages})
}

// Create 创建存储
func (h *StorageHandler) Create(c *gin.Context) {
	var req CreateStorageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	storage := models.Storage{
		WorkspaceID: req.WorkspaceID,
		Name:        req.Name,
		Type:        req.Type,
		Config:      req.Config,
	}

	if h.db == nil {
		// 使用内存存储
		storageMemStorage.mutex.Lock()
		storage.ID = storageMemStorage.nextID
		storageMemStorage.storages[storage.ID] = &storage
		storageMemStorage.nextID++
		storageMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"storage": storage})
		return
	}

	if err := h.db.Create(&storage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create storage"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"storage": storage})
}

// GetByID 根据ID获取存储
func (h *StorageHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid storage ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		storageMemStorage.mutex.RLock()
		storage, exists := storageMemStorage.storages[uint(id)]
		storageMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"storage": storage})
		return
	}

	var storage models.Storage
	if err := h.db.First(&storage, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storage": storage})
}

// Update 更新存储
func (h *StorageHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid storage ID"})
		return
	}

	var req UpdateStorageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.db == nil {
		// 使用内存存储
		storageMemStorage.mutex.Lock()
		storage, exists := storageMemStorage.storages[uint(id)]
		if !exists {
			storageMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
			return
		}
		storage.Name = req.Name
		storage.Type = req.Type
		storage.Config = req.Config
		storageMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"storage": storage})
		return
	}

	var storage models.Storage
	if err := h.db.First(&storage, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
		return
	}

	storage.Name = req.Name
	storage.Type = req.Type
	storage.Config = req.Config

	if err := h.db.Save(&storage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update storage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storage": storage})
}

// Delete 删除存储
func (h *StorageHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid storage ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		storageMemStorage.mutex.Lock()
		_, exists := storageMemStorage.storages[uint(id)]
		if !exists {
			storageMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
			return
		}
		delete(storageMemStorage.storages, uint(id))
		storageMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "Storage deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.Storage{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete storage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Storage deleted successfully"})
}