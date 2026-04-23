package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type StorageHandler struct {
	db *gorm.DB
}

func NewStorageHandler(db *gorm.DB) *StorageHandler {
	return &StorageHandler{db: db}
}

type CreateStorageRequest struct {
	WorkspaceID uint                  `json:"workspace_id" binding:"required"`
	Name       string                `json:"name" binding:"required"`
	Type       string                `json:"type" binding:"required"`
	Config     map[string]interface{} `json:"config" binding:"required"`
}

type UpdateStorageRequest struct {
	Name   string                `json:"name" binding:"required"`
	Type   string                `json:"type" binding:"required"`
	Config map[string]interface{} `json:"config" binding:"required"`
}

func (h *StorageHandler) GetAll(c *gin.Context) {
	var storages []models.Storage
	if err := h.db.Find(&storages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get storages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storages": storages})
}

func (h *StorageHandler) Create(c *gin.Context) {
	var req CreateStorageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	configJSON, _ := json.Marshal(req.Config)

	storage := models.Storage{
		WorkspaceID: req.WorkspaceID,
		Name:        req.Name,
		Type:        req.Type,
		Config:      string(configJSON),
	}

	if err := h.db.Create(&storage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create storage"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"storage": storage})
}

func (h *StorageHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid storage ID"})
		return
	}

	var storage models.Storage
	if err := h.db.First(&storage, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storage": storage})
}

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

	var storage models.Storage
	if err := h.db.First(&storage, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Storage not found"})
		return
	}

	storage.Name = req.Name
	storage.Type = req.Type
	configJSON, _ := json.Marshal(req.Config)
	storage.Config = string(configJSON)

	if err := h.db.Save(&storage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update storage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"storage": storage})
}

func (h *StorageHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid storage ID"})
		return
	}

	if err := h.db.Delete(&models.Storage{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete storage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Storage deleted successfully"})
}
