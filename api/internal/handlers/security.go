package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type SecurityHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
	maxRetries  int
	lockoutDur  time.Duration
}

func NewSecurityHandler(db *gorm.DB, redisClient *redis.Client) *SecurityHandler {
	return &SecurityHandler{
		db:          db,
		redisClient: redisClient,
		maxRetries:  5,
		lockoutDur:  15 * time.Minute,
	}
}

type LoginAttempt struct {
	Count    int
	LastTime time.Time
}

func (h *SecurityHandler) CheckLoginAttempts(email string) (bool, string, error) {
	ctx := context.Background()
	key := fmt.Sprintf("login_attempts:%s", email)

	if h.redisClient != nil {
		data, err := h.redisClient.Get(ctx, key).Result()
		if err == redis.Nil {
			return true, "", nil
		}
		if err != nil {
			return false, "", err
		}

		var attempt LoginAttempt
		parts := strings.Split(data, "|")
		if len(parts) == 2 {
			fmt.Sscanf(parts[0], "%d", &attempt.Count)
			attempt.LastTime, _ = time.Parse(time.RFC3339, parts[1])
		}

		if attempt.Count >= h.maxRetries {
			if time.Since(attempt.LastTime) < h.lockoutDur {
				remainingMinutes := int(h.lockoutDur.Minutes() - time.Since(attempt.LastTime).Minutes())
				return false, fmt.Sprintf("账户已被锁定，请在 %d 分钟后重试", remainingMinutes), nil
			}
			h.redisClient.Del(ctx, key)
		}
	}

	return true, "", nil
}

func (h *SecurityHandler) RecordFailedLogin(email string) error {
	ctx := context.Background()
	key := fmt.Sprintf("login_attempts:%s", email)

	if h.redisClient != nil {
		data, err := h.redisClient.Get(ctx, key).Result()
		if err == redis.Nil {
			newData := fmt.Sprintf("1|%s", time.Now().Format(time.RFC3339))
			return h.redisClient.Set(ctx, key, newData, h.lockoutDur).Err()
		} else if err != nil {
			return err
		}

		var attempt LoginAttempt
		parts := strings.Split(data, "|")
		if len(parts) == 2 {
			fmt.Sscanf(parts[0], "%d", &attempt.Count)
		}
		attempt.Count++
		attempt.LastTime = time.Now()

		newData := fmt.Sprintf("%d|%s", attempt.Count, attempt.LastTime.Format(time.RFC3339))
		return h.redisClient.Set(ctx, key, newData, h.lockoutDur).Err()
	}

	return nil
}

func (h *SecurityHandler) ClearLoginAttempts(email string) error {
	ctx := context.Background()
	key := fmt.Sprintf("login_attempts:%s", email)

	if h.redisClient != nil {
		return h.redisClient.Del(ctx, key).Err()
	}

	return nil
}

type TokenBlacklistHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
}

func NewTokenBlacklistHandler(db *gorm.DB, redisClient *redis.Client) *TokenBlacklistHandler {
	return &TokenBlacklistHandler{
		db:          db,
		redisClient: redisClient,
	}
}

func (h *TokenBlacklistHandler) IsTokenBlacklisted(token string) (bool, error) {
	ctx := context.Background()

	if h.redisClient != nil {
		key := fmt.Sprintf("blacklist:%s", token)
		exists, err := h.redisClient.Exists(ctx, key).Result()
		if err != nil {
			return false, err
		}
		return exists > 0, nil
	}

	var blacklist models.TokenBlacklist
	if err := h.db.Where("token = ?", token).First(&blacklist).Error; err == nil {
		return true, nil
	}

	return false, nil
}

func (h *SecurityHandler) BlacklistToken(token string, expiresAt time.Time) error {
	ctx := context.Background()
	ttl := time.Until(expiresAt)

	if ttl <= 0 {
		return nil
	}

	if h.redisClient != nil {
		key := fmt.Sprintf("blacklist:%s", token)
		return h.redisClient.Set(ctx, key, "1", ttl).Err()
	}

	blacklist := models.TokenBlacklist{
		Token:     token,
		ExpiresAt: expiresAt,
	}
	return h.db.Create(&blacklist).Error
}

type AuditLogHandler struct {
	db *gorm.DB
}

func NewAuditLogHandler(db *gorm.DB) *AuditLogHandler {
	return &AuditLogHandler{db: db}
}

func (h *AuditLogHandler) Log(userID uint, username, action, resource string, details map[string]interface{}, ipAddress string) error {
	detailsJSON := ""
	if details != nil {
		for k, v := range details {
			detailsJSON += fmt.Sprintf("%s: %v; ", k, v)
		}
	}

	auditLog := models.AuditLog{
		UserID:    userID,
		Username:  username,
		Action:    action,
		Resource:  resource,
		Details:   detailsJSON,
		IPAddress: ipAddress,
	}

	return h.db.Create(&auditLog).Error
}

func (h *AuditLogHandler) GetAuditLogs(c *gin.Context) {
	userIDStr := c.Query("user_id")
	action := c.Query("action")
	resource := c.Query("resource")
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	var userID uint = 0
	if userIDStr != "" {
		fmt.Sscanf(userIDStr, "%d", &userID)
	}

	page := 1
	pageSize := 20
	fmt.Sscanf(pageStr, "%d", &page)
	fmt.Sscanf(pageSizeStr, "%d", &pageSize)

	var startDate, endDate time.Time
	if startDateStr != "" {
		startDate, _ = time.Parse("2006-01-02", startDateStr)
	}
	if endDateStr != "" {
		endDate, _ = time.Parse("2006-01-02 23:59:59", endDateStr+" 23:59:59")
	}

	var logs []models.AuditLog
	var total int64

	query := h.db.Model(&models.AuditLog{})

	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if !startDate.IsZero() {
		query = query.Where("created_at >= ?", startDate)
	}
	if !endDate.IsZero() {
		query = query.Where("created_at <= ?", endDate)
	}

	if err := query.Count(&total).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to count logs"})
		return
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to get logs"})
		return
	}

	c.JSON(200, gin.H{
		"logs":  logs,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func ExtractIPAddress(c *gin.Context) string {
	ip := c.ClientIP()
	if xForwardedFor := c.GetHeader("X-Forwarded-For"); xForwardedFor != "" {
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			ip = strings.TrimSpace(ips[0])
		}
	}
	return ip
}

type StatsHandler struct {
	db *gorm.DB
}

func NewStatsHandler(db *gorm.DB) *StatsHandler {
	return &StatsHandler{db: db}
}

type DashboardStats struct {
	TotalDatabases      int64   `json:"total_databases"`
	TotalBackups        int64   `json:"total_backups"`
	SuccessRate         float64 `json:"success_rate"`
	StorageUsed         float64 `json:"storage_used"`
	StorageTotal        float64 `json:"storage_total"`
	ActiveBackups       int64   `json:"active_backups"`
	FailedBackups       int64   `json:"failed_backups"`
	PendingBackups      int64   `json:"pending_backups"`
	RecentBackupsCount  int64   `json:"recent_backups_count"`
	TotalRestores       int64   `json:"total_restores"`
	SuccessRestores     int64   `json:"success_restores"`
	FailedRestores      int64   `json:"failed_restores"`
}

func (h *StatsHandler) GetDashboardStats(c *gin.Context) {
	workspaceIDStr := c.DefaultQuery("workspace_id", "1")
	var workspaceID uint = 1
	fmt.Sscanf(workspaceIDStr, "%d", &workspaceID)

	stats := &DashboardStats{}

	mysqlCount := new(int64)
	pgCount := new(int64)
	h.db.Model(&models.MySQLDatabase{}).Where("workspace_id = ?", workspaceID).Count(mysqlCount)
	h.db.Model(&models.PostgreSQLDatabase{}).Where("workspace_id = ?", workspaceID).Count(pgCount)
	stats.TotalDatabases = *mysqlCount + *pgCount

	h.db.Model(&models.Backup{}).Where("workspace_id = ?", workspaceID).Count(&stats.TotalBackups)

	var successCount, failedCount, pendingCount int64
	h.db.Model(&models.Backup{}).Where("workspace_id = ? AND status = ?", workspaceID, "success").Count(&successCount)
	h.db.Model(&models.Backup{}).Where("workspace_id = ? AND status = ?", workspaceID, "failed").Count(&failedCount)
	h.db.Model(&models.Backup{}).Where("workspace_id = ? AND status IN ?", workspaceID, []string{"pending", "running"}).Count(&pendingCount)

	if stats.TotalBackups > 0 {
		stats.SuccessRate = float64(successCount) / float64(stats.TotalBackups) * 100
	}

	stats.ActiveBackups = pendingCount
	stats.FailedBackups = failedCount
	stats.PendingBackups = pendingCount

	var totalSize int64
	h.db.Model(&models.Backup{}).Where("workspace_id = ? AND file_size > 0", workspaceID).
		Select("COALESCE(SUM(file_size), 0)").Scan(&totalSize)
	stats.StorageUsed = float64(totalSize) / (1024 * 1024 * 1024)
	stats.StorageTotal = 500

	oneDayAgo := time.Now().AddDate(0, 0, -1)
	h.db.Model(&models.Backup{}).Where("workspace_id = ? AND created_at >= ?", workspaceID, oneDayAgo).
		Count(&stats.RecentBackupsCount)

	h.db.Model(&models.Restore{}).Where("workspace_id = ?", workspaceID).Count(&stats.TotalRestores)
	h.db.Model(&models.Restore{}).Where("workspace_id = ? AND status = ?", workspaceID, "success").Count(&stats.SuccessRestores)
	h.db.Model(&models.Restore{}).Where("workspace_id = ? AND status = ?", workspaceID, "failed").Count(&stats.FailedRestores)

	c.JSON(200, stats)
}

func ParseJWTToken(tokenString, secret string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
