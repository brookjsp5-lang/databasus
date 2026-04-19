package handlers

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 内存存储数据库信息
type memoryDatabaseStorage struct {
	mysqlDatabases      map[uint]*models.MySQLDatabase
	postgresqlDatabases map[uint]*models.PostgreSQLDatabase
	mutex               sync.RWMutex
	nextMySQLID         uint
	nextPostgreSQLID    uint
}

var (
	dbMemStorage = &memoryDatabaseStorage{
		mysqlDatabases:      make(map[uint]*models.MySQLDatabase),
		postgresqlDatabases: make(map[uint]*models.PostgreSQLDatabase),
		nextMySQLID:         1,
		nextPostgreSQLID:    1,
	}
)

// DatabaseHandler 数据库处理器
type DatabaseHandler struct {
	db *gorm.DB
}

// NewDatabaseHandler 创建数据库处理器
func NewDatabaseHandler(db *gorm.DB) *DatabaseHandler {
	return &DatabaseHandler{db: db}
}

// CreateMySQLDatabaseRequest 创建MySQL数据库请求
type CreateMySQLDatabaseRequest struct {
	WorkspaceID               uint   `json:"workspace_id" binding:"required"`
	Name                      string `json:"name" binding:"required"`
	Host                      string `json:"host" binding:"required"`
	Port                      int    `json:"port" binding:"required,min=1,max=65535"`
	User                      string `json:"user" binding:"required"`
	Password                  string `json:"password" binding:"required"`
	DatabaseName              string `json:"database_name" binding:"required"`
	IsPhysicalBackupSupported bool   `json:"is_physical_backup_supported"`
	BinaryLogEnabled          bool   `json:"binary_log_enabled"`
	BinaryLogPath             string `json:"binary_log_path"`
	XtraBackupPath            string `json:"xtrabackup_path"`
}

// UpdateMySQLDatabaseRequest 更新MySQL数据库请求
type UpdateMySQLDatabaseRequest struct {
	Name                      string `json:"name" binding:"required"`
	Host                      string `json:"host" binding:"required"`
	Port                      int    `json:"port" binding:"required,min=1,max=65535"`
	User                      string `json:"user" binding:"required"`
	Password                  string `json:"password"`
	DatabaseName              string `json:"database_name" binding:"required"`
	IsPhysicalBackupSupported bool   `json:"is_physical_backup_supported"`
	BinaryLogEnabled          bool   `json:"binary_log_enabled"`
	BinaryLogPath             string `json:"binary_log_path"`
	XtraBackupPath            string `json:"xtrabackup_path"`
}

// CreatePostgreSQLDatabaseRequest 创建PostgreSQL数据库请求
type CreatePostgreSQLDatabaseRequest struct {
	WorkspaceID  uint   `json:"workspace_id" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port" binding:"required,min=1,max=65535"`
	User         string `json:"user" binding:"required"`
	Password     string `json:"password" binding:"required"`
	DatabaseName string `json:"database_name" binding:"required"`
	WALEnabled   bool   `json:"wal_enabled"`
	WALPath      string `json:"wal_path"`
}

// UpdatePostgreSQLDatabaseRequest 更新PostgreSQL数据库请求
type UpdatePostgreSQLDatabaseRequest struct {
	Name         string `json:"name" binding:"required"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port" binding:"required,min=1,max=65535"`
	User         string `json:"user" binding:"required"`
	Password     string `json:"password"`
	DatabaseName string `json:"database_name" binding:"required"`
	WALEnabled   bool   `json:"wal_enabled"`
	WALPath      string `json:"wal_path"`
}

// GetMySQLDatabases 获取所有MySQL数据库
func (h *DatabaseHandler) GetMySQLDatabases(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.RLock()
		var databases []models.MySQLDatabase
		for _, db := range dbMemStorage.mysqlDatabases {
			databases = append(databases, *db)
		}
		dbMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"databases": databases})
		return
	}
	var databases []models.MySQLDatabase
	if err := h.db.Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get MySQL databases"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

// CreateMySQLDatabase 创建MySQL数据库
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
		IsPhysicalBackupSupported: req.IsPhysicalBackupSupported,
		BinaryLogEnabled:          req.BinaryLogEnabled,
		BinaryLogPath:             req.BinaryLogPath,
		XtraBackupPath:            req.XtraBackupPath,
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		database.ID = dbMemStorage.nextMySQLID
		dbMemStorage.mysqlDatabases[database.ID] = &database
		dbMemStorage.nextMySQLID++
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"database": database})
		return
	}

	if err := h.db.Create(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create MySQL database"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"database": database})
}

// GetMySQLDatabaseByID 根据ID获取MySQL数据库
func (h *DatabaseHandler) GetMySQLDatabaseByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.RLock()
		database, exists := dbMemStorage.mysqlDatabases[uint(id)]
		dbMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "MySQL database not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"database": database})
		return
	}

	var database models.MySQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "MySQL database not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

// UpdateMySQLDatabase 更新MySQL数据库
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

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		database, exists := dbMemStorage.mysqlDatabases[uint(id)]
		if !exists {
			dbMemStorage.mutex.Unlock()
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
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"database": database})
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

// DeleteMySQLDatabase 删除MySQL数据库
func (h *DatabaseHandler) DeleteMySQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		_, exists := dbMemStorage.mysqlDatabases[uint(id)]
		if !exists {
			dbMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "MySQL database not found"})
			return
		}
		delete(dbMemStorage.mysqlDatabases, uint(id))
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "MySQL database deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.MySQLDatabase{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete MySQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "MySQL database deleted successfully"})
}

// GetPostgreSQLDatabases 获取所有PostgreSQL数据库
func (h *DatabaseHandler) GetPostgreSQLDatabases(c *gin.Context) {
	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.RLock()
		var databases []models.PostgreSQLDatabase
		for _, db := range dbMemStorage.postgresqlDatabases {
			databases = append(databases, *db)
		}
		dbMemStorage.mutex.RUnlock()
		c.JSON(http.StatusOK, gin.H{"databases": databases})
		return
	}
	var databases []models.PostgreSQLDatabase
	if err := h.db.Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get PostgreSQL databases"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

// CreatePostgreSQLDatabase 创建PostgreSQL数据库
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
		WALEnabled:   req.WALEnabled,
		WALPath:      req.WALPath,
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		database.ID = dbMemStorage.nextPostgreSQLID
		dbMemStorage.postgresqlDatabases[database.ID] = &database
		dbMemStorage.nextPostgreSQLID++
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusCreated, gin.H{"database": database})
		return
	}

	if err := h.db.Create(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create PostgreSQL database"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"database": database})
}

// GetPostgreSQLDatabaseByID 根据ID获取PostgreSQL数据库
func (h *DatabaseHandler) GetPostgreSQLDatabaseByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.RLock()
		database, exists := dbMemStorage.postgresqlDatabases[uint(id)]
		dbMemStorage.mutex.RUnlock()
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "PostgreSQL database not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"database": database})
		return
	}

	var database models.PostgreSQLDatabase
	if err := h.db.First(&database, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PostgreSQL database not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"database": database})
}

// UpdatePostgreSQLDatabase 更新PostgreSQL数据库
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

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		database, exists := dbMemStorage.postgresqlDatabases[uint(id)]
		if !exists {
			dbMemStorage.mutex.Unlock()
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
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"database": database})
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

// DeletePostgreSQLDatabase 删除PostgreSQL数据库
func (h *DatabaseHandler) DeletePostgreSQLDatabase(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if h.db == nil {
		// 使用内存存储
		dbMemStorage.mutex.Lock()
		_, exists := dbMemStorage.postgresqlDatabases[uint(id)]
		if !exists {
			dbMemStorage.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "PostgreSQL database not found"})
			return
		}
		delete(dbMemStorage.postgresqlDatabases, uint(id))
		dbMemStorage.mutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"message": "PostgreSQL database deleted successfully"})
		return
	}

	if err := h.db.Delete(&models.PostgreSQLDatabase{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete PostgreSQL database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PostgreSQL database deleted successfully"})
}