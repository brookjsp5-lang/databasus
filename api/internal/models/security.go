package models

import (
	"time"
)

type TokenBlacklist struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Token     string    `gorm:"uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index" json:"user_id"`
	Username  string    `gorm:"index" json:"username"`
	Action    string    `gorm:"index;not null" json:"action"`
	Resource  string    `gorm:"index" json:"resource"`
	Details   string    `gorm:"type:text" json:"details"`
	IPAddress string    `json:"ip_address"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

const (
	ActionLogin      = "login"
	ActionLogout     = "logout"
	ActionRegister   = "register"
	ActionCreateDB   = "create_database"
	ActionUpdateDB   = "update_database"
	ActionDeleteDB   = "delete_database"
	ActionCreateBackup  = "create_backup"
	ActionDeleteBackup  = "delete_backup"
	ActionCreateRestore = "create_restore"
	ActionUpdateSettings = "update_settings"
)

const (
	ResourceUser     = "user"
	ResourceDatabase = "database"
	ResourceBackup  = "backup"
	ResourceRestore = "restore"
	ResourceSettings = "settings"
)
