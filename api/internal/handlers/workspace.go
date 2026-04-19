package handlers

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 内存存储工作空间信息
type memoryWorkspaceStorage struct {
	workspaces map[uint]*models.Workspace
	mutex      sync.RWMutex
	nextID     uint
}

var (
	workspaceMemStorage = &memoryWorkspaceStorage{
		workspaces: make(map[uint]*models.Workspace),
		nextID:     1,
	}
)

// WorkspaceHandler 工作空间处理器
type WorkspaceHandler struct {
	db *gorm.DB
}

// NewWorkspaceHandler 创建工作空间处理器
func NewWorkspaceHandler(db *gorm.DB) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

// CreateWorkspaceRequest 创建工作空间请求
type CreateWorkspaceRequest struct {
	Name string `json:"name" binding:"required,min=3,max=100"`
}

// UpdateWorkspaceRequest 更新工作空间请求
type UpdateWorkspaceRequest struct {
	Name string `json:"name" binding:"required,min=3,max=100"`
}

// GetAll 获取所有工作空间
func (h *WorkspaceHandler) GetAll(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		workspaceMemStorage.mutex.RLock()
		var workspaces []models.Workspace
		for _, workspace := range workspaceMemStorage.workspaces {
			workspaces = append(workspaces, *workspace)
		}
		workspaceMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"workspaces": workspaces})
		return
	}

	var workspaces []models.Workspace
	if err := h.db.Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get workspaces"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspaces": workspaces})
}

// Create 创建工作空间
func (h *WorkspaceHandler) Create(c *gin.Context) {
	var req CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspace := models.Workspace{
		Name: req.Name,
	}

	if h.db == nil {
		// 使用内存存储
		workspaceMemStorage.mutex.Lock()
		workspace.ID = workspaceMemStorage.nextID
		workspaceMemStorage.workspaces[workspace.ID] = &workspace
		workspaceMemStorage.nextID++
		workspaceMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"workspace": workspace})
		return
	}

	if err := h.db.Create(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"workspace": workspace})
}

// GetByID 根据ID获取工作空间
func (h *WorkspaceHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		workspaceMemStorage.mutex.RLock()
		workspace, exists := workspaceMemStorage.workspaces[uint(id)]
		workspaceMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"workspace": workspace})
		return
	}

	var workspace models.Workspace
	if err := h.db.First(&workspace, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

// Update 更新工作空间
func (h *WorkspaceHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	var req UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.db == nil {
		// 使用内存存储
		workspaceMemStorage.mutex.Lock()
		workspace, exists := workspaceMemStorage.workspaces[uint(id)]
		if !exists {
			workspaceMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		workspace.Name = req.Name
		workspaceMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"workspace": workspace})
		return
	}

	var workspace models.Workspace
	if err := h.db.First(&workspace, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	workspace.Name = req.Name

	if err := h.db.Save(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

// Delete 删除工作空间
func (h *WorkspaceHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		workspaceMemStorage.mutex.Lock()
		_, exists := workspaceMemStorage.workspaces[uint(id)]
		if !exists {
			workspaceMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		delete(workspaceMemStorage.workspaces, uint(id))
		workspaceMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "Workspace deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.Workspace{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Workspace deleted successfully"})
}