package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/databasus-new/api/internal/config"
	"github.com/databasus-new/api/internal/handlers"
	"github.com/databasus-new/api/pkg/database"
	"github.com/databasus-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	cfg := config.Load()

	db, err := database.InitPostgres(cfg.Database)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Server will start without database connection")
	} else {
		if err := database.RunMigrations(db); err != nil {
			log.Printf("Warning: Failed to run database migrations: %v", err)
		}
	}

	redisClient, err := database.InitRedis(cfg.Redis)
	if err != nil {
		log.Println("Warning: Failed to connect to Redis:", err)
	}

	if db != nil {
		taskScheduler := scheduler.NewScheduler(db, redisClient, cfg.Backup.StoragePath)
		taskScheduler.Start(5)

		cronScheduler := scheduler.NewCronScheduler(db, taskScheduler)
		cronScheduler.Start()

		taskScheduler.StartCleanupWorker(24*time.Hour, cfg.Backup.RetentionDays)

		log.Printf("Task scheduler initialized with storage path: %s, retention days: %d",
			cfg.Backup.StoragePath, cfg.Backup.RetentionDays)
	}

	router := gin.Default()

	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "DatabasUS API Server",
		})
	})

	auth := router.Group("/auth")
	{
		auth.POST("/login", handlers.Login)
	}

	api := router.Group("/api")
	api.Use(handlers.AuthMiddleware())
	{
		api.GET("/workspace/stats", handlers.GetWorkspaceStats)
		api.GET("/databases", handlers.GetDatabases)
		api.POST("/databases", handlers.CreateDatabase)
		api.DELETE("/databases/:id", handlers.DeleteDatabase)
		api.GET("/backups", handlers.GetBackups)
		api.POST("/backups", handlers.CreateBackup)
		api.DELETE("/backups/:id", handlers.DeleteBackup)
		api.GET("/restores", handlers.GetRestores)
		api.POST("/restores", handlers.CreateRestore)
		api.GET("/settings", handlers.GetSettings)
		api.PUT("/settings", handlers.UpdateSettings)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "6001"
	}

	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
