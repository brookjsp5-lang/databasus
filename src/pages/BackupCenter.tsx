/**
 * BackupCenter - 备份中心页面组件
 * 
 * @description 提供数据库备份的全面管理功能：
 * - 数据库管理（MySQL、PostgreSQL）通过向导添加
 * - 备份任务管理（创建、查看、删除）
 * - 实时备份进度跟踪（WebSocket）
 * - 备份统计和状态监控
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Popconfirm,
  Progress,
  message,
  Space,
  Card,
  Tabs,
  Tooltip,
  Drawer,
  Descriptions,
  Divider,
  Empty,
} from 'antd';
import {
  Database,
  HardDrive,
  Plus,
  Trash2,
  Loader,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Edit2,
  TestTube,
  Eye,
} from 'lucide-react';
import { backupAPI, backupConfigAPI, mysqlDatabaseAPI, postgresqlDatabaseAPI, storageAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { DatabaseWizard } from './DatabaseWizard';

interface DatabaseRecord {
  id: number;
  name: string;
  database_type: string;
  host: string;
  port: number;
  user: string;
  username?: string;
  database_name?: string;
  engine_version?: string;
  is_physical_backup_supported?: boolean;
  binary_log_enabled?: boolean;
  binary_log_path?: string;
  xtrabackup_path?: string;
  wal_enabled?: boolean;
  wal_path?: string;
  created_at: string;
}

interface BackupConfigRecord {
  id: number;
  name: string;
  workspace_id: number;
  database_id: number;
  database_type: string;
  storage_id: number;
  backup_type: string;
  schedule_type: string;
  cron_expression: string;
  retention_type: string;
  retention_days: number;
  retention_count: number;
  compress: boolean;
  compress_level: number;
  encryption_enabled: boolean;
  encryption_key?: string;
  email_enabled: boolean;
  email?: string;
  webhook_enabled: boolean;
  webhook_url?: string;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  is_enabled?: boolean;
  enabled?: boolean;
  gfs_tier_enabled?: boolean;
  gfs_son_enabled?: boolean;
  gfs_son_retention_days?: number;
  gfs_father_enabled?: boolean;
  gfs_father_retention_weeks?: number;
  gfs_grandfather_enabled?: boolean;
  gfs_grandfather_retention_months?: number;
  created_at?: string;
  updated_at?: string;
}

interface StorageRecord {
  id: number;
  name: string;
  type: string;
  config: Record<string, any> | string;
  created_at?: string;
  updated_at?: string;
}

interface BackupRecord {
  id: number;
  workspace_id: number;
  database_id: number;
  database_type: string;
  backup_type: string;
  status: string;
  file_path?: string;
  file_size?: number;
  backup_time: string;
  created_at: string;
  progress?: number;
  error_msg?: string;
}

interface ProgressUpdate {
  backup_id: number;
  status: string;
  progress: number;
  message: string;
}

const databaseTypeLabels: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

const backupTypeLabels: Record<string, string> = {
  full: '全量备份',
  incremental: '增量备份',
  physical: '物理备份',
  logical: '逻辑备份',
};

const scheduleTypeLabels: Record<string, string> = {
  hourly: '按小时',
  daily: '按天',
  weekly: '按周',
  monthly: '按月',
  cron: 'Cron表达式',
};

const retentionTypeLabels: Record<string, string> = {
  time: '按时间保留',
  count: '按数量保留',
};

const storageTypeLabels: Record<string, string> = {
  local: '本地存储',
  s3: 'S3兼容存储',
  nas: 'NAS存储',
};

const parseStorageConfig = (config: StorageRecord['config']): Record<string, any> => {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return config;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
};

const formatBoolean = (value?: boolean) => value ? '已启用' : '未启用';

const maskSecret = (value?: string) => {
  if (!value) return '未配置';
  if (value.length <= 8) return '******';
  return `${value.slice(0, 4)}******${value.slice(-2)}`;
};

export const BackupCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState('databases');

  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  const [databasesLoading, setDatabasesLoading] = useState(false);

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupProgressMap, setBackupProgressMap] = useState<Record<number, ProgressUpdate>>({});

  const [wizardVisible, setWizardVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingDb, setEditingDb] = useState<DatabaseRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState<DatabaseRecord | null>(null);
  const [selectedConfigs, setSelectedConfigs] = useState<BackupConfigRecord[]>([]);
  const [storages, setStorages] = useState<StorageRecord[]>([]);


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

  useWebSocket({
    onMessage: handleProgressUpdate,
    onError: () => {},
  });

  useEffect(() => {
    fetchDatabases();
    fetchBackups();
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

  const getBackupConfigs = async (): Promise<BackupConfigRecord[]> => {
    const data = await backupConfigAPI.getAll();
    return (data?.configs || []) as BackupConfigRecord[];
  };

  const getStorages = async (): Promise<StorageRecord[]> => {
    const data = await storageAPI.getAll();
    return ((data?.storages || []) as StorageRecord[]).map((storage) => ({
      ...storage,
      config: parseStorageConfig(storage.config),
    }));
  };

  const handleUpdateDatabase = async () => {
    if (!editingDb) return;
    try {
      const values = await editForm.validateFields();
      const api = editingDb.database_type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      const payload: any = {
        name: values.name,
        host: values.host,
        port: values.port,
        user: values.user,
        password: values.password,
        database_name: values.database_name || editingDb.name,
      };
      await api.update(editingDb.id, payload);
      message.success('数据库更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
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

  const handleOpenDetail = async (db: DatabaseRecord) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const api = db.database_type === 'mysql' ? mysqlDatabaseAPI : postgresqlDatabaseAPI;
      const [databaseDetail, backupConfigList, storageList] = await Promise.all([
        api.getById(db.id),
        getBackupConfigs(),
        getStorages(),
      ]);

      setSelectedDb({
        ...(databaseDetail?.database || db),
        database_type: db.database_type,
      } as DatabaseRecord);
      setSelectedConfigs(
        backupConfigList.filter(
          (config) => config.database_id === db.id && config.database_type === db.database_type
        )
      );
      setStorages(storageList);
    } catch (error) {
      message.error('获取数据库详情失败');
      setSelectedDb(db);
      setSelectedConfigs([]);
      setStorages([]);
    } finally {
      setDetailLoading(false);
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

  const getStatusConfig = (status: string) => {
    const configMap: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'var(--color-warning)', icon: Clock, text: '等待中' },
      running: { color: 'var(--color-primary)', icon: Loader, text: '执行中' },
      success: { color: 'var(--color-success)', icon: CheckCircle, text: '成功' },
      failed: { color: 'var(--color-danger)', icon: XCircle, text: '失败' }
    };
    return configMap[status] || { color: 'var(--color-text-tertiary)', icon: Clock, text: status };
  };

  const handleWizardComplete = () => {
    setWizardVisible(false);
    fetchDatabases();
    message.success('数据库添加成功！已自动配置备份计划。');
  };

  const renderStorageConfig = (config: BackupConfigRecord) => {
    const storage = storages.find((item) => item.id === config.storage_id);
    if (!storage) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未关联存储配置" />;
    }

    const storageConfig = parseStorageConfig(storage.config);
    const storageDetails: Array<{ label: string; value: string }> = [
      { label: '存储名称', value: storage.name },
      { label: '存储类型', value: storageTypeLabels[storage.type] || storage.type },
    ];

    if (storage.type === 'local') {
      storageDetails.push({ label: '存储路径', value: storageConfig.path || '-' });
    }
    if (storage.type === 'nas') {
      storageDetails.push(
        { label: 'NAS 主机', value: storageConfig.host || '-' },
        { label: '共享路径', value: storageConfig.path || '-' }
      );
    }
    if (storage.type === 's3') {
      storageDetails.push(
        { label: 'Bucket', value: storageConfig.bucket || '-' },
        { label: 'Region', value: storageConfig.region || '-' },
        { label: 'Endpoint', value: storageConfig.endpoint || '-' },
        { label: 'Access Key', value: storageConfig.access_key || '-' }
      );
    }

    return (
      <Descriptions size="small" column={1} bordered>
        {storageDetails.map((item) => (
          <Descriptions.Item key={`${storage.id}-${item.label}`} label={item.label}>
            {item.value}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  const renderBackupConfigDetail = (config: BackupConfigRecord, index: number) => (
    <Card
      key={config.id}
      size="small"
      title={`备份配置 #${config.id}${config.name ? ` · ${config.name}` : ''}`}
      style={{ marginBottom: index === selectedConfigs.length - 1 ? 0 : 16 }}
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="配置状态">
          <Tag color={(config.is_enabled ?? config.enabled) ? 'green' : 'default'}>
            {(config.is_enabled ?? config.enabled) ? '启用中' : '已停用'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="备份类型">
          {backupTypeLabels[config.backup_type] || config.backup_type}
        </Descriptions.Item>
        <Descriptions.Item label="排程类型">
          {scheduleTypeLabels[config.schedule_type] || config.schedule_type || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Cron表达式">
          <span className="font-mono">{config.cron_expression || '-'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="压缩">
          {formatBoolean(config.compress)}
        </Descriptions.Item>
        <Descriptions.Item label="压缩级别">
          {config.compress_level ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="加密">
          {formatBoolean(config.encryption_enabled)}
        </Descriptions.Item>
        <Descriptions.Item label="加密密钥">
          {config.encryption_enabled ? maskSecret(config.encryption_key) : '未启用'}
        </Descriptions.Item>
        <Descriptions.Item label="保留策略">
          {retentionTypeLabels[config.retention_type] || config.retention_type || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="保留规则">
          {config.retention_type === 'count'
            ? `保留 ${config.retention_count || 0} 份`
            : `保留 ${config.retention_days || 0} 天`}
        </Descriptions.Item>
        <Descriptions.Item label="成功通知">
          {formatBoolean(config.notify_on_success)}
        </Descriptions.Item>
        <Descriptions.Item label="失败通知">
          {formatBoolean(config.notify_on_failure)}
        </Descriptions.Item>
        <Descriptions.Item label="邮件通知">
          {config.email_enabled ? (config.email || '已启用，未填写地址') : '未启用'}
        </Descriptions.Item>
        <Descriptions.Item label="Webhook 通知">
          {config.webhook_enabled ? (config.webhook_url || '已启用，未填写地址') : '未启用'}
        </Descriptions.Item>
        <Descriptions.Item label="GFS保留策略" span={2}>
          {config.gfs_tier_enabled
            ? `已启用：日保留 ${config.gfs_son_retention_days || 0} 天，周保留 ${config.gfs_father_retention_weeks || 0} 周，月保留 ${config.gfs_grandfather_retention_months || 0} 月`
            : '未启用'}
        </Descriptions.Item>
        <Descriptions.Item label="存储配置" span={2}>
          {renderStorageConfig(config)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );

  const databaseColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: number) => <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>#{id}</span> },
    { title: '名称', dataIndex: 'name', key: 'name', render: (name: string) => <span className="font-medium">{name}</span> },
    { title: '类型', dataIndex: 'database_type', key: 'database_type', width: 100, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{databaseTypeLabels[type] || type}</Tag> },
    { title: '连接信息', key: 'connection', render: (_: any, record: DatabaseRecord) => <span className="text-sm text-secondary">{record.host}:{record.port}</span> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => new Date(time).toLocaleString('zh-CN') },
    {
      title: '详情',
      key: 'detail',
      width: 90,
      render: (_: any, record: DatabaseRecord) => (
        <Button type="link" icon={<Eye size={14} />} onClick={() => handleOpenDetail(record)}>
          详情
        </Button>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: DatabaseRecord) => (
        <Space>
          <Tooltip title="测试连接"><Button type="text" icon={<TestTube size={14} />} onClick={() => handleTestConnection(record)} /></Tooltip>
          <Tooltip title="编辑"><Button type="text" icon={<Edit2 size={14} />} onClick={() => {
            setEditingDb(record);
            editForm.setFieldsValue({
              name: record.name,
              host: record.host,
              port: record.port,
              user: record.user || record.username,
              database_name: record.name,
            });
            setEditModalVisible(true);
          }} /></Tooltip>
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

  const tabItems = [
    {
      key: 'databases',
      label: <span className="flex items-center gap-2"><Database size={16} />数据库管理</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">已配置的数据库</h3>
              <p className="text-sm text-secondary">通过向导添加数据库并自动配置备份计划</p>
            </div>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setWizardVisible(true)}>添加数据库</Button>
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
            </Space>
          </div>
          <Table columns={backupColumns} dataSource={backups} rowKey="id" loading={backupsLoading} pagination={{ pageSize: 10 }} />
        </div>
      )
    }
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">备份中心</h1>
        <p className="page-description">统一管理数据库和备份任务</p>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal
        title="新建数据库向导"
        open={wizardVisible}
        onCancel={() => setWizardVisible(false)}
        footer={null}
        width={900}
        centered
        destroyOnClose
      >
        <DatabaseWizard onComplete={handleWizardComplete} onCancel={() => setWizardVisible(false)} />
      </Modal>

      <Modal title={`编辑数据库: ${editingDb?.name || ''}`} open={editModalVisible} onCancel={() => { setEditModalVisible(false); editForm.resetFields(); setEditingDb(null); }} onOk={handleUpdateDatabase} okText="更新" cancelText="取消" width={550}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="数据库名称" rules={[{ required: true, message: '请输入数据库名称' }]}>
            <Input placeholder="my-database" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]} style={{ flex: 1 }}>
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
              <Input type="number" placeholder="3306" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="user" label="用户名" rules={[{ required: true, message: '请输入用户名' }]} style={{ flex: 1 }}>
              <Input placeholder="root" />
            </Form.Item>
            <Form.Item name="password" label="密码" style={{ flex: 1 }}>
              <Input.Password placeholder="留空则不修改" />
            </Form.Item>
          </div>
          <Form.Item name="database_name" label="数据库名" extra="全量备份时可留空">
            <Input placeholder="留空则备份实例中所有数据库" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selectedDb ? `数据库详情：${selectedDb.name}` : '数据库详情'}
        open={detailVisible}
        width={780}
        onClose={() => {
          setDetailVisible(false);
          setSelectedDb(null);
          setSelectedConfigs([]);
        }}
        destroyOnHidden
      >
        {detailLoading || !selectedDb ? (
          <div style={{ paddingTop: 32 }}>
            <Progress percent={80} showInfo={false} status="active" />
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="数据库基本信息">
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="数据库名称">{selectedDb.name}</Descriptions.Item>
                <Descriptions.Item label="数据库类型">
                  {databaseTypeLabels[selectedDb.database_type] || selectedDb.database_type}
                </Descriptions.Item>
                <Descriptions.Item label="引擎版本">{selectedDb.engine_version || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatDateTime(selectedDb.created_at)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="连接设置">
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="主机地址">{selectedDb.host || '-'}</Descriptions.Item>
                <Descriptions.Item label="端口">{selectedDb.port || '-'}</Descriptions.Item>
                <Descriptions.Item label="用户名">{selectedDb.user || selectedDb.username || '-'}</Descriptions.Item>
                <Descriptions.Item label="数据库名">{selectedDb.database_name || selectedDb.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="物理备份支持">
                  {formatBoolean(selectedDb.is_physical_backup_supported)}
                </Descriptions.Item>
                <Descriptions.Item label="Binlog / WAL">
                  {selectedDb.database_type === 'mysql'
                    ? formatBoolean(selectedDb.binary_log_enabled)
                    : formatBoolean(selectedDb.wal_enabled)}
                </Descriptions.Item>
                <Descriptions.Item label="Binlog路径" span={2}>
                  {selectedDb.binary_log_path || selectedDb.wal_path || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备份工具路径" span={2}>
                  {selectedDb.xtrabackup_path || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider style={{ margin: 0 }} />

            {selectedConfigs.length > 0 ? (
              selectedConfigs.map((config, index) => renderBackupConfigDetail(config, index))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前数据库尚未找到备份配置，无法展示排程、存储、保留和通知设置。"
              />
            )}
          </Space>
        )}
      </Drawer>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
