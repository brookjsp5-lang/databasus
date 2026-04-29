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
import { Table, Button, Tag, Modal, Form, Input, Select, Popconfirm, Progress, message, Space, Card, Tabs, Tooltip } from 'antd';
import { Database, HardDrive, Plus, Trash2, Loader, CheckCircle, XCircle, Clock, RefreshCw, Edit2, TestTube } from 'lucide-react';
import { backupAPI, mysqlDatabaseAPI, postgresqlDatabaseAPI } from '../services/api';
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
  created_at: string;
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
