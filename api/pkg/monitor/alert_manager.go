package monitor

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type AlertManager struct {
	db             *gorm.DB
	alertChannels  map[string]AlertChannel
	mu             sync.RWMutex
	alertHistory   []Alert
	maxHistorySize int
}

type AlertChannel interface {
	Send(alert Alert) error
	GetName() string
}

type Alert struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Type        string    `json:"type"`
	Level       string    `json:"level"`
	Title       string    `json:"title"`
	Message     string    `json:"message"`
	WorkspaceID uint      `json:"workspace_id"`
	DatabaseID  *uint     `json:"database_id,omitempty"`
	BackupID    *uint     `json:"backup_id,omitempty"`
	IsRead      bool      `json:"is_read" gorm:"default:false"`
	IsResolved  bool      `json:"is_resolved" gorm:"default:false"`
	CreatedAt   time.Time `json:"created_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
}

type EmailChannel struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	ToAddresses  []string
	UseTLS       bool
}

func NewEmailChannel(host string, port int, username, password, from string, to []string, useTLS bool) *EmailChannel {
	return &EmailChannel{
		SMTPHost:    host,
		SMTPPort:    port,
		Username:    username,
		Password:    password,
		FromAddress: from,
		ToAddresses: to,
		UseTLS:      useTLS,
	}
}

func (e *EmailChannel) Send(alert Alert) error {
	return fmt.Errorf("email sending not implemented in this example")
}

func (e *EmailChannel) GetName() string {
	return "email"
}

type WebhookChannel struct {
	URL        string
	Headers    map[string]string
	RetryCount int
	Timeout    time.Duration
}

func NewWebhookChannel(url string, headers map[string]string) *WebhookChannel {
	return &WebhookChannel{
		URL:        url,
		Headers:    headers,
		RetryCount: 3,
		Timeout:    10 * time.Second,
	}
}

func (w *WebhookChannel) Send(alert Alert) error {
	return fmt.Errorf("webhook sending not implemented in this example")
}

func (w *WebhookChannel) GetName() string {
	return "webhook"
}

type SlackChannel struct {
	WebhookURL string
	Channel    string
	Username   string
	IconEmoji  string
}

func NewSlackChannel(webhookURL, channel, username, iconEmoji string) *SlackChannel {
	return &SlackChannel{
		WebhookURL: webhookURL,
		Channel:    channel,
		Username:   username,
		IconEmoji:  iconEmoji,
	}
}

func (s *SlackChannel) Send(alert Alert) error {
	return fmt.Errorf("slack sending not implemented in this example")
}

func (s *SlackChannel) GetName() string {
	return "slack"
}

type TelegramChannel struct {
	BotToken   string
	ChatID     string
	ParseMode  string
}

func NewTelegramChannel(botToken, chatID string) *TelegramChannel {
	return &TelegramChannel{
		BotToken:  botToken,
		ChatID:    chatID,
		ParseMode: "Markdown",
	}
}

func (t *TelegramChannel) Send(alert Alert) error {
	return fmt.Errorf("telegram sending not implemented in this example")
}

func (t *TelegramChannel) GetName() string {
	return "telegram"
}

func NewAlertManager(db *gorm.DB) *AlertManager {
	return &AlertManager{
		db:             db,
		alertChannels:  make(map[string]AlertChannel),
		maxHistorySize: 100,
	}
}

func (am *AlertManager) RegisterChannel(channel AlertChannel) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.alertChannels[channel.GetName()] = channel
}

func (am *AlertManager) CreateAlert(alertType, level, title, message string, workspaceID uint) (*Alert, error) {
	alert := &Alert{
		Type:        alertType,
		Level:       level,
		Title:       title,
		Message:     message,
		WorkspaceID: workspaceID,
		IsRead:      false,
		IsResolved:  false,
	}

	if err := am.db.Create(alert).Error; err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	am.mu.Lock()
	am.alertHistory = append(am.alertHistory, *alert)
	if len(am.alertHistory) > am.maxHistorySize {
		am.alertHistory = am.alertHistory[1:]
	}
	am.mu.Unlock()

	go am.sendAlertToChannels(*alert)

	return alert, nil
}

func (am *AlertManager) sendAlertToChannels(alert Alert) {
	am.mu.RLock()
	defer am.mu.RUnlock()

	for name, channel := range am.alertChannels {
		go func(ch AlertChannel, chName string) {
			if err := ch.Send(alert); err != nil {
				fmt.Printf("Failed to send alert via %s: %v\n", chName, err)
			}
		}(channel, name)
	}
}

func (am *AlertManager) CreateBackupFailureAlert(backup Backup, errorMsg string) (*Alert, error) {
	level := "error"
	if strings.Contains(errorMsg, "timeout") {
		level = "warning"
	}

	return am.CreateAlert(
		"backup_failed",
		level,
		fmt.Sprintf("Backup Failed: %s", backup.Name),
		fmt.Sprintf("Backup failed with error: %s", errorMsg),
		backup.WorkspaceID,
	)
}

func (am *AlertManager) CreateRestoreFailureAlert(restore Restore, errorMsg string) (*Alert, error) {
	level := "error"

	return am.CreateAlert(
		"restore_failed",
		level,
		fmt.Sprintf("Restore Failed: %s", restore.Name),
		fmt.Sprintf("Restore failed with error: %s", errorMsg),
		restore.WorkspaceID,
	)
}

func (am *AlertManager) CreateHealthIssueAlert(issue HealthIssue) (*Alert, error) {
	return am.CreateAlert(
		"health_issue",
		issue.Severity,
		fmt.Sprintf("Health Issue: %s", issue.Component),
		issue.Message,
		0,
	)
}

func (am *AlertManager) GetUnreadAlerts(workspaceID uint) ([]Alert, error) {
	var alerts []Alert
	if err := am.db.Where("workspace_id = ? AND is_read = ?", workspaceID, false).
		Order("created_at DESC").
		Find(&alerts).Error; err != nil {
		return nil, fmt.Errorf("failed to get unread alerts: %w", err)
	}
	return alerts, nil
}

func (am *AlertManager) MarkAlertAsRead(alertID uint) error {
	if err := am.db.Model(&Alert{}).Where("id = ?", alertID).
		Update("is_read", true).Error; err != nil {
		return fmt.Errorf("failed to mark alert as read: %w", err)
	}
	return nil
}

func (am *AlertManager) ResolveAlert(alertID uint) error {
	now := time.Now()
	if err := am.db.Model(&Alert{}).Where("id = ?", alertID).
		Updates(map[string]interface{}{
			"is_resolved": true,
			"resolved_at": &now,
		}).Error; err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}
	return nil
}

func (am *AlertManager) GetAlertHistory(limit int) []Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	if limit <= 0 || limit > len(am.alertHistory) {
		limit = len(am.alertHistory)
	}

	return am.alertHistory[len(am.alertHistory)-limit:]
}

func (am *AlertManager) CleanupOldAlerts(maxAge time.Duration) error {
	cutoff := time.Now().Add(-maxAge)

	result := am.db.Where("created_at < ? AND is_resolved = ?", cutoff, true).
		Delete(&Alert{})

	if result.Error != nil {
		return fmt.Errorf("failed to cleanup old alerts: %w", result.Error)
	}

	fmt.Printf("Cleaned up %d old alerts\n", result.RowsAffected)
	return nil
}

type Restore struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	Name        string `json:"name"`
	WorkspaceID uint   `json:"workspace_id"`
}
