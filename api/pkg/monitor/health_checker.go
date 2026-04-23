package monitor

import (
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"
)

type HealthChecker struct {
	db             *gorm.DB
	checkInterval  time.Duration
	lastCheckTime  time.Time
	lastCheckResult *HealthCheckResult
	mu             sync.RWMutex
}

type HealthCheckResult struct {
	Status        string                  `json:"status"`
	Timestamp     time.Time               `json:"timestamp"`
	Components    map[string]ComponentHealth `json:"components"`
	OverallScore  float64                 `json:"overall_score"`
	Issues        []HealthIssue           `json:"issues"`
}

type ComponentHealth struct {
	Status    string  `json:"status"`
	Latency   float64 `json:"latency_ms"`
	Message   string  `json:"message,omitempty"`
	LastCheck time.Time `json:"last_check"`
}

type HealthIssue struct {
	Severity   string `json:"severity"`
	Component  string `json:"component"`
	Message    string `json:"message"`
	Timestamp  time.Time `json:"timestamp"`
}

func NewHealthChecker(db *gorm.DB, checkInterval time.Duration) *HealthChecker {
	return &HealthChecker{
		db:            db,
		checkInterval: checkInterval,
	}
}

func (hc *HealthChecker) RunHealthCheck() (*HealthCheckResult, error) {
	result := &HealthCheckResult{
		Timestamp:  time.Now(),
		Components: make(map[string]ComponentHealth),
		Issues:     []HealthIssue{},
	}

	var totalScore float64 = 100
	var componentCount int = 0

	if dbHealth, err := hc.checkDatabase(); err != nil {
		result.Components["database"] = ComponentHealth{
			Status:    "unhealthy",
			Message:   err.Error(),
			LastCheck: time.Now(),
		}
		result.Issues = append(result.Issues, HealthIssue{
			Severity:   "critical",
			Component:  "database",
			Message:    fmt.Sprintf("Database health check failed: %v", err),
			Timestamp:  time.Now(),
		})
		totalScore -= 50
	} else {
		result.Components["database"] = dbHealth
	}

	componentCount++

	if storageHealth, err := hc.checkStorage(); err != nil {
		result.Components["storage"] = ComponentHealth{
			Status:    "unhealthy",
			Message:   err.Error(),
			LastCheck: time.Now(),
		}
		result.Issues = append(result.Issues, HealthIssue{
			Severity:   "warning",
			Component:  "storage",
			Message:    fmt.Sprintf("Storage health check failed: %v", err),
			Timestamp:  time.Now(),
		})
		totalScore -= 20
	} else {
		result.Components["storage"] = storageHealth
	}

	componentCount++

	if backupHealth, err := hc.checkBackupStatus(); err != nil {
		result.Components["backup"] = ComponentHealth{
			Status:    "unhealthy",
			Message:   err.Error(),
			LastCheck: time.Now(),
		}
		result.Issues = append(result.Issues, HealthIssue{
			Severity:   "warning",
			Component:  "backup",
			Message:    fmt.Sprintf("Backup health check failed: %v", err),
			Timestamp:  time.Now(),
		})
		totalScore -= 15
	} else {
		result.Components["backup"] = backupHealth
	}

	componentCount++

	if agentHealth, err := hc.checkAgentStatus(); err != nil {
		result.Components["agent"] = ComponentHealth{
			Status:    "warning",
			Message:   err.Error(),
			LastCheck: time.Now(),
		}
		result.Issues = append(result.Issues, HealthIssue{
			Severity:   "warning",
			Component:  "agent",
			Message:    fmt.Sprintf("Agent health check issue: %v", err),
			Timestamp:  time.Now(),
		})
		totalScore -= 10
	} else {
		result.Components["agent"] = agentHealth
	}

	componentCount++

	if result.OverallScore = totalScore / float64(componentCount); result.OverallScore >= 80 {
		result.Status = "healthy"
	} else if result.OverallScore >= 50 {
		result.Status = "degraded"
	} else {
		result.Status = "unhealthy"
	}

	hc.mu.Lock()
	hc.lastCheckTime = time.Now()
	hc.lastCheckResult = result
	hc.mu.Unlock()

	return result, nil
}

func (hc *HealthChecker) checkDatabase() (ComponentHealth, error) {
	start := time.Now()

	sqlDB, err := hc.db.DB()
	if err != nil {
		return ComponentHealth{}, fmt.Errorf("failed to get database connection: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return ComponentHealth{
			Status:    "unhealthy",
			Latency:   float64(time.Since(start).Milliseconds()),
			LastCheck: time.Now(),
		}, fmt.Errorf("database ping failed: %w", err)
	}

	return ComponentHealth{
		Status:    "healthy",
		Latency:   float64(time.Since(start).Milliseconds()),
		LastCheck: time.Now(),
	}, nil
}

func (hc *HealthChecker) checkStorage() (ComponentHealth, error) {
	start := time.Now()

	var count int64
	if err := hc.db.Model(&Backup{}).Count(&count).Error; err != nil {
		return ComponentHealth{
			Status:    "unhealthy",
			Latency:   float64(time.Since(start).Milliseconds()),
			LastCheck: time.Now(),
		}, fmt.Errorf("failed to query backup storage: %w", err)
	}

	return ComponentHealth{
		Status:    "healthy",
		Latency:   float64(time.Since(start).Milliseconds()),
		Message:   fmt.Sprintf("Found %d backups", count),
		LastCheck: time.Now(),
	}, nil
}

func (hc *HealthChecker) checkBackupStatus() (ComponentHealth, error) {
	start := time.Now()

	var recentFailures int64
	cutoff := time.Now().Add(-24 * time.Hour)

	if err := hc.db.Model(&Backup{}).
		Where("status = ? AND backup_time > ?", "failed", cutoff).
		Count(&recentFailures).Error; err != nil {
		return ComponentHealth{
			Status:    "warning",
			Latency:   float64(time.Since(start).Milliseconds()),
			LastCheck: time.Now(),
		}, fmt.Errorf("failed to check backup status: %w", err)
	}

	message := fmt.Sprintf("No recent failures in the last 24 hours")
	if recentFailures > 0 {
		message = fmt.Sprintf("Found %d failed backups in the last 24 hours", recentFailures)
	}

	status := "healthy"
	if recentFailures > 5 {
		status = "warning"
	}

	return ComponentHealth{
		Status:    status,
		Latency:   float64(time.Since(start).Milliseconds()),
		Message:   message,
		LastCheck: time.Now(),
	}, nil
}

func (hc *HealthChecker) checkAgentStatus() (ComponentHealth, error) {
	start := time.Now()

	var activeAgents int64
	if err := hc.db.Model(&AgentConnection{}).
		Where("status = ? AND last_seen > ?", "connected", time.Now().Add(-5*time.Minute)).
		Count(&activeAgents).Error; err != nil {
		return ComponentHealth{
			Status:    "warning",
			Latency:   float64(time.Since(start).Milliseconds()),
			LastCheck: time.Now(),
		}, fmt.Errorf("failed to check agent status: %w", err)
	}

	message := fmt.Sprintf("All agents connected")
	status := "healthy"

	if activeAgents == 0 {
		message = "No active agents connected"
	}

	return ComponentHealth{
		Status:    status,
		Latency:   float64(time.Since(start).Milliseconds()),
		Message:   message,
		LastCheck: time.Now(),
	}, nil
}

func (hc *HealthChecker) GetLastCheckResult() *HealthCheckResult {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	return hc.lastCheckResult
}

func (hc *HealthChecker) StartPeriodicCheck(done <-chan struct{}) {
	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			hc.RunHealthCheck()
		}
	}
}

type Backup struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	CreatedAt    time.Time      `json:"created_at"`
	Status       string         `json:"status"`
	BackupTime   time.Time      `json:"backup_time"`
	WorkspaceID  uint           `json:"workspace_id"`
}

type AgentConnection struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Status    string    `json:"status"`
	LastSeen  time.Time `json:"last_seen"`
}
