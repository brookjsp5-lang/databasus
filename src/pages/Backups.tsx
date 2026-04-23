import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Tag, Modal, message, Select, Popconfirm, Progress } from 'antd';
import { HardDrive, Plus, Trash2, Loader, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { backupAPI, mysqlDatabaseAPI, postgresqlDatabaseAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface Database {
  id: number;
  name: string;
  database_type: string;
  host: string;
  port: number;
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

export const Backups: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedDb, setSelectedDb] = useState<{ id: number; type: string } | null>(null);
  const [backupType, setBackupType] = useState<string>('physical');
  const [databases, setDatabases] = useState<Database[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, ProgressUpdate>>({});

  const handleProgressUpdate = useCallback((data: any) => {
    if (data.type === 'progress_update' && data.payload) {
      const update = data.payload as ProgressUpdate;
      if (update.backup_id) {
        setProgressMap(prev => ({
          ...prev,
          [update.backup_id]: update
        }));

        if (update.status === 'success' || update.status === 'failed') {
          setTimeout(() => {
            fetchBackups();
          }, 1000);
        }
      }
    }
  }, []);

  const { isConnected, reconnect } = useWebSocket({
    onMessage: handleProgressUpdate,
    onError: (error) => {
      console.log('WebSocket connection error (non-critical):', error);
    },
  });

  useEffect(() => {
    fetchBackups();
    fetchDatabases();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await backupAPI.getAll();
      setBackups((data?.backups || []) as BackupRecord[]);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabases = async () => {
    try {
      const [mysqlData, pgData] = await Promise.all([
        mysqlDatabaseAPI.getAll(),
        postgresqlDatabaseAPI.getAll()
      ]);
      const allDatabases: Database[] = [
        ...(mysqlData?.databases || []).map((db: any) => ({ ...db, database_type: 'mysql' })),
        ...(pgData?.databases || []).map((db: any) => ({ ...db, database_type: 'postgresql' }))
      ];
      setDatabases(allDatabases);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
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
      message.success('备份任务已创建，正在执行...');
      setCreateModalVisible(false);
      setSelectedDb(null);
      fetchBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
      message.error('创建备份失败');
    }
  };

  const handleDeleteBackup = async (id: number) => {
    try {
      await backupAPI.delete(id);
      message.success('备份已删除');
      fetchBackups();
    } catch (error) {
      message.error('删除备份失败');
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

  const getDatabaseName = (dbId: number, dbType: string) => {
    const db = databases.find(d => d.id === dbId && d.database_type === dbType);
    return db ? `${db.name} (${db.host}:${db.port})` : `DB-${dbId}`;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: number) => (
        <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>
          #{id}
        </span>
      )
    },
    {
      title: '数据库',
      dataIndex: 'database_id',
      key: 'database_id',
      width: 200,
      render: (_: any, record: BackupRecord) => (
        <div className="flex items-center gap-3">
          <div className="database-dot" style={{ background: record.database_type === 'mysql' ? '#3b5998' : '#336791' }} />
          <span className="font-medium">{getDatabaseName(record.database_id, record.database_type)}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'database_type',
      key: 'database_type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === 'mysql' ? 'blue' : 'green'}>
          {type === 'mysql' ? 'MySQL' : 'PostgreSQL'}
        </Tag>
      )
    },
    {
      title: '备份类型',
      dataIndex: 'backup_type',
      key: 'backup_type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === 'physical' ? 'purple' : 'orange'}>
          {type === 'physical' ? '物理备份' : '逻辑备份'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string, record: BackupRecord) => {
        const config = getStatusConfig(status);
        const progress = progressMap[record.id]?.progress || record.progress || 0;
        const progressMsg = progressMap[record.id]?.message;

        return (
          <div className="flex flex-col gap-1">
            <div className="status-indicator">
              <config.icon
                size={14}
                style={{
                  color: config.color,
                  animation: status === 'running' ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span className="text-sm" style={{ color: config.color, fontWeight: 500 }}>
                {config.text}
              </span>
              {!isConnected && status === 'running' && (
                <Tag color="warning" className="ml-2 text-xs">重连中</Tag>
              )}
            </div>
            {status === 'running' && progress > 0 && (
              <Progress
                percent={Math.round(progress)}
                size="small"
                strokeColor="var(--color-primary)"
                trailColor="var(--color-bg-hover)"
                format={(p) => `${p}%`}
              />
            )}
            {progressMsg && status === 'running' && (
              <span className="text-xs text-secondary">{progressMsg}</span>
            )}
          </div>
        );
      }
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size: number) => (
        <span className="text-secondary">
          {size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '-'}
        </span>
      )
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <span className="text-sm text-secondary">
          {new Date(time).toLocaleString()}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: BackupRecord) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除这个备份吗？"
          onConfirm={() => handleDeleteBackup(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            icon={<Trash2 size={14} />}
            danger
            disabled={record.status === 'running'}
          />
        </Popconfirm>
      )
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">备份管理</h1>
          <p className="page-description">创建和管理数据库备份</p>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<RefreshCw size={16} />}
            onClick={fetchBackups}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建备份
          </Button>
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title="创建备份"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSelectedDb(null);
        }}
        onOk={handleCreateBackup}
        okText="创建"
        cancelText="取消"
      >
        <div className="mb-6">
          <label className="form-label">选择数据库</label>
          <Select
            placeholder="请选择数据库"
            className="w-full"
            value={selectedDb?.id}
            onChange={(value, option: any) => setSelectedDb({ id: value, type: option.type })}
            options={databases.map(db => ({
              label: `${db.name} (${db.host}:${db.port}) [${db.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL'}]`,
              value: db.id,
              type: db.database_type
            }))}
          />
        </div>

        <div className="mb-4">
          <label className="form-label">备份类型</label>
          <Select
            className="w-full"
            value={backupType}
            onChange={setBackupType}
            options={[
              { label: '物理备份 (xtrabackup/pg_basebackup)', value: 'physical' },
              { label: '逻辑备份 (mysqldump/pg_dump)', value: 'logical' }
            ]}
          />
        </div>

        <div className="bg-info bg-opacity-10 p-4 rounded-lg border border-info border-opacity-20">
          <p className="text-sm text-info">
            物理备份使用 xtrabackup (MySQL) 或 pg_basebackup (PostgreSQL) 进行快速备份。
            备份过程可能需要几分钟时间，请耐心等待。
          </p>
        </div>
      </Modal>

      <style>{`
        .database-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};