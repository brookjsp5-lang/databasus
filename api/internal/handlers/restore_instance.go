package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"time"

	"github.com/datatrue-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RestoreInstanceHandler struct {
	db *gorm.DB
}

func NewRestoreInstanceHandler(db *gorm.DB) *RestoreInstanceHandler {
	return &RestoreInstanceHandler{db: db}
}

type CreateRestoreInstanceRequest struct {
	WorkspaceID   uint   `json:"workspace_id" binding:"required"`
	Name          string `json:"name" binding:"required"`
	DatabaseType  string `json:"database_type" binding:"required,oneof=mysql postgresql"`
	Host          string `json:"host" binding:"required"`
	Port          int    `json:"port" binding:"required,min=1,max=65535"`
	User          string `json:"user" binding:"required"`
	Password      string `json:"password" binding:"required"`
	DatabaseName  string `json:"database_name" binding:"required"`
	EngineVersion string `json:"engine_version"`
}

type UpdateRestoreInstanceRequest struct {
	Name          string `json:"name" binding:"required"`
	DatabaseType  string `json:"database_type" binding:"required,oneof=mysql postgresql"`
	Host          string `json:"host" binding:"required"`
	Port          int    `json:"port" binding:"required,min=1,max=65535"`
	User          string `json:"user" binding:"required"`
	Password      string `json:"password"`
	DatabaseName  string `json:"database_name" binding:"required"`
	EngineVersion string `json:"engine_version"`
}

type TestRestoreInstanceRequest struct {
	DatabaseType string `json:"database_type" binding:"required,oneof=mysql postgresql"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port" binding:"required,min=1,max=65535"`
	User         string `json:"user" binding:"required"`
	Password     string `json:"password" binding:"required"`
	DatabaseName string `json:"database_name" binding:"required"`
}

func (h *RestoreInstanceHandler) GetAll(c *gin.Context) {
	var instances []models.RestoreInstance
	if err := h.db.Order("created_at desc").Find(&instances).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get restore instances"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"instances": instances})
}

func (h *RestoreInstanceHandler) Create(c *gin.Context) {
	var req CreateRestoreInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	instance := models.RestoreInstance{
		WorkspaceID:   req.WorkspaceID,
		Name:          req.Name,
		DatabaseType:  req.DatabaseType,
		Host:          req.Host,
		Port:          req.Port,
		User:          req.User,
		Password:      req.Password,
		DatabaseName:  req.DatabaseName,
		EngineVersion: req.EngineVersion,
	}

	if err := h.db.Create(&instance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create restore instance"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"instance": instance})
}

func (h *RestoreInstanceHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore instance ID"})
		return
	}

	var instance models.RestoreInstance
	if err := h.db.First(&instance, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore instance not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"instance": instance})
}

func (h *RestoreInstanceHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore instance ID"})
		return
	}

	var req UpdateRestoreInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var instance models.RestoreInstance
	if err := h.db.First(&instance, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore instance not found"})
		return
	}

	instance.Name = req.Name
	instance.DatabaseType = req.DatabaseType
	instance.Host = req.Host
	instance.Port = req.Port
	instance.User = req.User
	instance.DatabaseName = req.DatabaseName
	instance.EngineVersion = req.EngineVersion
	if req.Password != "" {
		instance.Password = req.Password
	}

	if err := h.db.Save(&instance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update restore instance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"instance": instance})
}

func (h *RestoreInstanceHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore instance ID"})
		return
	}

	if err := h.db.Delete(&models.RestoreInstance{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete restore instance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Restore instance deleted successfully"})
}

func (h *RestoreInstanceHandler) TestConnection(c *gin.Context) {
	var req TestRestoreInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "success": false})
		return
	}

	if err := testRestoreInstanceConnection(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "success": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Restore instance connection successful", "success": true})
}

func testRestoreInstanceConnection(req TestRestoreInstanceRequest) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	switch req.DatabaseType {
	case "mysql":
		cmd := exec.CommandContext(
			ctx,
			"mysql",
			"-h", req.Host,
			"-P", fmt.Sprintf("%d", req.Port),
			"-u", req.User,
			fmt.Sprintf("-p%s", req.Password),
			"-D", req.DatabaseName,
			"--connect-timeout=5",
			"-e", "SELECT 1;",
		)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("connection test failed: %v (%s)", err, string(output))
		}
	case "postgresql":
		cmd := exec.CommandContext(
			ctx,
			"psql",
			fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=disable connect_timeout=5", req.Host, req.Port, req.User, req.DatabaseName),
			"-c", "SELECT 1;",
		)
		cmd.Env = append(cmd.Env, fmt.Sprintf("PGPASSWORD=%s", req.Password))
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("connection test failed: %v (%s)", err, string(output))
		}
	default:
		return fmt.Errorf("unsupported database type: %s", req.DatabaseType)
	}

	return nil
}
