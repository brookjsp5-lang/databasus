import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Select, Popconfirm } from 'antd';
import { HardDrive, RefreshCw, Download, Trash2, Play, Plus, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { backupAPI, mysqlDatabaseAPI, postgresqlDatabaseAPI } from '../services/api';

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
}

export const Backups: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedDb, setSelectedDb] = useState<{ id: number; type: string } | null>(null);
  const [backupType, setBackupType] = useState<string>('physical');
  const [databases, setDatabases] = useState<Database[]>([]);

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
      message.success('备份任务已创建');
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
      failed: { color: 'var(--color-error)', icon: XCircle, text: '失败' }
    };
    return configMap[status] || { color: 'var(--color-text-muted)', icon: Clock, text: status };
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: number) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--color-primary)'
        }}>
          #{id}
        </span>
      )
    },
    {
      title: '数据库',
      dataIndex: 'database_id',
      key: 'database_id',
      width: 150,
      render: (_: any, record: BackupRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: record.database_type === 'mysql' ? '#3b5998' : '#336791',
            boxShadow: record.database_type === 'mysql' ? '0 0 8px #3b5998' : '0 0 8px #336791'
          }} />
          <span style={{ fontWeight: 500 }}>DB-{record.database_id}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'database_type',
      key: 'database_type',
      width: 120,
      render: (type: string) => (
        <Tag style={{
          background: type === 'mysql' ? 'rgba(59, 89, 152, 0.15)' : 'rgba(51, 103, 145, 0.15)',
          border: `1px solid ${type === 'mysql' ? 'rgba(59, 89, 152, 0.4)' : 'rgba(51, 103, 145, 0.4)'}`,
          color: type === 'mysql' ? '#3b5998' : '#336791',
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          letterSpacing: '0.5px'
        }}>
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
        <span style={{
          fontSize: '13px',
          color: type === 'physical' ? 'var(--color-secondary)' : 'var(--color-warning)'
        }}>
          {type === 'physical' ? '◇ 物理备份' : '◇ 逻辑备份'}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const config = getStatusConfig(status);
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: config.color,
            fontSize: '13px'
          }}>
            <config.icon
              size={14}
              style={{
                animation: status === 'running' ? 'spin 1s linear infinite' : 'none'
              }}
            />
            {config.text}
          </span>
        );
      }
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (size: number) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--color-text-muted)'
        }}>
          {size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '-'}
        </span>
      )
    },
    {
      title: '时间',
      dataIndex: 'backup_time',
      key: 'backup_time',
      width: 180,
      render: (time: string) => (
        <span style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)'
        }}>
          {time ? new Date(time).toLocaleString() : '-'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: BackupRecord) => (
        <Space size={8}>
          <button
            className="cyber-button"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            disabled={record.status !== 'success'}
          >
            <Play size={12} />
            恢复
          </button>
          <Popconfirm
            title="确认删除此备份？"
            onConfirm={() => handleDeleteBackup(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <button
              className="cyber-button"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderColor: 'var(--color-error)',
                color: 'var(--color-error)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Trash2 size={12} />
              删除
            </button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--color-text)',
          marginBottom: '8px',
          letterSpacing: '2px'
        }}>
          备份管理
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          管理数据库备份任务，查看备份历史记录
        </p>
      </div>

      <div className="cyber-card" style={{ padding: '0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HardDrive size={20} style={{ color: 'var(--color-primary)' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '1px'
            }}>
              备份列表
            </span>
            <span style={{
              background: 'rgba(0, 240, 255, 0.1)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--color-primary)'
            }}>
              {backups.length} 条记录
            </span>
          </div>

          <Space size={12}>
            <button
              className="cyber-button"
              onClick={fetchBackups}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} />
              刷新
            </button>
            <button
              className="cyber-button cyber-button-primary"
              onClick={() => setCreateModalVisible(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              创建备份
            </button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={backups}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                共 {total} 条记录
              </span>
            )
          }}
          style={{ background: 'transparent' }}
        />
      </div>

      <Modal
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        closable={false}
        width={450}
      >
        <div className="cyber-modal">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <HardDrive size={24} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
              letterSpacing: '1px'
            }}>
              创建备份任务
            </h3>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              选择数据库
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择数据库"
              value={selectedDb ? `${selectedDb.id}-${selectedDb.type}` : null}
              onChange={(value) => {
                const [id, type] = value.split('-');
                setSelectedDb({ id: parseInt(id), type });
              }}
              className="cyber-select"
            >
              {databases.map(db => (
                <Select.Option key={`${db.id}-${db.database_type}`} value={`${db.id}-${db.database_type}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: db.database_type === 'mysql' ? '#3b5998' : '#336791'
                    }} />
                    {db.name} ({db.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL'})
                  </div>
                </Select.Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              备份类型
            </label>
            <Select
              style={{ width: '100%' }}
              value={backupType}
              onChange={setBackupType}
              className="cyber-select"
            >
              <Select.Option value="physical">
                <span style={{ color: 'var(--color-secondary)' }}>◇ 物理备份</span>
              </Select.Option>
              <Select.Option value="logical">
                <span style={{ color: 'var(--color-warning)' }}>◇ 逻辑备份</span>
              </Select.Option>
            </Select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="cyber-button"
              onClick={() => setCreateModalVisible(false)}
              style={{ flex: 1 }}
            >
              取消
            </button>
            <button
              className="cyber-button cyber-button-primary"
              onClick={handleCreateBackup}
              style={{ flex: 1 }}
            >
              创建备份
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};