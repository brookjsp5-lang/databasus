package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type AgentConfig struct {
	ID           string
	ServerURL    string
	AuthToken    string
	HeartbeatInt time.Duration
	Timeout      time.Duration
}

type Agent struct {
	config     AgentConfig
	conn       *websocket.Conn
	ctx        context.Context
	cancel     context.CancelFunc
	mu         sync.RWMutex
	isConnected bool
	backupHandlers map[string]BackupHandler
}

type BackupHandler func(ctx context.Context, req BackupRequest) error

type BackupRequest struct {
	Type        string          `json:"type"`
	DatabaseID  uint            `json:"database_id"`
	DatabaseType string         `json:"database_type"`
	BackupType  string          `json:"backup_type"`
	Options     json.RawMessage `json:"options"`
}

type BackupResponse struct {
	BackupID    uint   `json:"backup_id"`
	Status      string `json:"status"`
	Message     string `json:"message"`
	FilePath    string `json:"file_path,omitempty"`
	FileSize    int64  `json:"file_size,omitempty"`
	Progress    float64 `json:"progress"`
}

type HeartbeatMessage struct {
	Type      string    `json:"type"`
	AgentID   string    `json:"agent_id"`
	Timestamp time.Time `json:"timestamp"`
	Status    string    `json:"status"`
}

func NewAgent(config AgentConfig) *Agent {
	ctx, cancel := context.WithCancel(context.Background())
	return &Agent{
		config:         config,
		ctx:            ctx,
		cancel:         cancel,
		backupHandlers: make(map[string]BackupHandler),
	}
}

func (a *Agent) Start() error {
	if err := a.connect(); err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}

	go a.heartbeat()
	go a.readMessages()

	return nil
}

func (a *Agent) Stop() {
	a.cancel()
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.conn != nil {
		a.conn.Close()
	}
}

func (a *Agent) connect() error {
	u, err := url.Parse(a.config.ServerURL)
	if err != nil {
		return fmt.Errorf("invalid server URL: %w", err)
	}

	wsURL := fmt.Sprintf("ws%s://%s/api/v1/agent/connect", 
		map[bool]string{true: "s", false: ""}[u.Scheme == "https"], 
		u.Host)

	header := http.Header{}
	header.Set("Authorization", "Bearer "+a.config.AuthToken)
	header.Set("X-Agent-ID", a.config.ID)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return fmt.Errorf("failed to dial websocket: %w", err)
	}

	a.mu.Lock()
	a.conn = conn
	a.isConnected = true
	a.mu.Unlock()

	return nil
}

func (a *Agent) heartbeat() {
	ticker := time.NewTicker(a.config.HeartbeatInt)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.sendHeartbeat()
		}
	}
}

func (a *Agent) sendHeartbeat() {
	heartbeat := HeartbeatMessage{
		Type:      "heartbeat",
		AgentID:   a.config.ID,
		Timestamp: time.Now(),
		Status:    "healthy",
	}

	a.mu.RLock()
	defer a.mu.RUnlock()

	if a.conn != nil {
		if err := a.conn.WriteJSON(heartbeat); err != nil {
			fmt.Printf("Failed to send heartbeat: %v\n", err)
		}
	}
}

func (a *Agent) readMessages() {
	for {
		select {
		case <-a.ctx.Done():
			return
		default:
			_, message, err := a.conn.ReadMessage()
			if err != nil {
				fmt.Printf("Failed to read message: %v\n", err)
				a.reconnect()
				continue
			}

			a.handleMessage(message)
		}
	}
}

func (a *Agent) handleMessage(message []byte) {
	var req BackupRequest
	if err := json.Unmarshal(message, &req); err != nil {
		fmt.Printf("Failed to unmarshal message: %v\n", err)
		return
	}

	if handler, ok := a.backupHandlers[req.Type]; ok {
		go func() {
			if err := handler(a.ctx, req); err != nil {
				a.sendError(req.BackupID, err.Error())
			}
		}()
	}
}

func (a *Agent) RegisterBackupHandler(backupType string, handler BackupHandler) {
	a.backupHandlers[backupType] = handler
}

func (a *Agent) sendResponse(resp BackupResponse) error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if a.conn != nil {
		return a.conn.WriteJSON(resp)
	}
	return fmt.Errorf("not connected")
}

func (a *Agent) sendError(backupID uint, message string) {
	resp := BackupResponse{
		BackupID: backupID,
		Status:   "failed",
		Message:  message,
	}
	a.sendResponse(resp)
}

func (a *Agent) reconnect() {
	a.mu.Lock()
	a.isConnected = false
	if a.conn != nil {
		a.conn.Close()
	}
	a.mu.Unlock()

	time.Sleep(5 * time.Second)

	for i := 0; i < 3; i++ {
		if err := a.connect(); err != nil {
			fmt.Printf("Reconnection attempt %d failed: %v\n", i+1, err)
			time.Sleep(time.Duration(i+1) * 5 * time.Second)
			continue
		}
		return
	}
}

func (a *Agent) IsConnected() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.isConnected
}
