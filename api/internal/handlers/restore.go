package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/restore"
	"github.com/databasus-new/api/pkg/scheduler"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RestoreHandler struct {
	db *gorm.DB
}

func NewRestoreHandler(db *gorm.DB) *RestoreHandler {
	return &RestoreHandler{db: db}
}

type CreateRestoreRequest struct {
	WorkspaceID        uint       `json:"workspace_id" binding:"required"`
	BackupID           uint       `json:"backup_id" binding:"required"`
	DatabaseID         uint       `json:"database_id" binding:"required"`
	DatabaseType       string     `json:"database_type" binding:"required"`
	PITRTime           *time.Time `json:"pitr_time"`
	ConfirmRestore     bool       `json:"confirm_restore"`
	BackupBeforeRestore bool      `json:"backup_before_restore"`
}

type CheckRestoreTargetRequest struct {
	BackupID     uint   `json:"backup_id" binding:"required"`
	DatabaseID   uint   `json:"database_id" binding:"required"`
	DatabaseType string `json:"database_type" binding:"required"`
}

type RestoreTargetInfo struct {
	IsOriginalInstance   bool   `json:"is_original_instance"`
	WarningMessage       string `json:"warning_message"`
	RequiresConfirmation bool   `json:"requires_confirmation"`
}

func (h *RestoreHandler) GetAll(c *gin.Context) {
	var restores []models.Restore
	if err := h.db.Find(&restores).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get restores"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"restores": restores})
}

func (h *RestoreHandler) CheckRestoreTarget(c *gin.Context) {
	var req CheckRestoreTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var backup models.Backup
	if err := h.db.First(&backup, req.BackupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	isOriginalInstance := false
	warningMessage := ""

	switch req.DatabaseType {
	case "mysql":
		isOriginalInstance = h.checkMySQLOriginalInstance(req.DatabaseID, backup.DatabaseID)
	case "postgresql":
		isOriginalInstance = h.checkPostgreSQLOriginalInstance(req.DatabaseID, backup.DatabaseID)
	}

	if isOriginalInstance {
		warningMessage = "警告：您正在恢复到原始数据库实例！当前数据库数据将被覆盖。建议在恢复前先创建一个当前数据的备份。是否继续？"
	}

	c.JSON(http.StatusOK, gin.H{
		"is_original_instance":   isOriginalInstance,
		"warning_message":       warningMessage,
		"requires_confirmation": isOriginalInstance,
	})
}

func (h *RestoreHandler) checkMySQLOriginalInstance(targetDBID, backupDBID uint) bool {
	if targetDBID != backupDBID {
		return false
	}

	var targetDB, backupDB models.MySQLDatabase
	if err := h.db.First(&targetDB, targetDBID).Error; err != nil {
		return false
	}
	if err := h.db.First(&backupDB, backupDBID).Error; err != nil {
		return false
	}

	return targetDB.Host == backupDB.Host &&
		targetDB.Port == backupDB.Port &&
		targetDB.DatabaseName == backupDB.DatabaseName
}

func (h *RestoreHandler) checkPostgreSQLOriginalInstance(targetDBID, backupDBID uint) bool {
	if targetDBID != backupDBID {
		return false
	}

	var targetDB, backupDB models.PostgreSQLDatabase
	if err := h.db.First(&targetDB, targetDBID).Error; err != nil {
		return false
	}
	if err := h.db.First(&backupDB, backupDBID).Error; err != nil {
		return false
	}

	return targetDB.Host == backupDB.Host &&
		targetDB.Port == backupDB.Port &&
		targetDB.DatabaseName == backupDB.DatabaseName
}

func (h *RestoreHandler) Create(c *gin.Context) {
	var req CreateRestoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var backup models.Backup
	if err := h.db.First(&backup, req.BackupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	isOriginalInstance := false
	switch req.DatabaseType {
	case "mysql":
		isOriginalInstance = h.checkMySQLOriginalInstance(req.DatabaseID, backup.DatabaseID)
	case "postgresql":
		isOriginalInstance = h.checkPostgreSQLOriginalInstance(req.DatabaseID, backup.DatabaseID)
	}

	if isOriginalInstance && !req.ConfirmRestore {
		c.JSON(http.StatusConflict, gin.H{
			"error":                    "恢复到原始数据库实例需要确认",
			"requires_confirmation":    true,
			"warning_message":          "警告：您正在恢复到原始数据库实例！当前数据库数据将被覆盖。",
			"backup_before_restore_suggested": true,
		})
		return
	}

	restoreRecord := models.Restore{
		WorkspaceID:   req.WorkspaceID,
		BackupID:      req.BackupID,
		DatabaseID:    req.DatabaseID,
		DatabaseType:  req.DatabaseType,
		Status:        "pending",
		RestoreTime:   time.Now(),
		PITRTime:     req.PITRTime,
		Progress:     0,
	}

	if err := h.db.Create(&restoreRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create restore"})
		return
	}

	if sched := scheduler.GetScheduler(); sched != nil {
		restorePayload := scheduler.TaskPayload{
			Type:         scheduler.TaskTypeRestore,
			TaskID:       restoreRecord.ID,
			WorkspaceID:  req.WorkspaceID,
			DatabaseID:   req.DatabaseID,
			DatabaseType: req.DatabaseType,
			BackupID:     req.BackupID,
			PITRTime:    req.PITRTime,
			Config: map[string]interface{}{
				"backup_before_restore": req.BackupBeforeRestore,
			},
		}
		sched.EnqueueRestoreTaskWithConfig(restorePayload)
	}

	c.JSON(http.StatusCreated, gin.H{"restore": restoreRecord})
}

func (h *RestoreHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore ID"})
		return
	}

	var restoreRecord models.Restore
	if err := h.db.First(&restoreRecord, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"restore": restoreRecord})
}

func (h *RestoreHandler) Cancel(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore ID"})
		return
	}

	var restoreRecord models.Restore
	if err := h.db.First(&restoreRecord, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
		return
	}

	if restoreRecord.Status != "pending" && restoreRecord.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel restore in current status"})
		return
	}

	restoreRecord.Status = "cancelled"
	h.db.Save(&restoreRecord)

	c.JSON(http.StatusOK, gin.H{"message": "Restore cancelled", "restore": restoreRecord})
}

func (h *RestoreHandler) GetRestoreLogs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore ID"})
		return
	}

	var restoreRecord models.Restore
	if err := h.db.First(&restoreRecord, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"restore_id": restoreRecord.ID,
		"status":     restoreRecord.Status,
		"progress":   restoreRecord.Progress,
		"error_msg": restoreRecord.ErrorMsg,
	})
}

func (h *RestoreHandler) ValidateBackup(c *gin.Context) {
	backupIDStr := c.Query("backup_id")
	databaseType := c.Query("database_type")

	if backupIDStr == "" || databaseType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "backup_id and database_type are required"})
		return
	}

	backupID, _ := strconv.ParseUint(backupIDStr, 10, 32)

	var backup models.Backup
	if err := h.db.First(&backup, backupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	if backup.FilePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup file path is empty"})
		return
	}

	result, err := restore.VerifyBackup(backup.FilePath, databaseType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	info, _ := restore.GetBackupInfo(backup.FilePath, databaseType)

	c.JSON(http.StatusOK, gin.H{
		"is_valid":  result.IsValid,
		"error_msg": result.ErrorMsg,
		"info":      info,
	})
}

func (h *RestoreHandler) GetPITRTimeRange(c *gin.Context) {
	backupIDStr := c.Query("backup_id")
	databaseType := c.Query("database_type")

	if backupIDStr == "" || databaseType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "backup_id and database_type are required"})
		return
	}

	backupID, _ := strconv.ParseUint(backupIDStr, 10, 32)

	var backup models.Backup
	if err := h.db.First(&backup, backupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	minTime := backup.BackupTime
	maxTime := time.Now()

	c.JSON(http.StatusOK, gin.H{
		"min_time": minTime,
		"max_time": maxTime,
		"backup_time": backup.BackupTime,
	})
}

func (h *RestoreHandler) GetRestoreProgress(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restore ID"})
		return
	}

	var restoreRecord models.Restore
	if err := h.db.First(&restoreRecord, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restore not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        restoreRecord.ID,
		"status":    restoreRecord.Status,
		"progress":  restoreRecord.Progress,
		"error_msg": restoreRecord.ErrorMsg,
	})
}

func (h *RestoreHandler) ListRestoreableBackups(c *gin.Context) {
	databaseIDStr := c.Query("database_id")
	databaseType := c.Query("database_type")

	if databaseIDStr == "" || databaseType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "database_id and database_type are required"})
		return
	}

	databaseID, _ := strconv.ParseUint(databaseIDStr, 10, 32)

	var backups []models.Backup
	query := h.db.Where("database_id = ? AND database_type = ? AND status = ?",
		databaseID, databaseType, "success").
		Order("backup_time DESC")

	if err := query.Find(&backups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get backups"})
		return
	}

	formattedBackups := make([]gin.H, len(backups))
	for i, backup := range backups {
		formattedBackups[i] = gin.H{
			"id":          backup.ID,
			"backup_time": backup.BackupTime,
			"backup_type": backup.BackupType,
			"file_size":   backup.FileSize,
			"status":      backup.Status,
		}
	}

	c.JSON(http.StatusOK, gin.H{"backups": formattedBackups})
}