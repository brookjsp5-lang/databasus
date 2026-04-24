package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	Username  string         `json:"username" gorm:"unique;not null"`
	Email     string         `json:"email" gorm:"unique;not null"`
	Password  string         `json:"-" gorm:"not null"`
	IsAdmin   bool           `json:"is_admin" gorm:"default:false"`
}

// Workspace 工作空间模型
type Workspace struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	Name      string         `json:"name" gorm:"not null"`
	Users     []User         `json:"users" gorm:"many2many:workspace_users;"`
}

// WorkspaceMember 工作空间成员模型
type WorkspaceMember struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	UserID      uint           `json:"user_id" gorm:"not null"`
	WorkspaceID uint           `json:"workspace_id" gorm:"not null"`
	Role        string         `json:"role" gorm:"not null;default:'viewer'"`
	User        User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Workspace   Workspace      `json:"workspace,omitempty" gorm:"foreignKey:WorkspaceID"`
}

// MySQLDatabase MySQL数据库模型
type MySQLDatabase struct {
	ID                    uint           `json:"id" gorm:"primaryKey"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	WorkspaceID           uint           `json:"workspace_id" gorm:"not null"`
	Name                  string         `json:"name" gorm:"not null"`
	Host                  string         `json:"host" gorm:"not null"`
	Port                  int            `json:"port" gorm:"not null;default:3306"`
	User                  string         `json:"user" gorm:"not null"`
	Password              string         `json:"-" gorm:"not null"`
	DatabaseName          string         `json:"database_name" gorm:"not null"`
	EngineVersion         string         `json:"engine_version" gorm:"default:'8.0'"` // MySQL: 5.7, 8.0, 8.4, 9.0
	IsPhysicalBackupSupported bool         `json:"is_physical_backup_supported" gorm:"default:false"`
	BinaryLogEnabled      bool           `json:"binary_log_enabled" gorm:"default:false"`
	BinaryLogPath         string         `json:"binary_log_path"`
	XtraBackupPath        string         `json:"xtrabackup_path"`
	DataDirectory         string         `json:"data_directory"`
	InstanceID            string         `json:"instance_id"`
	CompressionEnabled    bool           `json:"compression_enabled" gorm:"default:false"`
}

// SupportedMySQLVersions MySQL支持的版本
var SupportedMySQLVersions = []string{"5.7", "8.0", "8.4", "9.0"}

// PostgreSQLDatabase PostgreSQL数据库模型
type PostgreSQLDatabase struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	WorkspaceID   uint           `json:"workspace_id" gorm:"not null"`
	Name          string         `json:"name" gorm:"not null"`
	Host          string         `json:"host" gorm:"not null"`
	Port          int            `json:"port" gorm:"not null;default:5432"`
	User          string         `json:"user" gorm:"not null"`
	Password      string         `json:"-" gorm:"not null"`
	DatabaseName  string         `json:"database_name" gorm:"not null"`
	EngineVersion string         `json:"engine_version" gorm:"default:'16'"` // PostgreSQL: 12, 13, 14, 15, 16, 17, 18
	WALEnabled    bool           `json:"wal_enabled" gorm:"default:false"`
	WALPath       string         `json:"wal_path"`
	DataDirectory string         `json:"data_directory"`
	PasswordFile  string         `json:"password_file"`
	InstanceID    string         `json:"instance_id"`
}

// SupportedPostgreSQLVersions PostgreSQL支持的版本
var SupportedPostgreSQLVersions = []string{"12", "13", "14", "15", "16", "17", "18"}

// Backup 备份模型
type Backup struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	WorkspaceID   uint           `json:"workspace_id" gorm:"not null"`
	DatabaseID    uint           `json:"database_id" gorm:"not null"`
	DatabaseType  string         `json:"database_type" gorm:"not null"` // mysql or postgresql
	BackupType    string         `json:"backup_type" gorm:"not null"` // physical or logical
	Status        string         `json:"status" gorm:"not null;default:pending"`
	FileSize      int64          `json:"file_size"`
	OriginalSize  int64          `json:"original_size"`
	CompressedSize int64        `json:"compressed_size"`
	FilePath      string         `json:"file_path"`
	BackupTime    time.Time      `json:"backup_time"`
	EncryptionEnabled bool       `json:"encryption_enabled" gorm:"default:false"`
	EncryptionKey string         `json:"-"`
	CompressedPath string        `json:"compressed_path"`
	CompressionRatio float64     `json:"compression_ratio"`
	ErrorMsg      string         `json:"error_msg,omitempty"`
	Progress      float64        `json:"progress" gorm:"default:0"`
	Compressed    bool           `json:"compressed" gorm:"default:true"`
	CompressedLevel int          `json:"compressed_level" gorm:"default:6"`
	AgentID       *uint          `json:"agent_id,omitempty"`
}

// Restore 恢复模型
type Restore struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	WorkspaceID   uint           `json:"workspace_id" gorm:"not null"`
	BackupID      uint           `json:"backup_id" gorm:"not null"`
	DatabaseID    uint           `json:"database_id" gorm:"not null"`
	DatabaseType  string         `json:"database_type" gorm:"not null"`
	Status        string         `json:"status" gorm:"not null;default:pending"`
	RestoreTime   time.Time      `json:"restore_time"`
	PITRTime      *time.Time     `json:"pitr_time"`
	Progress      float64        `json:"progress" gorm:"default:0"`
	ErrorMsg      string         `json:"error_msg,omitempty"`
}

// Storage 存储模型
type Storage struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	WorkspaceID uint         `json:"workspace_id" gorm:"not null"`
	Name      string         `json:"name" gorm:"not null"`
	Type      string         `json:"type" gorm:"not null"` // local, s3, azure, etc.
	Config    string         `json:"config" gorm:"type:jsonb"`
}

// BackupConfig 备份配置模型
type BackupConfig struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	Name            string         `json:"name" gorm:"not null"`
	WorkspaceID     uint           `json:"workspace_id" gorm:"not null"`
	DatabaseID      uint           `json:"database_id" gorm:"not null"`
	DatabaseType    string         `json:"database_type" gorm:"not null"`
	StorageID       uint           `json:"storage_id" gorm:"not null"`
	BackupType      string         `json:"backup_type" gorm:"not null"`
	ScheduleType    string         `json:"schedule_type" gorm:"default:'daily'"`
	CronExpression  string         `json:"cron_expression" gorm:"not null"`
	RetentionType   string         `json:"retention_type" gorm:"default:'time'"`
	RetentionDays   int            `json:"retention_days" gorm:"default:7"`
	RetentionCount  int            `json:"retention_count" gorm:"default:0"`
	Compress        bool           `json:"compress" gorm:"default:true"`
	CompressLevel   int            `json:"compress_level" gorm:"default:6"`
	EncryptionEnabled bool         `json:"encryption_enabled" gorm:"default:false"`
	EncryptionKey   string         `json:"encryption_key,omitempty"`
	EmailEnabled    bool           `json:"email_enabled" gorm:"default:false"`
	Email           string         `json:"email,omitempty"`
	WebhookEnabled  bool           `json:"webhook_enabled" gorm:"default:false"`
	WebhookURL      string         `json:"webhook_url,omitempty"`
	NotifyOnSuccess bool           `json:"notify_on_success" gorm:"default:true"`
	NotifyOnFailure bool           `json:"notify_on_failure" gorm:"default:true"`
	IsEnabled       bool           `json:"is_enabled" gorm:"default:true"`
}

// Task 任务模型
type Task struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	Type          string         `json:"type" gorm:"not null"` // backup, restore
	Status        string         `json:"status" gorm:"not null;default:pending"`
	WorkspaceID   uint           `json:"workspace_id" gorm:"not null"`
	DatabaseID    uint           `json:"database_id" gorm:"not null"`
	DatabaseType  string         `json:"database_type" gorm:"not null"`
	BackupID      *uint         `json:"backup_id,omitempty"`
	RestoreID     *uint         `json:"restore_id,omitempty"`
	RetryCount    int           `json:"retry_count" gorm:"default:0"`
	ErrorMsg      string         `json:"error_msg,omitempty"`
	StartedAt     *time.Time    `json:"started_at,omitempty"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty"`
}

// Alert 告警模型
type Alert struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	Type        string         `json:"type" gorm:"not null"` // backup_failed, restore_failed, etc.
	Level       string         `json:"level" gorm:"not null"` // info, warning, error, critical
	Title       string         `json:"title" gorm:"not null"`
	Message     string         `json:"message" gorm:"not null"`
	WorkspaceID uint           `json:"workspace_id" gorm:"not null"`
	IsRead      bool           `json:"is_read" gorm:"default:false"`
	IsResolved  bool           `json:"is_resolved" gorm:"default:false"`
}

// SystemSetting 系统设置模型
type SystemSetting struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	WorkspaceID uint           `json:"workspace_id" gorm:"index"`
	Key         string         `json:"key" gorm:"uniqueIndex:idx_workspace_key;not null"`
	Value       string         `json:"value" gorm:"type:text"`
	Type        string         `json:"type" gorm:"default:string"`
}

// Agent 代理模型
type Agent struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	Name        string         `json:"name" gorm:"not null"`
	WorkspaceID uint           `json:"workspace_id" gorm:"not null"`
	Host        string         `json:"host" gorm:"not null"`
	Port        int            `json:"port" gorm:"not null;default:8080"`
	Status      string         `json:"status" gorm:"default:'offline'"`
	LastSeen    *time.Time     `json:"last_seen"`
	AuthToken   string         `json:"-"`
	BackupDir   string         `json:"backup_dir"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
}

// CompressionConfig 压缩配置模型
type CompressionConfig struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	WorkspaceID   uint           `json:"workspace_id" gorm:"not null"`
	Name          string         `json:"name" gorm:"not null"`
	CompressionType string       `json:"compression_type" gorm:"default:'gzip'"`
	Level         int            `json:"level" gorm:"default:6"`
	IsDefault     bool           `json:"is_default" gorm:"default:false"`
}