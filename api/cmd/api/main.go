package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/datatrue-new/api/internal/config"
	"github.com/datatrue-new/api/internal/handlers"
	"github.com/datatrue-new/api/pkg/backup"
	"github.com/datatrue-new/api/pkg/database"
	"github.com/datatrue-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	cfg := config.Load()

	if cfg.JWT.Secret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	db, err := database.InitPostgres(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Println("Database connected successfully")

	if err := database.RunMigrations(db); err != nil {
		log.Printf("Warning: Failed to run database migrations: %v", err)
	} else {
		log.Println("Database migrations completed successfully")
	}

	redisClient, err := database.InitRedis(cfg.Redis)
	if err != nil {
		log.Println("Warning: Failed to connect to Redis:", err)
	}

	taskScheduler := scheduler.NewScheduler(db, redisClient, cfg.Backup.StoragePath)
	taskScheduler.Start(5)

	cronScheduler := scheduler.NewCronScheduler(db, taskScheduler)
	cronScheduler.Start()

	taskScheduler.StartCleanupWorker(24*time.Hour, cfg.Backup.RetentionDays)

	walService := backup.NewWALBackupService(db, redisClient, cfg.Backup.StoragePath)
	walService.Start()

	walHandler := handlers.NewWALBackupHandler(walService)

	log.Printf("Task scheduler initialized with storage path: %s, retention days: %d",
		cfg.Backup.StoragePath, cfg.Backup.RetentionDays)

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
			"message": "DataTrue API Server",
		})
	})

	handlers.SetupRoutes(router, db, redisClient, cfg, walHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "6001"
	}

	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
