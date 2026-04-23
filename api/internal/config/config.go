package config

import (
	"os"
	"strconv"
)

type Config struct {
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Server   ServerConfig
	Backup   BackupConfig
}

type DatabaseConfig struct {
	Host                   string
	Port                   string
	User                   string
	Password               string
	DBName                 string
	SSLMode                string
	MaxOpenConns           int
	MaxIdleConns           int
	ConnMaxLifetimeMinutes int
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret    string
	ExpiresIn int
}

type ServerConfig struct {
	Port string
}

type BackupConfig struct {
	StoragePath    string
	RetentionDays  int
	MaxBackupSize  int64
}

func Load() *Config {
	return &Config{
		Database: loadDatabaseConfig(),
		Redis:    loadRedisConfig(),
		JWT:      loadJWTConfig(),
		Server:   loadServerConfig(),
		Backup:   loadBackupConfig(),
	}
}

func loadDatabaseConfig() DatabaseConfig {
	maxOpenConns, _ := strconv.Atoi(getEnv("DB_MAX_OPEN_CONNS", "25"))
	maxIdleConns, _ := strconv.Atoi(getEnv("DB_MAX_IDLE_CONNS", "10"))
	connMaxLifetime, _ := strconv.Atoi(getEnv("DB_CONN_MAX_LIFETIME_MINUTES", "30"))

	return DatabaseConfig{
		Host:                   getEnv("DB_HOST", "localhost"),
		Port:                   getEnv("DB_PORT", "5432"),
		User:                   getEnv("DB_USER", "postgres"),
		Password:               getEnv("DB_PASSWORD", "postgres"),
		DBName:                 getEnv("DB_NAME", "datatrue"),
		SSLMode:                getEnv("DB_SSLMODE", "disable"),
		MaxOpenConns:           maxOpenConns,
		MaxIdleConns:           maxIdleConns,
		ConnMaxLifetimeMinutes: connMaxLifetime,
	}
}

func loadRedisConfig() RedisConfig {
	db, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	return RedisConfig{
		Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       db,
	}
}

func loadJWTConfig() JWTConfig {
	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable is required")
	}

	expiresIn, _ := strconv.Atoi(getEnv("JWT_EXPIRES_IN", "24"))
	return JWTConfig{
		Secret:    jwtSecret,
		ExpiresIn: expiresIn,
	}
}

func loadServerConfig() ServerConfig {
	return ServerConfig{
		Port: getEnv("PORT", "6001"),
	}
}

func loadBackupConfig() BackupConfig {
	retentionDays, _ := strconv.Atoi(getEnv("BACKUP_RETENTION_DAYS", "7"))
	maxBackupSize, _ := strconv.ParseInt(getEnv("BACKUP_MAX_SIZE", "107374182400"), 10, 64)
	return BackupConfig{
		StoragePath:   getEnv("BACKUP_STORAGE_PATH", "/tmp/backups"),
		RetentionDays: retentionDays,
		MaxBackupSize: maxBackupSize,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
