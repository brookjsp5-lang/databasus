package agent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type AgentServer struct {
	agents      map[string]*AgentConnection
	mu          sync.RWMutex
	backupQueue chan BackupTask
}

type AgentConnection struct {
	ID        string
	Conn      *websocket.Conn
	AuthToken string
	Register  time.Time
	LastSeen  time.Time
	Status    string
}

type BackupTask struct {
	AgentID     string
	BackupID    uint
	DatabaseID  uint
	DatabaseType string
	BackupType  string
	Options     map[string]interface{}
}

func NewAgentServer() *AgentServer {
	server := &AgentServer{
		agents:      make(map[string]*AgentConnection),
		backupQueue: make(chan BackupTask, 100),
	}
	go server.processBackupTasks()
	return server
}

func (s *AgentServer) HandleWebSocket(c *gin.Context) {
	agentID := c.GetHeader("X-Agent-ID")
	authToken := c.GetHeader("Authorization")

	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Agent-ID header required"})
		return
	}

	token := ""
	if len(authToken) > 7 && authToken[:7] == "Bearer " {
		token = authToken[7:]
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("Failed to upgrade connection: %v\n", err)
		return
	}

	agentConn := &AgentConnection{
		ID:        agentID,
		Conn:      conn,
		AuthToken: token,
		Register:  time.Now(),
		LastSeen:  time.Now(),
		Status:    "connected",
	}

	s.mu.Lock()
	s.agents[agentID] = agentConn
	s.mu.Unlock()

	go s.handleAgentMessages(agentConn)
}

func (s *AgentServer) handleAgentMessages(agentConn *AgentConnection) {
	defer func() {
		s.mu.Lock()
		delete(s.agents, agentConn.ID)
		s.mu.Unlock()
		agentConn.Conn.Close()
	}()

	for {
		_, message, err := agentConn.Conn.ReadMessage()
		if err != nil {
			fmt.Printf("Agent %s disconnected: %v\n", agentConn.ID, err)
			return
		}

		agentConn.LastSeen = time.Now()

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg["type"] {
		case "heartbeat":
			s.handleHeartbeat(agentConn, msg)
		case "backup_complete":
			s.handleBackupComplete(agentConn, msg)
		case "backup_progress":
			s.handleBackupProgress(agentConn, msg)
		case "backup_error":
			s.handleBackupError(agentConn, msg)
		}
	}
}

func (s *AgentServer) handleHeartbeat(agentConn *AgentConnection, msg map[string]interface{}) {
	agentConn.LastSeen = time.Now()
	if status, ok := msg["status"].(string); ok {
		agentConn.Status = status
	}
}

func (s *AgentServer) handleBackupComplete(agentConn *AgentConnection, msg map[string]interface{}) {
	backupID := uint(0)
	if id, ok := msg["backup_id"].(float64); ok {
		backupID = uint(id)
	}

	task := BackupTask{
		AgentID: agentConn.ID,
		BackupID: backupID,
	}
	
	s.backupQueue <- task
}

func (s *AgentServer) handleBackupProgress(agentConn *AgentConnection, msg map[string]interface{}) {
	fmt.Printf("Agent %s backup progress: %v\n", agentConn.ID, msg)
}

func (s *AgentServer) handleBackupError(agentConn *AgentConnection, msg map[string]interface{}) {
	fmt.Printf("Agent %s backup error: %v\n", agentConn.ID, msg)
}

func (s *AgentServer) processBackupTasks() {
	for task := range s.backupQueue {
		fmt.Printf("Processing backup task for agent %s, backup %d\n", 
			task.AgentID, task.BackupID)
	}
}

func (s *AgentServer) SendBackupTask(agentID string, task BackupTask) error {
	s.mu.RLock()
	agentConn, exists := s.agents[agentID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("agent %s not connected", agentID)
	}

	taskJSON, err := json.Marshal(map[string]interface{}{
		"type":           "backup_request",
		"backup_id":      task.BackupID,
		"database_id":    task.DatabaseID,
		"database_type":  task.DatabaseType,
		"backup_type":    task.BackupType,
		"options":        task.Options,
	})

	if err != nil {
		return fmt.Errorf("failed to marshal task: %w", err)
	}

	if err := agentConn.Conn.WriteMessage(websocket.TextMessage, taskJSON); err != nil {
		return fmt.Errorf("failed to send task: %w", err)
	}

	return nil
}

func (s *AgentServer) GetConnectedAgents() []AgentConnection {
	s.mu.RLock()
	defer s.mu.RUnlock()

	agents := make([]AgentConnection, 0, len(s.agents))
	for _, agent := range s.agents {
		agents = append(agents, *agent)
	}
	return agents
}

func (s *AgentServer) GetAgentStatus(agentID string) (*AgentConnection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if agent, exists := s.agents[agentID]; exists {
		return agent, nil
	}
	return nil, fmt.Errorf("agent %s not found", agentID)
}
