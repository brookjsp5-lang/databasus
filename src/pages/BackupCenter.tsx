/**
 * BackupCenter - 备份中心页面组件
 * 
 * @description 提供数据库备份的全面管理功能：
 * - 数据库管理（MySQL、PostgreSQL）
 * - 备份任务管理（创建、查看、删除）
 * - 备份配置管理（排程、保留策略）
 * - 实时备份进度跟踪（WebSocket）
 * - 备份统计和状态监控
 * 
 * @module pages/BackupCenter
 * @requires React
 * @requires antd (Table, Button, Modal, Form等)
 * @requires lucide-react (图标)
 * @requires services/api (backupAPI, mysqlDatabaseAPI等)
 * @requires hooks/useWebSocket (实时通信)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, Switch, Popconfirm, Progress, message, Space, Card, Tabs, Alert, Tooltip, Row, Col } from 'antd';
import { Database, HardDrive, Plus, Trash2, Loader, CheckCircle, XCircle, Clock, RefreshCw, Edit2, Play, Server, Folder, Archive, Bell, Mail, MessageSquare, TestTube } from 'lucide-react';
import { backupAPI, mysqlDatabaseAPI, postgresqlDatabaseAPI, settingsAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * 数据库记录接口
 * @description 定义已注册的数据库信息
 */
interface DatabaseRecord {
  /** 数据库ID */
  id: number;
  /** 数据库名称 */
  name: string;
  /** 数据库类型: mysql | postgresql */
  database_type: string;
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 连接用户名 */
  username: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * 备份记录接口
 * @description 定义备份任务的信息
 */
interface BackupRecord {
  /** 备份ID */
  id: number;
  /** 工作空间ID */
  workspace_id: number;
  /** 关联的数据库ID */
  database_id: number;
  /** 数据库类型 */
  database_type: string;
  /** 备份类型: full | incremental | physical | logical */
  backup_type: string;
  /** 备份状态 */
  status: string;
  /** 备份文件路径 */
  file_path?: string;
  /** 备份文件大小 (bytes) */
  file_size?: number;
  /** 备份时间 */
  backup_time: string;
  /** 创建时间 */
  created_at: string;
  /** 备份进度 (%) */
  progress?: number;
  /** 错误信息 */
  error_msg?: string;
}

/**
 * 备份配置记录接口
 * @description 定义备份配置的信息
 */
interface BackupConfigRecord {
  /** 配置ID */
  id: number;
  /** 工作空间ID */
  workspace_id: number;
  /** 关联的数据库ID */
  database_id: number;
  /** 数据库类型 */
  database_type: string;
  /** 备份类型 */
  backup_type: string;
  /** Cron表达式 */
  cron_expression: string;
  /** 保留天数 */
  retention_days: number;
  /** 是否启用 */
  is_enabled: boolean;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 备份设置接口
 * @description 定义备份的全局设置
 */
interface BackupSettings {
  /** 备份存储路径 */
  backup_storage_path: string;
  /** 备份保留天数 */
  backup_retention_days: number;
  /** 是否启用压缩 */
  backup_compression_enabled: boolean;
}

/**
 * 备份进度更新接口
 * @description WebSocket实时推送的备份进度信息
 */
interface ProgressUpdate {
  /** 备份ID */
  backup_id: number;
  /** 备份状态 */
  status: string;
  /** 备份进度 (%) */
  progress: number;
  /** 状态消息 */
  message: string;
}

/** 数据库类型标签映射 */
const databaseTypeLabels: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

/** 备份类型标签映射 */
const backupTypeLabels: Record<string, string> = {
  full: '全量备份',
  incremental: '增量备份',
  physical: '物理备份',
  logical: '逻辑备份',
};

/** 排程类型标签映射 */
const scheduleTypeLabels: Record<string, string> = {
  hourly: '每小时',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  cron: '自定义Cron',
};

/**
 * 解析Cron表达式为可读描述
 * @description 将Cron表达式转换为中文描述
 * @param cron - Cron表达式
 * @returns 中文描述字符串
 */
const getCronDescription = (cron: string): string => {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, day, month, week] = parts;
  if (minute === '0' && hour === '*') return '每小时';
  if (minute === '0' && hour === '0' && day === '*') return '每天';
  if (minute === '0' && hour === '0' && day === '*' && week === '0') return '每周';
  if (minute === '0' && hour === '0' && day === '1' && month === '*') return '每月';
  return cron;
};

/**
 * BackupCenter 备份中心组件
 * 
 * @description 备份中心主组件，提供：
 * - 数据库管理Tab（查看、添加、删除数据库）
 * - 备份记录Tab（查看备份历史、手动备份、删除）
 * - 备份配置Tab（查看配置、启用/禁用排程）
 * - 实时进度跟踪（WebSocket连接）
 * 
 * @example
 * ```tsx
 * <BackupCenter />
 * ```
 */
export const BackupCenter: React.FC = () => {
  /** 当前激活的Tab */
  const [activeTab, setActiveTab] = useState('databases');

  /** 数据库列表 */
  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  /** 数据库加载状态 */
  const [databasesLoading, setDatabasesLoading] = useState(false);

  /** 备份列表 */
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  /** 备份加载状态 */
  const [backupsLoading, setBackupsLoading] = useState(false);
  /** 备份进度映射 */
  const [backupProgressMap, setBackupProgressMap] = useState<Record<number, ProgressUpdate>>({});

  /** 备份配置列表 */
  const [configs, setConfigs] = useState<BackupConfigRecord[]>([]);
  /** 配置加载状态 */
  const [configsLoading, setConfigsLoading] = useState(false);

  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    backup_storage_path: '/data/backups',
    backup_retention_days: 7,
    backup_compression_enabled: true,
  });

  const [dbModalVisible, setDbModalVisible] = useState(false);
  const [dbForm] = Form.useForm();
  const [editingDb, setEditingDb] = useState<DatabaseRecord | null>(null);

  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [selectedDb, setSelectedDb] = useState<{ id: number; type: string } | null>(null);
  const [backupType, setBackupType] = useState<string>('physical');

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configForm] = Form.useForm();
  const [editingConfig, setEditingConfig] = useState<BackupConfigRecord | null>(null);

  const handleProgressUpdate = useCallback((data: any) => {
    if (data.type === 'progress_update' && data.payload) {
      const update = data.payload as ProgressUpdate;
      if (update.backup_id) {
        setBackupProgressMap(prev => ({ ...prev, [update.backup_id]: update }));
        if (update.status === 'success' || update.status === 'failed') {
          setTimeout(() => { fetchBackups(); }, 1000);
        }
      }
    }
  }, []);

  const { isConnected } = useWebSocket({
    onMessage: handleProgressUpdate,
    onError: () => {},
  });

  useEffect(() => {
    fetchDatabases();
    fetchBackups();
    fetchConfigs();
    fetchBackupSettings();
  }, []);

  const fetchDatabases = async () => {
    setDatabasesLoading(true);
    try {
      const [mysqlData, pgData] = await Promise.all([
        mysqlDatabaseAPI.getAll().catch(() => ({ databases: [] })),
        postgresqlDatabaseAPI.getAll().catch(() => ({ databases: [] }))
      ]);
      const allDatabases: DatabaseRecord[] = [
        ...(mysqlData?.databases || []).map((db: any) => ({ ...db, database_type: 'mysql' })),
        ...(pgData?.databases || []).map((db: any) => ({ ...db, database_type: 'postgresql' }))
      ];
      setDatabases(allDatabases);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    } finally {
      setDatabasesLoading(false);
    }
  };

  const fetchBackups = async () => {
    setBackupsLoading(true);
    try {
      const data = await backupAPI.getAll();
      setBackups((data?.backups || []) as BackupRecord[]);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setBackupsLoading(false);
    }
  };

  const fetchConfigs = async () => {
    setConfigsLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/backup-configs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setConfigsLoading(false);
    }
  };

  const fetchBackupSettings = async () => {
    try {
      const data = await settingsAPI.getBackupSettings();
      if (data) {
        setBackupSettings({
          backup_storage_path: data.backup_storage_path || '/data/backups',
          backup_retention_days: data.backup_retention_days || 7,
          backup_compression_enabled: data.backup_compression_enabled !== false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch backup settings:', error);
    }
  };

  const handleCreateDatabase = async () => {
    try {
      const values = await dbForm.validateFields();
      const api = values.database_type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      await api.create(values);
      message.success('数据库配置成功');
      setDbModalVisible(false);
      dbForm.resetFields();
      setEditingDb(null);
      fetchDatabases();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '创建失败');
    }
  };

  const handleUpdateDatabase = async () => {
    if (!editingDb) return;
    try {
      const values = await dbForm.validateFields();
      const api = editingDb.database_type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      await api.update(editingDb.id, values);
      message.success('数据库更新成功');
      setDbModalVisible(false);
      dbForm.resetFields();
      setEditingDb(null);
      fetchDatabases();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '更新失败');
    }
  };

  const handleDeleteDatabase = async (id: number, type: string) => {
    try {
      const api = type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      await api.delete(id);
      message.success('数据库已删除');
      fetchDatabases();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTestConnection = async (db: DatabaseRecord) => {
    try {
      const api = db.database_type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      await api.getById(db.id);
      message.success('连接测试成功');
    } catch (error) {
      message.error('连接测试失败');
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedDb) {
      message.warning('请选择数据库');
      return;
    }
    try {
      await backupAPI.create({
        workspace_id: 1,
        database_id: selectedDb.id,
        database_type: selectedDb.type,
        backup_type: backupType
      });
      message.success('备份任务已创建');
      setBackupModalVisible(false);
      setSelectedDb(null);
      fetchBackups();
    } catch (error) {
      message.error('创建备份失败');
    }
  };

  const handleDeleteBackup = async (id: number) => {
    try {
      await backupAPI.delete(id);
      message.success('备份已删除');
      fetchBackups();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleCreateConfig = async () => {
    try {
      const values = await configForm.validateFields();
      const response = await fetch('http://localhost:6001/api/backup-configs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, workspace_id: 1, is_enabled: true })
      });
      if (response.ok) {
        message.success('定时备份配置成功');
        setConfigModalVisible(false);
        configForm.resetFields();
        setEditingConfig(null);
        fetchConfigs();
      } else {
        const data = await response.json();
        message.error(data.error || '创建失败');
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('创建失败');
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;
    try {
      const values = await configForm.validateFields();
      const response = await fetch(`http://localhost:6001/api/backup-configs/${editingConfig.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('定时备份配置更新成功');
        setConfigModalVisible(false);
        configForm.resetFields();
        setEditingConfig(null);
        fetchConfigs();
      } else {
        const data = await response.json();
        message.error(data.error || '更新失败');
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('更新失败');
    }
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await fetch(`http://localhost:6001/api/backup-configs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }
      });
      message.success('定时备份配置已删除');
      fetchConfigs();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggleConfig = async (id: number, enabled: boolean) => {
    try {
      const config = configs.find(c => c.id === id);
      if (!config) return;
      await fetch(`http://localhost:6001/api/backup-configs/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, is_enabled: enabled })
      });
      message.success(`定时备份已${enabled ? '启用' : '禁用'}`);
      fetchConfigs();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSaveBackupSettings = async () => {
    try {
      await settingsAPI.setBackupSettings(backupSettings);
      message.success('存储设置已保存');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const getStatusConfig = (status: string) => {
    const configMap: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'var(--color-warning)', icon: Clock, text: '等待中' },
      running: { color: 'var(--color-primary)', icon: Loader, text: '执行中' },
      success: { color: 'var(--color-success)', icon: CheckCircle, text: '成功' },
      failed: { color: 'var(--color-danger)', icon: XCircle, text: '失败' }
    };
    return configMap[status] || { color: 'var(--color-text-tertiary)', icon: Clock, text: status };
  };

  const databaseColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: number) => <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>#{id}</span> },
    { title: '名称', dataIndex: 'name', key: 'name', render: (name: string) => <span className="font-medium">{name}</span> },
    { title: '类型', dataIndex: 'database_type', key: 'database_type', width: 100, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{databaseTypeLabels[type] || type}</Tag> },
    { title: '连接信息', key: 'connection', render: (_: any, record: DatabaseRecord) => <span className="text-sm text-secondary">{record.host}:{record.port}</span> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => new Date(time).toLocaleString('zh-CN') },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: DatabaseRecord) => (
        <Space>
          <Tooltip title="测试连接"><Button type="text" icon={<TestTube size={14} />} onClick={() => handleTestConnection(record)} /></Tooltip>
          <Tooltip title="编辑"><Button type="text" icon={<Edit2 size={14} />} onClick={() => { setEditingDb(record); dbForm.setFieldsValue(record); setDbModalVisible(true); }} /></Tooltip>
          <Popconfirm title="确认删除" onConfirm={() => handleDeleteDatabase(record.id, record.database_type)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button type="text" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const backupColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: number) => <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>#{id}</span> },
    { title: '数据库', dataIndex: 'database_id', key: 'database_id', width: 180, render: (_: any, record: BackupRecord) => <span>DB-{record.database_id}</span> },
    { title: '类型', dataIndex: 'database_type', key: 'database_type', width: 100, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{databaseTypeLabels[type]}</Tag> },
    { title: '备份类型', dataIndex: 'backup_type', key: 'backup_type', width: 100, render: (type: string) => <Tag>{backupTypeLabels[type] || type}</Tag> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string, record: BackupRecord) => {
        const config = getStatusConfig(status);
        const progress = backupProgressMap[record.id]?.progress || record.progress || 0;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <config.icon size={14} style={{ color: config.color, animation: status === 'running' ? 'spin 1s linear infinite' : 'none' }} />
              <span style={{ color: config.color }}>{config.text}</span>
            </div>
            {status === 'running' && progress > 0 && <Progress percent={Math.round(progress)} size="small" strokeColor="var(--color-primary)" />}
          </div>
        );
      }
    },
    { title: '大小', dataIndex: 'file_size', key: 'file_size', width: 100, render: (size: number) => size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '-' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => new Date(time).toLocaleString() },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: BackupRecord) => (
        <Popconfirm title="确认删除" onConfirm={() => handleDeleteBackup(record.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<Trash2 size={14} />} disabled={record.status === 'running'} />
        </Popconfirm>
      )
    }
  ];

  const configColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '数据库类型', dataIndex: 'database_type', key: 'database_type', width: 100, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{databaseTypeLabels[type]}</Tag> },
    { title: '备份类型', dataIndex: 'backup_type', key: 'backup_type', width: 100, render: (type: string) => <Tag>{backupTypeLabels[type]}</Tag> },
    { title: '调度', dataIndex: 'cron_expression', key: 'cron_expression', render: (cron: string) => <Space><Clock size={14} />{getCronDescription(cron)}</Space> },
    { title: '保留', dataIndex: 'retention_days', key: 'retention_days', width: 80, render: (days: number) => `${days}天` },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled: boolean, record: BackupConfigRecord) => (
        <Switch checked={enabled} onChange={(checked) => handleToggleConfig(record.id, checked)} checkedChildren="启用" unCheckedChildren="禁用" />
      )
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => new Date(time).toLocaleString('zh-CN') },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: BackupConfigRecord) => (
        <Space>
          <Button type="text" icon={<Edit2 size={14} />} onClick={() => { setEditingConfig(record); configForm.setFieldsValue(record); setConfigModalVisible(true); }} />
          <Popconfirm title="确认删除" onConfirm={() => handleDeleteConfig(record.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button type="text" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'databases',
      label: <span className="flex items-center gap-2"><Database size={16} />数据库管理</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">已配置的数据库</h3>
              <p className="text-sm text-secondary">管理数据库连接信息</p>
            </div>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => { setEditingDb(null); dbForm.resetFields(); setDbModalVisible(true); }}>添加数据库</Button>
          </div>
          <Table columns={databaseColumns} dataSource={databases} rowKey="id" loading={databasesLoading} pagination={{ pageSize: 10 }} />
        </div>
      )
    },
    {
      key: 'backups',
      label: <span className="flex items-center gap-2"><HardDrive size={16} />备份记录</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">备份历史记录</h3>
              <p className="text-sm text-secondary">查看和管理所有备份任务</p>
            </div>
            <Space>
              <Button icon={<RefreshCw size={16} />} onClick={fetchBackups}>刷新</Button>
              <Button type="primary" icon={<Plus size={16} />} onClick={() => setBackupModalVisible(true)}>创建备份</Button>
            </Space>
          </div>
          <Table columns={backupColumns} dataSource={backups} rowKey="id" loading={backupsLoading} pagination={{ pageSize: 10 }} />
        </div>
      )
    },
    {
      key: 'scheduled',
      label: <span className="flex items-center gap-2"><Clock size={16} />定时备份</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">定时备份配置</h3>
              <p className="text-sm text-secondary">设置自动备份计划和保留策略</p>
            </div>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => { setEditingConfig(null); configForm.resetFields(); setConfigModalVisible(true); }}>创建定时备份</Button>
          </div>
          <Table columns={configColumns} dataSource={configs} rowKey="id" loading={configsLoading} pagination={{ pageSize: 10 }} />
        </div>
      )
    },
    {
      key: 'storage',
      label: <span className="flex items-center gap-2"><Folder size={16} />存储设置</span>,
      children: (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">备份存储配置</h3>
            <p className="text-sm text-secondary">配置备份文件的存储路径和保留策略</p>
          </div>
          <Card style={{ maxWidth: 600 }}>
            <Form layout="vertical">
              <Form.Item label="备份存储路径" extra="备份文件将存储在此路径">
                <Input value={backupSettings.backup_storage_path} onChange={(e) => setBackupSettings({ ...backupSettings, backup_storage_path: e.target.value })} placeholder="/data/backups" prefix={<Folder size={16} />} />
              </Form.Item>
              <Form.Item label="备份保留天数" extra="超过此天数的备份将被自动清理">
                <Input type="number" min={1} max={365} value={backupSettings.backup_retention_days} onChange={(e) => setBackupSettings({ ...backupSettings, backup_retention_days: parseInt(e.target.value) || 7 })} />
              </Form.Item>
              <Form.Item label="启用压缩" extra="启用后备份文件将被压缩以节省存储空间">
                <Switch checked={backupSettings.backup_compression_enabled} onChange={(checked) => setBackupSettings({ ...backupSettings, backup_compression_enabled: checked })} checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              <Button type="primary" onClick={handleSaveBackupSettings}>保存设置</Button>
            </Form>
          </Card>
        </div>
      )
    }
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">备份中心</h1>
        <p className="page-description">统一管理数据库、备份任务、定时备份和存储设置</p>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal title={editingDb ? '编辑数据库' : '添加数据库'} open={dbModalVisible} onCancel={() => { setDbModalVisible(false); dbForm.resetFields(); setEditingDb(null); }} onOk={editingDb ? handleUpdateDatabase : handleCreateDatabase} okText={editingDb ? '更新' : '创建'} cancelText="取消" width={500}>
        <Form form={dbForm} layout="vertical">
          <Form.Item name="name" label="数据库名称" rules={[{ required: true, message: '请输入数据库名称' }]}>
            <Input placeholder="my-database" />
          </Form.Item>
          <Form.Item name="database_type" label="数据库类型" rules={[{ required: true, message: '请选择数据库类型' }]}>
            <Select placeholder="请选择数据库类型" onChange={() => dbForm.resetFields(['host', 'port', 'username', 'password'])}>
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.database_type !== curr.database_type}>
            {() => (
              <>
                <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]}>
                  <Input placeholder="localhost" />
                </Form.Item>
                <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                  <Input type="number" placeholder={dbForm.getFieldValue('database_type') === 'mysql' ? '3306' : '5432'} />
                </Form.Item>
              </>
            )}
          </Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="root" />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="创建备份" open={backupModalVisible} onCancel={() => { setBackupModalVisible(false); setSelectedDb(null); }} onOk={handleCreateBackup} okText="创建" cancelText="取消">
        <div className="mb-4">
          <label className="form-label">选择数据库</label>
          <Select placeholder="请选择数据库" className="w-full" value={selectedDb?.id} onChange={(value, option: any) => setSelectedDb({ id: value, type: option.type })} options={databases.map(db => ({ label: `${db.name} (${db.host}:${db.port}) [${databaseTypeLabels[db.database_type]}]`, value: db.id, type: db.database_type }))} />
        </div>
        <div className="mb-4">
          <label className="form-label">备份类型</label>
          <Select className="w-full" value={backupType} onChange={setBackupType} options={[{ label: '物理备份 (xtrabackup/pg_basebackup)', value: 'physical' }, { label: '逻辑备份 (mysqldump/pg_dump)', value: 'logical' }]} />
        </div>
        <Alert type="info" message="物理备份使用 xtrabackup (MySQL) 或 pg_basebackup (PostgreSQL) 进行快速备份。" />
      </Modal>

      <Modal title={editingConfig ? '编辑定时备份' : '创建定时备份'} open={configModalVisible} onCancel={() => { setConfigModalVisible(false); configForm.resetFields(); setEditingConfig(null); }} onOk={editingConfig ? handleUpdateConfig : handleCreateConfig} okText={editingConfig ? '更新' : '创建'} cancelText="取消" width={500}>
        <Form form={configForm} layout="vertical">
          <Form.Item name="database_type" label="数据库类型" rules={[{ required: true, message: '请选择数据库类型' }]}>
            <Select placeholder="请选择数据库类型">
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="database_id" label="数据库ID" rules={[{ required: true, message: '请输入数据库ID' }]}>
            <Input type="number" placeholder="请输入数据库ID" />
          </Form.Item>
          <Form.Item name="backup_type" label="备份类型" rules={[{ required: true, message: '请选择备份类型' }]}>
            <Select placeholder="请选择备份类型">
              <Select.Option value="full">全量备份</Select.Option>
              <Select.Option value="incremental">增量备份</Select.Option>
              <Select.Option value="physical">物理备份</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="schedule_type" label="调度类型" rules={[{ required: true, message: '请选择调度类型' }]}>
            <Select placeholder="请选择调度类型" onChange={() => configForm.setFieldValue('cron_expression', '')}>
              <Select.Option value="hourly">每小时</Select.Option>
              <Select.Option value="daily">每天</Select.Option>
              <Select.Option value="weekly">每周</Select.Option>
              <Select.Option value="monthly">每月</Select.Option>
              <Select.Option value="cron">自定义Cron</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule_type !== curr.schedule_type}>
            {() => {
              const scheduleType = configForm.getFieldValue('schedule_type');
              let cronExpression = '';
              if (scheduleType === 'hourly') cronExpression = '0 * * * *';
              else if (scheduleType === 'daily') cronExpression = '0 0 * * *';
              else if (scheduleType === 'weekly') cronExpression = '0 0 * * 0';
              else if (scheduleType === 'monthly') cronExpression = '0 0 1 * *';
              return (
                <Form.Item name="cron_expression" label="Cron表达式" rules={[{ required: true, message: '请输入Cron表达式' }]} initialValue={cronExpression}>
                  <Input placeholder="0 0 * * *" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="retention_days" label="保留天数" rules={[{ required: true, message: '请输入保留天数' }]}>
            <Input type="number" placeholder="7" min={1} />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};