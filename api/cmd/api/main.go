package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/databasus-new/api/internal/config"
	"github.com/databasus-new/api/internal/handlers"
	"github.com/databasus-new/api/pkg/database"
	"github.com/databasus-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	// 加载配置
	cfg := config.Load()

	// 初始化数据库
	db, err := database.InitPostgres(cfg.Database)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Server will start without database connection")
	} else {
		// 运行数据库迁移
		if err := database.RunMigrations(db); err != nil {
			log.Printf("Warning: Failed to run database migrations: %v", err)
		}
	}

	// 初始化Redis（可选）
	redisClient, err := database.InitRedis(cfg.Redis)
	if err != nil {
		log.Println("Warning: Failed to connect to Redis:", err)
	}

	// 初始化调度器
	if db != nil {
		taskScheduler := scheduler.NewScheduler(db, redisClient, cfg.Backup.StoragePath)
		taskScheduler.Start(5)

		cronScheduler := scheduler.NewCronScheduler(db, taskScheduler)
		cronScheduler.Start()

		taskScheduler.StartCleanupWorker(24*time.Hour, cfg.Backup.RetentionDays)

		log.Printf("Task scheduler initialized with storage path: %s, retention days: %d",
			cfg.Backup.StoragePath, cfg.Backup.RetentionDays)
	}

	// 初始化Gin路由
	router := gin.Default()

	// 添加CORS中间件
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// 初始化处理器
	handlers.SetupRoutes(router, db, redisClient, cfg)

	// 获取端口
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.Server.Port
	}

	// 启动服务器
	addr := fmt.Sprintf(":%s", port)
	log.Printf("Server starting on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}