package handlers

import (
	"github.com/databasus-new/api/internal/config"
	"github.com/databasus-new/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// SetupRoutes 设置所有路由
func SetupRoutes(router *gin.Engine, db *gorm.DB, redisClient *redis.Client, cfg *config.Config) {
	// 健康检查
	router.GET("/health", HealthCheck)

	// 认证路由（无需认证）
	authGroup := router.Group("/api/auth")
	{
		authHandler := NewAuthHandler(db, cfg.JWT)
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/refresh", authHandler.RefreshToken)
	}

	// 需要认证的路由
	apiGroup := router.Group("/api")
	apiGroup.Use(middleware.JWTAuth(cfg.JWT.Secret))
	{
		// 工作空间路由
		workspaceHandler := NewWorkspaceHandler(db)
		apiGroup.GET("/workspaces", workspaceHandler.GetAll)
		apiGroup.POST("/workspaces", workspaceHandler.Create)
		apiGroup.GET("/workspaces/:id", workspaceHandler.GetByID)
		apiGroup.PUT("/workspaces/:id", workspaceHandler.Update)
		apiGroup.DELETE("/workspaces/:id", workspaceHandler.Delete)

		// 数据库路由
		dbHandler := NewDatabaseHandler(db)
		// MySQL数据库
		apiGroup.GET("/mysql-databases", dbHandler.GetMySQLDatabases)
		apiGroup.POST("/mysql-databases", dbHandler.CreateMySQLDatabase)
		apiGroup.GET("/mysql-databases/:id", dbHandler.GetMySQLDatabaseByID)
		apiGroup.PUT("/mysql-databases/:id", dbHandler.UpdateMySQLDatabase)
		apiGroup.DELETE("/mysql-databases/:id", dbHandler.DeleteMySQLDatabase)
		// PostgreSQL数据库
		apiGroup.GET("/postgresql-databases", dbHandler.GetPostgreSQLDatabases)
		apiGroup.POST("/postgresql-databases", dbHandler.CreatePostgreSQLDatabase)
		apiGroup.GET("/postgresql-databases/:id", dbHandler.GetPostgreSQLDatabaseByID)
		apiGroup.PUT("/postgresql-databases/:id", dbHandler.UpdatePostgreSQLDatabase)
		apiGroup.DELETE("/postgresql-databases/:id", dbHandler.DeletePostgreSQLDatabase)

		// 存储路由
		storageHandler := NewStorageHandler(db)
		apiGroup.GET("/storages", storageHandler.GetAll)
		apiGroup.POST("/storages", storageHandler.Create)
		apiGroup.GET("/storages/:id", storageHandler.GetByID)
		apiGroup.PUT("/storages/:id", storageHandler.Update)
		apiGroup.DELETE("/storages/:id", storageHandler.Delete)

		// 备份路由
		backupHandler := NewBackupHandler(db)
		apiGroup.GET("/backups", backupHandler.GetAll)
		apiGroup.POST("/backups", backupHandler.Create)
		apiGroup.GET("/backups/:id", backupHandler.GetByID)
		apiGroup.DELETE("/backups/:id", backupHandler.Delete)

		// 恢复路由
		restoreHandler := NewRestoreHandler(db)
		apiGroup.GET("/restores", restoreHandler.GetAll)
		apiGroup.POST("/restores", restoreHandler.Create)
		apiGroup.GET("/restores/:id", restoreHandler.GetByID)

		// 备份配置路由
		backupConfigHandler := NewBackupConfigHandler(db)
		apiGroup.GET("/backup-configs", backupConfigHandler.GetAll)
		apiGroup.POST("/backup-configs", backupConfigHandler.Create)
		apiGroup.GET("/backup-configs/:id", backupConfigHandler.GetByID)
		apiGroup.PUT("/backup-configs/:id", backupConfigHandler.Update)
		apiGroup.DELETE("/backup-configs/:id", backupConfigHandler.Delete)

		// 告警路由
		alertHandler := NewAlertHandler(db)
		apiGroup.GET("/alerts", alertHandler.GetAll)
		apiGroup.GET("/alerts/:id", alertHandler.GetByID)
		apiGroup.PUT("/alerts/:id/read", alertHandler.MarkAsRead)
		apiGroup.PUT("/alerts/read-all", alertHandler.MarkAllAsRead)
		apiGroup.DELETE("/alerts/:id", alertHandler.Delete)
		apiGroup.GET("/alerts/unread-count", alertHandler.GetUnreadCount)

		// 设置路由
		settingsHandler := NewSettingsHandler(db)
		apiGroup.GET("/settings", settingsHandler.GetAll)
		apiGroup.POST("/settings", settingsHandler.Set)
		apiGroup.GET("/settings/:key", settingsHandler.GetByKey)
		apiGroup.DELETE("/settings/:key", settingsHandler.Delete)
		apiGroup.GET("/settings/alert", settingsHandler.GetAlertSettings)
		apiGroup.POST("/settings/alert", settingsHandler.SetAlertSettings)
		apiGroup.GET("/settings/backup", settingsHandler.GetBackupSettings)
		apiGroup.POST("/settings/backup", settingsHandler.SetBackupSettings)
	}
}

// HealthCheck 健康检查处理器
func HealthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status": "ok",
		"message": "Databasus API is running",
	})
}