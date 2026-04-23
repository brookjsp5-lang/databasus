package notification

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"github.com/datatrue-new/api/internal/models"
	"gorm.io/gorm"
)

type NotificationType string

const (
	NotificationTypeBackupSuccess   NotificationType = "backup_success"
	NotificationTypeBackupFailed    NotificationType = "backup_failed"
	NotificationTypeRestoreSuccess   NotificationType = "restore_success"
	NotificationTypeRestoreFailed    NotificationType = "restore_failed"
	NotificationTypeWALBackupError  NotificationType = "wal_backup_error"
	NotificationTypeTestEmail        NotificationType = "test_email"
)

type NotificationChannel string

const (
	ChannelEmail    NotificationChannel = "email"
	ChannelDingTalk NotificationChannel = "dingtalk"
	ChannelWeChat   NotificationChannel = "wechat"
	ChannelWebhook  NotificationChannel = "webhook"
)

type NotificationMessage struct {
	Type       NotificationType         `json:"type"`
	Title      string                  `json:"title"`
	Message    string                  `json:"message"`
	Database   string                  `json:"database,omitempty"`
	Workspace  string                  `json:"workspace,omitempty"`
	Time       time.Time               `json:"time"`
	Details    map[string]interface{}  `json:"details,omitempty"`
}

type Notifier interface {
	Send(ctx context.Context, msg NotificationMessage, to string) error
	Test(to string) error
}

type NotificationService struct {
	db        *gorm.DB
	notifiers map[NotificationChannel]Notifier
}

func NewNotificationService(db *gorm.DB) *NotificationService {
	return &NotificationService{
		db:        db,
		notifiers: make(map[NotificationChannel]Notifier),
	}
}

func (s *NotificationService) RegisterNotifier(channel NotificationChannel, notifier Notifier) {
	s.notifiers[channel] = notifier
}

func (s *NotificationService) SendNotification(workspaceID uint, channel NotificationChannel, msg NotificationMessage, to string) error {
	notifier, ok := s.notifiers[channel]
	if !ok {
		return fmt.Errorf("notifier for channel %s not registered", channel)
	}

	if err := notifier.Send(context.Background(), msg, to); err != nil {
		s.logNotification(workspaceID, channel, msg, false, err.Error())
		return err
	}

	s.logNotification(workspaceID, channel, msg, true, "")
	return nil
}

func (s *NotificationService) logNotification(workspaceID uint, channel NotificationChannel, msg NotificationMessage, success bool, errorMsg string) {
	level := "info"
	if !success {
		level = "error"
	}

	alert := models.Alert{
		Type:        string(msg.Type),
		Level:       level,
		Title:       msg.Title,
		Message:     msg.Message,
		WorkspaceID: workspaceID,
		IsRead:      false,
		IsResolved:  success,
	}

	if !success {
		alert.Message = fmt.Sprintf("%s (Error: %s)", alert.Message, errorMsg)
	}

	s.db.Create(&alert)
}

type SMTPConfig struct {
	ID            uint   `json:"id"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	Encryption    string `json:"encryption"`
	FromAddress   string `json:"from_address"`
	FromName      string `json:"from_name"`
	IsEnabled     bool   `json:"is_enabled"`
}

type EmailNotifier struct {
	config SMTPConfig
}

func NewEmailNotifier(config SMTPConfig) *EmailNotifier {
	return &EmailNotifier{config: config}
}

func (e *EmailNotifier) Send(ctx context.Context, msg NotificationMessage, to string) error {
	if !e.config.IsEnabled || to == "" {
		return fmt.Errorf("email sending is disabled or recipient is empty")
	}

	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", e.config.FromName, e.config.FromAddress)
	headers["To"] = to
	headers["Subject"] = msg.Title
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	var body bytes.Buffer
	body.WriteString("From: " + headers["From"] + "\r\n")
	body.WriteString("To: " + headers["To"] + "\r\n")
	body.WriteString("Subject: " + headers["Subject"] + "\r\n")
	body.WriteString("MIME-Version: " + headers["MIME-Version"] + "\r\n")
	body.WriteString("Content-Type: " + headers["Content-Type"] + "\r\n")
	body.WriteString("\r\n")

	body.WriteString("<html><body>")
	body.WriteString(fmt.Sprintf("<h2>%s</h2>", msg.Title))
	body.WriteString(fmt.Sprintf("<p>%s</p>", msg.Message))
	body.WriteString(fmt.Sprintf("<p style='color:#666;font-size:12px;'>发送时间: %s</p>", msg.Time.Format("2006-01-02 15:04:05")))
	body.WriteString("</body></html>")

	auth := smtp.PlainAuth("", e.config.Username, e.config.Password, e.config.Host)

	switch e.config.Encryption {
	case "tls", "starttls":
		return e.sendWithTLS(headers, &body, auth, to)
	case "ssl":
		return e.sendWithSSL(headers, &body, auth, to)
	default:
		return e.sendPlain(headers, &body, auth, to)
	}
}

func (e *EmailNotifier) sendPlain(headers map[string]string, body *bytes.Buffer, auth smtp.Auth, to string) error {
	addr := fmt.Sprintf("%s:%d", e.config.Host, e.config.Port)
	if err := smtp.SendMail(addr, auth, e.config.FromAddress, []string{to}, body.Bytes()); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	return nil
}

func (e *EmailNotifier) sendWithTLS(headers map[string]string, body *bytes.Buffer, auth smtp.Auth, to string) error {
	tlsConfig := &tls.Config{
		ServerName: e.config.Host,
	}

	addr := fmt.Sprintf("%s:%d", e.config.Host, e.config.Port)

	if e.config.Encryption == "starttls" {
		conn, err := smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("failed to connect to SMTP server: %w", err)
		}

		if err := conn.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("failed to start TLS: %w", err)
		}

		if err := conn.Auth(auth); err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}

		if err := conn.Mail(e.config.FromAddress); err != nil {
			return fmt.Errorf("failed to set sender: %w", err)
		}

		if err := conn.Rcpt(to); err != nil {
			return fmt.Errorf("failed to set recipient: %w", err)
		}

		w, err := conn.Data()
		if err != nil {
			return fmt.Errorf("failed to open data writer: %w", err)
		}

		if _, err := w.Write(body.Bytes()); err != nil {
			return fmt.Errorf("failed to write email body: %w", err)
		}

		if err := w.Close(); err != nil {
			return fmt.Errorf("failed to close data writer: %w", err)
		}

		return conn.Quit()
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server with TLS: %w", err)
	}

	client, err := smtp.NewClient(conn, e.config.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	if err := client.Mail(e.config.FromAddress); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to open data writer: %w", err)
	}

	if _, err := w.Write(body.Bytes()); err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

func (e *EmailNotifier) sendWithSSL(headers map[string]string, body *bytes.Buffer, auth smtp.Auth, to string) error {
	tlsConfig := &tls.Config{
		ServerName: e.config.Host,
	}

	addr := fmt.Sprintf("%s:%d", e.config.Host, e.config.Port)
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server with SSL: %w", err)
	}

	client, err := smtp.NewClient(conn, e.config.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	if err := client.Mail(e.config.FromAddress); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to open data writer: %w", err)
	}

	if _, err := w.Write(body.Bytes()); err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

func (e *EmailNotifier) Test(to string) error {
	if !e.config.IsEnabled {
		return fmt.Errorf("SMTP is not enabled")
	}

	if to == "" {
		return fmt.Errorf("test recipient email is required")
	}

	testMsg := NotificationMessage{
		Type:    NotificationTypeTestEmail,
		Title:   "DataTrue 邮件通知测试",
		Message: "这是一封来自DataTrue系统的测试邮件。如果您收到此邮件，说明SMTP配置正确。",
		Time:    time.Now(),
	}

	return e.Send(context.Background(), testMsg, to)
}

type SMTPService struct {
	db *gorm.DB
}

func NewSMTPService(db *gorm.DB) *SMTPService {
	return &SMTPService{db: db}
}

func (s *SMTPService) GetConfig() (*SMTPConfig, error) {
	var settings []models.SystemSetting
	if err := s.db.Where("key LIKE ?", "smtp_%").Find(&settings).Error; err != nil {
		return nil, err
	}

	config := &SMTPConfig{ID: 1}
	for _, setting := range settings {
		switch setting.Key {
		case "smtp_host":
			config.Host = setting.Value
		case "smtp_port":
			fmt.Sscanf(setting.Value, "%d", &config.Port)
		case "smtp_username":
			config.Username = setting.Value
		case "smtp_password":
			config.Password = setting.Value
		case "smtp_encryption":
			config.Encryption = setting.Value
		case "smtp_from_address":
			config.FromAddress = setting.Value
		case "smtp_from_name":
			config.FromName = setting.Value
		case "smtp_is_enabled":
			config.IsEnabled = setting.Value == "true"
		}
	}

	return config, nil
}

func (s *SMTPService) SaveConfig(config *SMTPConfig) error {
	settings := []models.SystemSetting{
		{Key: "smtp_host", Value: config.Host, Type: "string"},
		{Key: "smtp_port", Value: fmt.Sprintf("%d", config.Port), Type: "number"},
		{Key: "smtp_username", Value: config.Username, Type: "string"},
		{Key: "smtp_password", Value: config.Password, Type: "string"},
		{Key: "smtp_encryption", Value: config.Encryption, Type: "string"},
		{Key: "smtp_from_address", Value: config.FromAddress, Type: "string"},
		{Key: "smtp_from_name", Value: config.FromName, Type: "string"},
		{Key: "smtp_is_enabled", Value: boolToString(config.IsEnabled), Type: "boolean"},
	}

	for _, setting := range settings {
		if err := s.db.Where("key = ?", setting.Key).Assign(setting).FirstOrCreate(&setting).Error; err != nil {
			return err
		}
	}

	return nil
}

func (s *SMTPService) TestConnection(config *SMTPConfig) error {
	emailNotifier := NewEmailNotifier(*config)
	return emailNotifier.Test(config.FromAddress)
}

type DingTalkNotifier struct {
	webhookURL string
	secret     string
}

func NewDingTalkNotifier(webhookURL, secret string) *DingTalkNotifier {
	return &DingTalkNotifier{
		webhookURL: webhookURL,
		secret:     secret,
	}
}

type DingTalkMessage struct {
	MsgType string `json:"msgtype"`
	Text    struct {
		Content string `json:"content"`
	} `json:"text"`
}

func (d *DingTalkNotifier) Send(ctx context.Context, msg NotificationMessage, to string) error {
	dingMsg := DingTalkMessage{
		MsgType: "text",
	}
	dingMsg.Text.Content = fmt.Sprintf("【%s】\n%s\n\n%s", msg.Title, msg.Message, msg.Time.Format("2006-01-02 15:04:05"))

	jsonData, err := json.Marshal(dingMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal dingtalk message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", d.webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send dingtalk notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("dingtalk API returned status %d", resp.StatusCode)
	}

	return nil
}

func (d *DingTalkNotifier) Test(to string) error {
	return d.Send(context.Background(), NotificationMessage{
		Type:    NotificationTypeTestEmail,
		Title:   "钉钉通知测试",
		Message: "这是一条来自DataTrue系统的测试消息。",
		Time:    time.Now(),
	}, to)
}

type WeChatNotifier struct {
	webhookURL string
}

func NewWeChatNotifier(webhookURL string) *WeChatNotifier {
	return &WeChatNotifier{webhookURL: webhookURL}
}

type WeChatMessage struct {
	MsgType string `json:"msgtype"`
	Text    struct {
		Content string `json:"content"`
	} `json:"text"`
}

func (w *WeChatNotifier) Send(ctx context.Context, msg NotificationMessage, to string) error {
	wechatMsg := WeChatMessage{
		MsgType: "text",
	}
	wechatMsg.Text.Content = fmt.Sprintf("【%s】\n%s\n\n%s", msg.Title, msg.Message, msg.Time.Format("2006-01-02 15:04:05"))

	jsonData, err := json.Marshal(wechatMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal wechat message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", w.webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send wechat notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("wechat API returned status %d", resp.StatusCode)
	}

	return nil
}

func (w *WeChatNotifier) Test(to string) error {
	return w.Send(context.Background(), NotificationMessage{
		Type:    NotificationTypeTestEmail,
		Title:   "企业微信通知测试",
		Message: "这是一条来自DataTrue系统的测试消息。",
		Time:    time.Now(),
	}, to)
}

type WebhookNotifier struct {
	url    string
	secret string
}

func NewWebhookNotifier(url, secret string) *WebhookNotifier {
	return &WebhookNotifier{
		url:    url,
		secret: secret,
	}
}

type WebhookPayload struct {
	Event     string                 `json:"event"`
	Timestamp int64                  `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

func (w *WebhookNotifier) Send(ctx context.Context, msg NotificationMessage, to string) error {
	payload := WebhookPayload{
		Event:     string(msg.Type),
		Timestamp: msg.Time.Unix(),
		Data: map[string]interface{}{
			"title":   msg.Title,
			"message": msg.Message,
			"details": msg.Details,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", w.url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if w.secret != "" {
		req.Header.Set("X-Webhook-Secret", w.secret)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("webhook API returned status %d", resp.StatusCode)
	}

	return nil
}

func (w *WebhookNotifier) Test(to string) error {
	return w.Send(context.Background(), NotificationMessage{
		Type:    NotificationTypeTestEmail,
		Title:   "Webhook通知测试",
		Message: "这是一条来自DataTrue系统的测试消息。",
		Time:    time.Now(),
	}, to)
}

type NotificationConfig struct {
	WorkspaceID     uint
	EmailEnabled    bool
	Email           string
	DingTalkEnabled bool
	DingTalkWebhook string
	DingTalkSecret  string
	WeChatEnabled   bool
	WeChatWebhook   string
	WebhookEnabled  bool
	WebhookURL      string
	WebhookSecret   string
}

func (s *NotificationService) LoadConfig(workspaceID uint) (*NotificationConfig, error) {
	var setting models.SystemSetting
	var cfg NotificationConfig
	cfg.WorkspaceID = workspaceID

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_email", workspaceID).First(&setting).Error; err == nil {
		cfg.Email = setting.Value
		cfg.EmailEnabled = setting.Value != ""
	}

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_dingtalk_webhook", workspaceID).First(&setting).Error; err == nil {
		cfg.DingTalkWebhook = setting.Value
		cfg.DingTalkEnabled = setting.Value != ""
	}

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_dingtalk_secret", workspaceID).First(&setting).Error; err == nil {
		cfg.DingTalkSecret = setting.Value
	}

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_wechat_webhook", workspaceID).First(&setting).Error; err == nil {
		cfg.WeChatWebhook = setting.Value
		cfg.WeChatEnabled = setting.Value != ""
	}

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_webhook_url", workspaceID).First(&setting).Error; err == nil {
		cfg.WebhookURL = setting.Value
		cfg.WebhookEnabled = setting.Value != ""
	}

	if err := s.db.Where("key = ? AND workspace_id = ?", "notification_webhook_secret", workspaceID).First(&setting).Error; err == nil {
		cfg.WebhookSecret = setting.Value
	}

	return &cfg, nil
}

func (s *NotificationService) NotifyBackupResult(workspaceID uint, backup *models.Backup, success bool, errorMsg string) {
	msgType := NotificationTypeBackupSuccess
	title := "备份成功"
	message := fmt.Sprintf("数据库备份成功完成，备份ID: %d", backup.ID)

	if !success {
		msgType = NotificationTypeBackupFailed
		title = "备份失败"
		message = fmt.Sprintf("数据库备份失败: %s", errorMsg)
	}

	cfg, err := s.LoadConfig(workspaceID)
	if err != nil {
		return
	}

	msg := NotificationMessage{
		Type:    msgType,
		Title:   title,
		Message: message,
		Time:    time.Now(),
		Details: map[string]interface{}{
			"backup_id":     backup.ID,
			"database_id":   backup.DatabaseID,
			"database_type": backup.DatabaseType,
			"file_size":     backup.FileSize,
		},
	}

	if cfg.EmailEnabled {
		s.SendNotification(workspaceID, ChannelEmail, msg, cfg.Email)
	}
	if cfg.DingTalkEnabled {
		s.SendNotification(workspaceID, ChannelDingTalk, msg, "")
	}
	if cfg.WeChatEnabled {
		s.SendNotification(workspaceID, ChannelWeChat, msg, "")
	}
	if cfg.WebhookEnabled {
		s.SendNotification(workspaceID, ChannelWebhook, msg, "")
	}
}

func (s *NotificationService) NotifyRestoreResult(workspaceID uint, restore *models.Restore, success bool, errorMsg string) {
	msgType := NotificationTypeRestoreSuccess
	title := "恢复成功"
	message := fmt.Sprintf("数据库恢复成功完成，恢复ID: %d", restore.ID)

	if !success {
		msgType = NotificationTypeRestoreFailed
		title = "恢复失败"
		message = fmt.Sprintf("数据库恢复失败: %s", errorMsg)
	}

	cfg, err := s.LoadConfig(workspaceID)
	if err != nil {
		return
	}

	msg := NotificationMessage{
		Type:    msgType,
		Title:   title,
		Message: message,
		Time:    time.Now(),
		Details: map[string]interface{}{
			"restore_id":    restore.ID,
			"backup_id":     restore.BackupID,
			"database_id":   restore.DatabaseID,
			"database_type": restore.DatabaseType,
		},
	}

	if cfg.DingTalkEnabled {
		s.SendNotification(workspaceID, ChannelDingTalk, msg, "")
	}
	if cfg.WeChatEnabled {
		s.SendNotification(workspaceID, ChannelWeChat, msg, "")
	}
	if cfg.WebhookEnabled {
		s.SendNotification(workspaceID, ChannelWebhook, msg, "")
	}
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
