package handlers

import (
	"net/http"
	"strings"

	"github.com/datatrue-new/api/internal/config"
	"github.com/datatrue-new/api/pkg/websocket"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		claims, err := ParseJWTToken(tokenString, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("user_id", uint(claims["user_id"].(float64)))
		c.Set("username", claims["username"].(string))
		c.Set("email", claims["email"].(string))

		c.Next()
	}
}

func SetupRoutes(router *gin.Engine, db *gorm.DB, redisClient *redis.Client, cfg *config.Config, walHandler *WALBackupHandler) {
	router.GET("/health", HealthCheck)
	router.GET("/ws", websocket.HandleWebSocket)

	authGroup := router.Group("/api/auth")
	{
		authHandler := NewAuthHandler(db, cfg.JWT, redisClient)
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/logout", authHandler.Logout)
		authGroup.POST("/refresh", authHandler.RefreshToken)
	}

	apiGroup := router.Group("/api")
	apiGroup.Use(AuthMiddleware(cfg.JWT.Secret))
	{
		workspaceHandler := NewWorkspaceHandler(db)
		apiGroup.GET("/workspaces", workspaceHandler.GetAll)
		apiGroup.POST("/workspaces", workspaceHandler.Create)
		apiGroup.GET("/workspaces/:id", workspaceHandler.GetByID)
		apiGroup.PUT("/workspaces/:id", workspaceHandler.Update)
		apiGroup.DELETE("/workspaces/:id", workspaceHandler.Delete)
		apiGroup.GET("/workspaces/:id/members", workspaceHandler.GetMembers)
		apiGroup.POST("/workspaces/:id/members", workspaceHandler.InviteMember)
		apiGroup.PUT("/workspaces/:id/members/:memberId", workspaceHandler.UpdateMemberRole)
		apiGroup.DELETE("/workspaces/:id/members/:memberId", workspaceHandler.RemoveMember)
		apiGroup.POST("/workspaces/:id/leave", workspaceHandler.Leave)
		apiGroup.GET("/workspaces/:id/my-role", workspaceHandler.GetMyRole)

		statsHandler := NewStatsHandler(db)
		apiGroup.GET("/stats", statsHandler.GetDashboardStats)

		dbHandler := NewDatabaseHandler(db)
		apiGroup.GET("/mysql-databases", dbHandler.GetMySQLDatabases)
		apiGroup.POST("/mysql-databases", dbHandler.CreateMySQLDatabase)
		apiGroup.GET("/mysql-databases/:id", dbHandler.GetMySQLDatabaseByID)
		apiGroup.PUT("/mysql-databases/:id", dbHandler.UpdateMySQLDatabase)
		apiGroup.DELETE("/mysql-databases/:id", dbHandler.DeleteMySQLDatabase)
		apiGroup.GET("/postgresql-databases", dbHandler.GetPostgreSQLDatabases)
		apiGroup.POST("/postgresql-databases", dbHandler.CreatePostgreSQLDatabase)
		apiGroup.GET("/postgresql-databases/:id", dbHandler.GetPostgreSQLDatabaseByID)
		apiGroup.PUT("/postgresql-databases/:id", dbHandler.UpdatePostgreSQLDatabase)
		apiGroup.DELETE("/postgresql-databases/:id", dbHandler.DeletePostgreSQLDatabase)

		storageHandler := NewStorageHandler(db)
		apiGroup.GET("/storages", storageHandler.GetAll)
		apiGroup.POST("/storages", storageHandler.Create)
		apiGroup.GET("/storages/:id", storageHandler.GetByID)
		apiGroup.PUT("/storages/:id", storageHandler.Update)
		apiGroup.DELETE("/storages/:id", storageHandler.Delete)

		storageVerificationHandler := NewStorageVerificationHandler()
		apiGroup.POST("/storages/test", storageVerificationHandler.TestStorage)
		apiGroup.POST("/storages/info", storageVerificationHandler.GetStorageInfo)

		backupHandler := NewBackupHandler(db)
		apiGroup.GET("/backups", backupHandler.GetAll)
		apiGroup.POST("/backups", backupHandler.Create)
		apiGroup.GET("/backups/:id", backupHandler.GetByID)
		apiGroup.DELETE("/backups/:id", backupHandler.Delete)

		restoreHandler := NewRestoreHandler(db)
		apiGroup.GET("/restores", restoreHandler.GetAll)
		apiGroup.POST("/restores", restoreHandler.Create)
		apiGroup.GET("/restores/:id", restoreHandler.GetByID)
		apiGroup.POST("/restores/check-target", restoreHandler.CheckRestoreTarget)
		apiGroup.POST("/restores/:id/cancel", restoreHandler.Cancel)
		apiGroup.GET("/restores/:id/progress", restoreHandler.GetRestoreProgress)
		apiGroup.GET("/restores/validate-backup", restoreHandler.ValidateBackup)
		apiGroup.GET("/restores/pitr-time-range", restoreHandler.GetPITRTimeRange)
		apiGroup.GET("/restores/restoreable-backups", restoreHandler.ListRestoreableBackups)

		backupConfigHandler := NewBackupConfigHandler(db)
		apiGroup.GET("/backup-configs", backupConfigHandler.GetAll)
		apiGroup.POST("/backup-configs", backupConfigHandler.Create)
		apiGroup.GET("/backup-configs/:id", backupConfigHandler.GetByID)
		apiGroup.PUT("/backup-configs/:id", backupConfigHandler.Update)
		apiGroup.DELETE("/backup-configs/:id", backupConfigHandler.Delete)

		retentionHandler := NewRetentionHandler(db)
		apiGroup.GET("/retention/gfs/:config_id", retentionHandler.GetGFSConfig)
		apiGroup.PUT("/retention/gfs", retentionHandler.UpdateGFSConfig)
		apiGroup.POST("/retention/gfs/cleanup", retentionHandler.ExecuteGFSCleanup)
		apiGroup.POST("/retention/gfs/preview", retentionHandler.PreviewGFSCleanup)
		apiGroup.GET("/retention/backup/:backup_id/gfs-info", retentionHandler.GetBackupGFSInfo)

		alertHandler := NewAlertHandler(db)
		apiGroup.GET("/alerts", alertHandler.GetAll)
		apiGroup.GET("/alerts/:id", alertHandler.GetByID)
		apiGroup.PUT("/alerts/:id/read", alertHandler.MarkAsRead)
		apiGroup.PUT("/alerts/read-all", alertHandler.MarkAllAsRead)
		apiGroup.DELETE("/alerts/:id", alertHandler.Delete)
		apiGroup.GET("/alerts/unread-count", alertHandler.GetUnreadCount)
		apiGroup.GET("/alerts/preferences", alertHandler.GetPreferences)
		apiGroup.POST("/alerts/preferences", alertHandler.SavePreferences)

		settingsHandler := NewSettingsHandler(db)
		apiGroup.GET("/settings", settingsHandler.GetAll)
		apiGroup.POST("/settings", settingsHandler.Set)
		apiGroup.GET("/settings/:key", settingsHandler.GetByKey)
		apiGroup.DELETE("/settings/:key", settingsHandler.Delete)
		apiGroup.GET("/settings/alert", settingsHandler.GetAlertSettings)
		apiGroup.POST("/settings/alert", settingsHandler.SetAlertSettings)
		apiGroup.GET("/settings/backup", settingsHandler.GetBackupSettings)
		apiGroup.POST("/settings/backup", settingsHandler.SetBackupSettings)
		apiGroup.GET("/settings/smtp", settingsHandler.GetSMTPConfig)
		apiGroup.POST("/settings/smtp", settingsHandler.SaveSMTPConfig)
		apiGroup.POST("/settings/smtp/test", settingsHandler.TestSMTPConnection)
		apiGroup.POST("/settings/smtp/test-email", settingsHandler.TestEmail)

		auditLogHandler := NewAuditLogHandler(db)
		apiGroup.GET("/audit-logs", auditLogHandler.GetAuditLogs)

		apiGroup.GET("/wal-backup/status", walHandler.GetWALBackupStatus)
		apiGroup.POST("/wal-backup/start", walHandler.StartWALBackup)
		apiGroup.POST("/wal-backup/stop", walHandler.StopWALBackup)
	}
}

func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Databasus API is running",
	})
}