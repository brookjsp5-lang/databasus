-- 创建工作空间表
CREATE TABLE IF NOT EXISTS workspaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建工作空间用户关联表
CREATE TABLE IF NOT EXISTS workspace_users (
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (workspace_id, user_id)
);

-- 创建MySQL数据库表
CREATE TABLE IF NOT EXISTS mysql_databases (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 3306,
    user VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    is_physical_backup_supported BOOLEAN DEFAULT FALSE,
    binary_log_enabled BOOLEAN DEFAULT FALSE,
    binary_log_path VARCHAR(255),
    xtrabackup_path VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建PostgreSQL数据库表
CREATE TABLE IF NOT EXISTS postgresql_databases (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    user VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    wal_enabled BOOLEAN DEFAULT FALSE,
    wal_path VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建存储表
CREATE TABLE IF NOT EXISTS storages (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建备份表
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    database_id INTEGER NOT NULL,
    database_type VARCHAR(50) NOT NULL,
    backup_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    file_size BIGINT,
    file_path VARCHAR(512),
    backup_time TIMESTAMP WITH TIME ZONE,
    encryption_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建恢复表
CREATE TABLE IF NOT EXISTS restores (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    backup_id INTEGER REFERENCES backups(id) ON DELETE CASCADE,
    database_id INTEGER NOT NULL,
    database_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    restore_time TIMESTAMP WITH TIME ZONE,
    pitr_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建备份配置表
CREATE TABLE IF NOT EXISTS backup_configs (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    database_id INTEGER NOT NULL,
    database_type VARCHAR(50) NOT NULL,
    backup_type VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    retention_days INTEGER DEFAULT 7,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at ON workspaces(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_mysql_databases_workspace_id ON mysql_databases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mysql_databases_deleted_at ON mysql_databases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_postgresql_databases_workspace_id ON postgresql_databases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_postgresql_databases_deleted_at ON postgresql_databases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storages_workspace_id ON storages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_storages_deleted_at ON storages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_backups_workspace_id ON backups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_backups_database_id ON backups(database_id);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_deleted_at ON backups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_restores_workspace_id ON restores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_restores_backup_id ON restores(backup_id);
CREATE INDEX IF NOT EXISTS idx_restores_status ON restores(status);
CREATE INDEX IF NOT EXISTS idx_restores_deleted_at ON restores(deleted_at);
CREATE INDEX IF NOT EXISTS idx_backup_configs_workspace_id ON backup_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_backup_configs_database_id ON backup_configs(database_id);
CREATE INDEX IF NOT EXISTS idx_backup_configs_deleted_at ON backup_configs(deleted_at);