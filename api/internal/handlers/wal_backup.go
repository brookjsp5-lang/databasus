package handlers

import (
	"fmt"
	"net/http"

	"github.com/datatrue-new/api/pkg/backup"
	"github.com/gin-gonic/gin"
)

type WALBackupHandler struct {
	walService *backup.WALBackupService
}

func NewWALBackupHandler(walService *backup.WALBackupService) *WALBackupHandler {
	return &WALBackupHandler{walService: walService}
}

func (h *WALBackupHandler) GetWALBackupStatus(c *gin.Context) {
	databaseIDStr := c.Query("database_id")
	databaseType := c.Query("database_type")

	if databaseIDStr == "" || databaseType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "database_id and database_type are required"})
		return
	}

	var databaseID uint
	if _, err := fmt.Sscanf(databaseIDStr, "%d", &databaseID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid database_id"})
		return
	}

	status, err := h.walService.GetBackupStatus(databaseID, databaseType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": status})
}

func (h *WALBackupHandler) StartWALBackup(c *gin.Context) {
	var req struct {
		DatabaseID   uint   `json:"database_id" binding:"required"`
		DatabaseType string `json:"database_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WAL backup started"})
}

func (h *WALBackupHandler) StopWALBackup(c *gin.Context) {
	var req struct {
		DatabaseID   uint   `json:"database_id" binding:"required"`
		DatabaseType string `json:"database_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.walService.StopBackup(req.DatabaseID, req.DatabaseType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WAL backup stopped"})
}