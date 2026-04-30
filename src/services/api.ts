/**
 * API服务层
 *
 * @description 封装所有与后端的HTTP通信，包括：
 * - 用户认证（登录、注册、登出）
 * - 数据库管理（MySQL、PostgreSQL）
 * - 备份操作（创建、查询、删除）
 * - 存储配置（S3、本地、NFS）
 * - 系统设置（SMTP、告警等）
 * - GFS保留策略
 * - 工作空间管理
 *
 * @module services/api
 */

import axios from 'axios';

/** API基础URL，优先使用环境变量，生产环境使用相对路径 */
const API_URL = import.meta.env.VITE_API_URL || '';

/** 创建axios实例 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 * @description 自动添加JWT token到请求头
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * @description 处理401未授权响应，自动清除登录状态并跳转登录页
 */
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * 用户数据类型
 * @description 定义用户基本信息
 */
export interface User {
  /** 用户ID */
  id: number;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 是否管理员 */
  is_admin: boolean;
}

/** 认证响应类型 */
export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Database {
  id: number;
  name: string;
  host: string;
  port: number;
  user: string;
  database_name: string;
  is_physical_backup_supported?: boolean;
  binary_log_enabled?: boolean;
  binary_log_path?: string;
  xtrabackup_path?: string;
  wal_enabled?: boolean;
  wal_path?: string;
}

export interface DatabasesResponse {
  databases: Database[];
}

export interface Backup {
  id: number;
  database_id: number;
  database_type: string;
  backup_type: string;
  status: string;
  backup_time: string;
  created_at: string;
}

export interface BackupsResponse {
  backups: Backup[];
}

// 认证相关
export const authAPI = {
  register: (data: { username: string; email: string; password: string }): Promise<AuthResponse> =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }): Promise<AuthResponse> =>
    api.post('/api/auth/login', data),
  logout: (): Promise<{ message: string }> => api.post('/api/auth/logout'),
  refresh: (): Promise<{ message: string; token: string }> => api.post('/api/auth/refresh'),
  changePassword: (data: { current_password: string; new_password: string }): Promise<{ message: string }> =>
    api.post('/api/auth/change-password', data),
  updateProfile: (data: { username?: string; email?: string }): Promise<{ message: string; user: User }> =>
    api.put('/api/auth/profile', data),
};

// 统计数据
export interface DashboardStats {
  total_databases: number;
  total_backups: number;
  success_rate: number;
  storage_used: number;
  storage_total: number;
  active_backups: number;
  failed_backups: number;
  pending_backups: number;
  recent_backups_count: number;
  total_restores: number;
  success_restores: number;
  failed_restores: number;
}

export const statsAPI = {
  getDashboardStats: (workspaceId: number): Promise<DashboardStats> =>
    api.get('/api/stats', { params: { workspace_id: workspaceId } }),
};

// 审计日志
export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export const auditLogAPI = {
  getAuditLogs: (params?: {
    user_id?: number;
    action?: string;
    resource?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> =>
    api.get('/api/audit-logs', { params }),
};

/**
 * 工作空间数据类型
 * @description 定义工作空间基本信息
 */
export interface Workspace {
  id: number;
  name: string;
  description?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  role?: string;
}

// 工作空间相关
export const workspaceAPI = {
  getAll: (): Promise<{ workspaces: Workspace[] }> => api.get('/api/workspaces'),
  create: (data: { name: string; description?: string }): Promise<{ workspace: Workspace }> =>
    api.post('/api/workspaces', data),
  getById: (id: number): Promise<{ workspace: Workspace }> => api.get(`/api/workspaces/${id}`),
  update: (id: number, data: { name: string; description?: string }): Promise<{ workspace: Workspace }> =>
    api.put(`/api/workspaces/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/workspaces/${id}`),
};

// MySQL数据库相关
export const mysqlDatabaseAPI = {
  getAll: (): Promise<DatabasesResponse> => api.get('/api/mysql-databases'),
  create: (data: any): Promise<{ database: Database }> => api.post('/api/mysql-databases', data),
  getById: (id: number): Promise<{ database: Database }> => api.get(`/api/mysql-databases/${id}`),
  update: (id: number, data: any): Promise<{ database: Database }> => api.put(`/api/mysql-databases/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/mysql-databases/${id}`),
};

// PostgreSQL数据库相关
export const postgresqlDatabaseAPI = {
  getAll: (): Promise<DatabasesResponse> => api.get('/api/postgresql-databases'),
  create: (data: any): Promise<{ database: Database }> => api.post('/api/postgresql-databases', data),
  getById: (id: number): Promise<{ database: Database }> => api.get(`/api/postgresql-databases/${id}`),
  update: (id: number, data: any): Promise<{ database: Database }> => api.put(`/api/postgresql-databases/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/postgresql-databases/${id}`),
};

// 存储相关
export const storageAPI = {
  getAll: (): Promise<{ storages: any[] }> => api.get('/api/storages'),
  create: (data: any): Promise<{ storage: any }> => api.post('/api/storages', data),
  getById: (id: number): Promise<{ storage: any }> => api.get(`/api/storages/${id}`),
  update: (id: number, data: any): Promise<{ storage: any }> => api.put(`/api/storages/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/storages/${id}`),
  test: (data: {
    type: string;
    local_path?: string;
    s3_bucket?: string;
    s3_region?: string;
    s3_endpoint?: string;
    s3_access_key?: string;
    s3_secret_key?: string;
    nas_path?: string;
  }): Promise<{ success: boolean; message: string; info?: any }> => api.post('/api/storages/test', data),
  getInfo: (data: {
    type: string;
    local_path?: string;
    s3_bucket?: string;
    s3_region?: string;
    s3_endpoint?: string;
    s3_access_key?: string;
    s3_secret_key?: string;
    nas_path?: string;
  }): Promise<{ info: any }> => api.post('/api/storages/info', data),
};

// 备份相关
export const backupAPI = {
  getAll: (): Promise<BackupsResponse> => api.get('/api/backups'),
  create: (data: any): Promise<{ backup: Backup }> => api.post('/api/backups', data),
  getById: (id: number): Promise<{ backup: Backup }> => api.get(`/api/backups/${id}`),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/backups/${id}`),
};

// 恢复相关
export const restoreAPI = {
  getAll: (): Promise<{ restores: any[] }> => api.get('/api/restores'),
  create: (data: any): Promise<{ restore: any }> => api.post('/api/restores', data),
  getById: (id: number): Promise<{ restore: any }> => api.get(`/api/restores/${id}`),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/restores/${id}`),
  checkTarget: (data: {
    backup_id: number;
    database_id?: number;
    database_type: string;
    target_kind?: 'original' | 'restore_instance';
    target_instance_id?: number;
  }): Promise<{
    is_original_instance: boolean;
    warning_message: string;
    requires_confirmation: boolean;
  }> => api.post('/api/restores/check-target', data),
};

export const restoreInstanceAPI = {
  getAll: (): Promise<{ instances: any[] }> => api.get('/api/restore-instances'),
  create: (data: any): Promise<{ instance: any }> => api.post('/api/restore-instances', data),
  getById: (id: number): Promise<{ instance: any }> => api.get(`/api/restore-instances/${id}`),
  update: (id: number, data: any): Promise<{ instance: any }> => api.put(`/api/restore-instances/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/restore-instances/${id}`),
  test: (data: {
    database_type: 'mysql' | 'postgresql';
    host: string;
    port: number;
    user: string;
    password: string;
    database_name: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => api.post('/api/restore-instances/test', data),
};

// WAL备份相关
export const walBackupAPI = {
  getStatus: (databaseId: number, databaseType: string): Promise<{ status: any }> =>
    api.get('/api/wal-backup/status', { params: { database_id: databaseId, database_type: databaseType } }),
  start: (data: { database_id: number; database_type: string }): Promise<{ message: string }> =>
    api.post('/api/wal-backup/start', data),
  stop: (data: { database_id: number; database_type: string }): Promise<{ message: string }> =>
    api.post('/api/wal-backup/stop', data),
};

// 备份配置相关
export const backupConfigAPI = {
  getAll: (): Promise<{ configs: any[] }> => api.get('/api/backup-configs'),
  create: (data: any): Promise<{ config: any }> => api.post('/api/backup-configs', data),
  getById: (id: number): Promise<{ config: any }> => api.get(`/api/backup-configs/${id}`),
  update: (id: number, data: any): Promise<{ config: any }> => api.put(`/api/backup-configs/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/backup-configs/${id}`),
};

// GFS保留策略相关
export interface GFSConfig {
  gfs_tier_enabled: boolean;
  gfs_son_enabled: boolean;
  gfs_son_retention_days: number;
  gfs_father_enabled: boolean;
  gfs_father_retention_weeks: number;
  gfs_grandfather_enabled: boolean;
  gfs_grandfather_retention_months: number;
}

export interface GFSCleanupPreview {
  id: number;
  backup_time: string;
  level: string;
  will_delete: boolean;
  reason: string;
}

export const retentionAPI = {
  getGFSConfig: (configId: number): Promise<{ config: GFSConfig }> =>
    api.get(`/api/retention/gfs/${configId}`),
  updateGFSConfig: (data: {
    config_id: number;
    son_enabled: boolean;
    son_days: number;
    father_enabled: boolean;
    father_weeks: number;
    grandfather_enabled: boolean;
    grandfather_months: number;
  }): Promise<{ message: string; config: any }> =>
    api.put('/api/retention/gfs', data),
  executeCleanup: (configId: number): Promise<{ message: string; result: any }> =>
    api.post('/api/retention/gfs/cleanup', { config_id: configId }),
  previewCleanup: (configId: number): Promise<{ previews: GFSCleanupPreview[]; total_backups: number; will_delete: number }> =>
    api.post('/api/retention/gfs/preview', { config_id: configId }),
  getBackupGFSInfo: (backupId: number): Promise<{ gfs_info: any }> =>
    api.get(`/api/retention/backup/${backupId}/gfs-info`),
};

// 告警相关
export const alertAPI = {
  getAll: (params?: { workspace_id?: number; level?: string; is_read?: boolean }): Promise<{ alerts: any[] }> =>
    api.get('/api/alerts', { params }),
  getById: (id: number): Promise<{ alert: any }> => api.get(`/api/alerts/${id}`),
  markAsRead: (id: number): Promise<{ message: string }> => api.put(`/api/alerts/${id}/read`),
  markAllAsRead: (workspaceId?: number): Promise<{ message: string }> =>
    api.put('/api/alerts/read-all', { workspace_id: workspaceId }),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/alerts/${id}`),
  getUnreadCount: (workspaceId?: number): Promise<{ count: number }> =>
    api.get('/api/alerts/unread-count', { params: { workspace_id: workspaceId } }),
};

// 设置相关
export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  encryption: string;
  from_address: string;
  from_name: string;
  is_enabled: boolean;
}

export const settingsAPI = {
  getAll: (): Promise<{ settings: any[] }> => api.get('/api/settings'),
  getByKey: (key: string): Promise<{ key: string; value: string }> => api.get(`/api/settings/${key}`),
  set: (key: string, value: string): Promise<{ message: string }> =>
    api.post('/api/settings', { key, value }),
  delete: (key: string): Promise<{ message: string }> => api.delete(`/api/settings/${key}`),
  getAlertSettings: (): Promise<any> => api.get('/api/settings/alert'),
  setAlertSettings: (data: any): Promise<{ message: string }> => api.post('/api/settings/alert', data),
  getBackupSettings: (): Promise<any> => api.get('/api/settings/backup'),
  setBackupSettings: (data: any): Promise<{ message: string }> => api.post('/api/settings/backup', data),
  getSMTPConfig: (): Promise<{ smtp_config: SMTPConfig }> => api.get('/api/settings/smtp'),
  saveSMTPConfig: (data: SMTPConfig): Promise<{ message: string }> => api.post('/api/settings/smtp', data),
  testSMTPConnection: (data: SMTPConfig): Promise<{ message: string; success: boolean }> =>
    api.post('/api/settings/smtp/test', data),
  testSendEmail: (toAddress: string): Promise<{ message: string; success: boolean }> =>
    api.post('/api/settings/smtp/test-email', { to_address: toAddress }),
};

export default api;
