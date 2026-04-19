import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:6001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
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

// 响应拦截器
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

// 类型定义
export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

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
  refresh: (): Promise<{ message: string; token: string }> => api.post('/api/auth/refresh'),
};

// 工作空间相关
export const workspaceAPI = {
  getAll: (): Promise<{ workspaces: any[] }> => api.get('/api/workspaces'),
  create: (data: { name: string }): Promise<{ workspace: any }> => api.post('/api/workspaces', data),
  getById: (id: number): Promise<{ workspace: any }> => api.get(`/api/workspaces/${id}`),
  update: (id: number, data: { name: string }): Promise<{ workspace: any }> => api.put(`/api/workspaces/${id}`, data),
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
};

// 备份配置相关
export const backupConfigAPI = {
  getAll: (): Promise<{ configs: any[] }> => api.get('/api/backup-configs'),
  create: (data: any): Promise<{ config: any }> => api.post('/api/backup-configs', data),
  getById: (id: number): Promise<{ config: any }> => api.get(`/api/backup-configs/${id}`),
  update: (id: number, data: any): Promise<{ config: any }> => api.put(`/api/backup-configs/${id}`, data),
  delete: (id: number): Promise<{ message: string }> => api.delete(`/api/backup-configs/${id}`),
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
};

export default api;