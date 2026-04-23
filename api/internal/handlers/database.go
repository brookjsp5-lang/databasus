package handlers

import (
	"net/http"
	"strconv"

	"github.com/datatrue-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DatabaseHandler struct {
	db *gorm.DB
}

func NewDatabaseHandler(db *gorm.DB) *DatabaseHandler {
	return &DatabaseHandler{db: db}
}

type CreateMySQLDatabaseRequest struct {
	WorkspaceID               uint   `json:"workspace_id" binding:"required"`
	Name                      string `json:"name" binding:"required"`
	Host                      string `json:"host" binding:"required"`
	Port                      int    `json:"port" binding:"required,min=1,max=65535"`
	User                      string `json:"user" binding:"required"`
	Password                  string `json:"password" binding:"required"`
	DatabaseName              string `json:"database_name" binding:"required"`
	EngineVersion             string `json:"engine_version"`
	IsPhysicalBackupSupported bool   `json:"is_physical_backup_supported"`
	BinaryLogEnabled          bool   `json:"binary_log_enabled"`
	BinaryLogPath             string `json:"binary_log_path"`
	XtraBackupPath            string `json:"xtrabackup_path"`
}

type UpdateMySQLDatabaseRequest struct {
	Name                      string `json:"name" binding:"required"`
	Host                      string `json:"host" binding:"required"`
	Port                      int    `json:"port" binding:"required,min=1,max=65535"`
	User                      string `json:"user" binding:"required"`
	Password                  string `json:"password"`
	DatabaseName              string `json:"database_name" binding:"required"`
	EngineVersion             string `json:"engine_version"`
	IsPhysicalBackupSupported bool   `json:"is_physical_backup_supported"`
	BinaryLogEnabled          bool   `json:"binary_log_enabled"`
	BinaryLogPath             string `json:"binary_log_path"`
	XtraBackupPath            string `json:"xtrabackup_path"`
}

type CreatePostgreSQLDatabaseRequest struct {
	WorkspaceID  uint   `json:"workspace_id" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port" binding:"required,min=1,max=65535"`
	User         string `json:"user" binding:"required"`
	Password     string `json:"password" binding:"required"`
	DatabaseName string `json:"database_name" binding:"required"`
	EngineVersion string `json:"engine_version"`
	WALEnabled   bool   `json:"wal_enabled"`
	WALPath      string `json:"wal_path"`
}

type UpdatePostgreSQLDatabaseRequest struct {
	Name         string `json:"name" binding:"required"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port" binding:"required,min=1,max=65535"`
	User         string `json:"user" binding:"required"`
	Password     string `json:"password"`
	DatabaseName string `json:"database_name" binding:"required"`
	EngineVersion string `json:"engine_version"`
	WALEnabled   bool   `json:"wal_enabled"`
	WALPath      string `json:"wal_path"`
}

func (h *DatabaseHandler) GetMySQLDatabases(c *gin.Context) {
	var databases []models.MySQLDatabase
	if err := h.db.Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get MySQL databases"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

func (h *DatabaseHandler) CreateMySQLDatabase(c *gin.Context) {
	var req CreateMySQLDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database := models.MySQLDatabase{
		WorkspaceID:               req.WorkspaceID,
		Name:                      req.Name,
		Host:                      req.Host,
		Port:                      req.Port,
		User:                      req.User,
		Password:                  req.Password,
		DatabaseName:              req.DatabaseName,
		EngineVersion:             req.EngineVersion,
		IsPhysicalBackupSupported: req.IsPhysicalBackupSupported,
		BinaryLogEnabled:          req.BinaryLogEnabled,
		BinaryLogPath:             req.BinaryLogPath,
		XtraBackupPath:            req.XtraBackupPath,
	}

	if err := h.db.Create(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create MySQL database"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"database": database})
}

func (h *DatabaseHandler) GetMySQLDatabaseByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var database models.MySQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "MySQL database not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) UpdateMySQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var req UpdateMySQLDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var database models.MySQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "MySQL database not found"})
		return
	}

	database.Name = req.Name
	database.Host = req.Host
	database.Port = req.Port
	database.User = req.User
	if req.Password != "" {
		database.Password = req.Password
	}
	database.DatabaseName = req.DatabaseName
	database.IsPhysicalBackupSupported = req.IsPhysicalBackupSupported
	database.BinaryLogEnabled = req.BinaryLogEnabled
	database.BinaryLogPath = req.BinaryLogPath
	database.XtraBackupPath = req.XtraBackupPath

	if err := h.db.Save(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update MySQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) DeleteMySQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if err := h.db.Delete(&models.MySQLDatabase{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete MySQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "MySQL database deleted successfully"})
}

func (h *DatabaseHandler) GetPostgreSQLDatabases(c *gin.Context) {
	var databases []models.PostgreSQLDatabase
	if err := h.db.Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get PostgreSQL databases"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

func (h *DatabaseHandler) CreatePostgreSQLDatabase(c *gin.Context) {
	var req CreatePostgreSQLDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database := models.PostgreSQLDatabase{
		WorkspaceID:  req.WorkspaceID,
		Name:         req.Name,
		Host:         req.Host,
		Port:         req.Port,
		User:         req.User,
		Password:     req.Password,
		DatabaseName: req.DatabaseName,
		EngineVersion: req.EngineVersion,
		WALEnabled:   req.WALEnabled,
		WALPath:      req.WALPath,
	}

	if err := h.db.Create(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create PostgreSQL database"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"database": database})
}

func (h *DatabaseHandler) GetPostgreSQLDatabaseByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var database models.PostgreSQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PostgreSQL database not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) UpdatePostgreSQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var req UpdatePostgreSQLDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var database models.PostgreSQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PostgreSQL database not found"})
		return
	}

	database.Name = req.Name
	database.Host = req.Host
	database.Port = req.Port
	database.User = req.User
	if req.Password != "" {
		database.Password = req.Password
	}
	database.DatabaseName = req.DatabaseName
	database.WALEnabled = req.WALEnabled
	database.WALPath = req.WALPath

	if err := h.db.Save(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update PostgreSQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

func (h *DatabaseHandler) DeletePostgreSQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if err := h.db.Delete(&models.PostgreSQLDatabase{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete PostgreSQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PostgreSQL database deleted successfully"})
}
