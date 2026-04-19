import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Select, DatePicker, Form, Input, Popconfirm } from 'antd';
import { RotateCcw, RefreshCw, Clock, Play, AlertTriangle, CheckCircle, XCircle, Loader, History } from 'lucide-react';
import { restoreAPI, backupAPI } from '../services/api';

interface RestoreRecord {
  id: number;
  workspace_id: number;
  database_id: number;
  database_type: string;
  backup_id: number;
  pitr_time?: string;
  status: string;
  created_at: string;
}

interface Backup {
  id: number;
  database_id: number;
  database_type: string;
  backup_type: string;
  status: string;
  file_path?: string;
  file_size?: number;
  backup_time: string;
  created_at: string;
}

export const Restores: React.FC = () => {
  const [restores, setRestores] = useState<RestoreRecord[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [restoreType, setRestoreType] = useState<'full' | 'pitr'>('full');
  const [pitrTime, setPitrTime] = useState<Date | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRestores();
    fetchBackups();
  }, []);

  const fetchRestores = async () => {
    setLoading(true);
    try {
      const data = await restoreAPI.getAll();
      setRestores(data?.restores || []);
    } catch (error) {
      console.error('Failed to fetch restores:', error);
      message.error('获取恢复记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const data = await backupAPI.getAll();
      setBackups(data?.backups?.filter((b: Backup) => b.status === 'success') || []);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const handleCreateRestore = async () => {
    if (!selectedBackup) {
      message.warning('请选择备份');
      return;
    }

    try {
      const restoreData: any = {
        workspace_id: 1,
        database_id: selectedBackup.database_id,
        database_type: selectedBackup.database_type,
        backup_id: selectedBackup.id,
      };

      if (restoreType === 'pitr' && pitrTime) {
        restoreData.pitr_time = pitrTime.toISOString();
      }

      await restoreAPI.create(restoreData);
      message.success('恢复任务已创建');
      setCreateModalVisible(false);
      setSelectedBackup(null);
      setPitrTime(null);
      fetchRestores();
    } catch (error) {
      console.error('Failed to create restore:', error);
      message.error('创建恢复任务失败');
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
      width: 120,
      render: (_: any, record: RestoreRecord) => (
        <span style={{ fontWeight: 500 }}>DB-{record.database_id}</span>
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
      title: '恢复类型',
      dataIndex: 'pitr_time',
      key: 'pitr_time',
      width: 140,
      render: (pitrTime: string) => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: pitrTime ? 'var(--color-accent)' : 'var(--color-secondary)',
          fontSize: '13px'
        }}>
          {pitrTime ? (
            <>
              <Clock size={14} />
              时间点恢复
            </>
          ) : (
            <>
              <History size={14} />
              全量恢复
            </>
          )}
        </span>
      )
    },
    {
      title: 'PITR时间',
      dataIndex: 'pitr_time',
      key: 'pitr_time',
      width: 180,
      render: (time: string) => (
        <span style={{
          fontSize: '13px',
          color: time ? 'var(--color-accent)' : 'var(--color-text-muted)',
          fontFamily: time ? 'var(--font-display)' : 'inherit'
        }}>
          {time ? new Date(time).toLocaleString() : '-'}
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <span style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)'
        }}>
          {new Date(time).toLocaleString()}
        </span>
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
          PITR 恢复
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          数据库时间点恢复，支持恢复到任意指定时刻
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
            <RotateCcw size={20} style={{ color: 'var(--color-accent)' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '1px'
            }}>
              恢复记录
            </span>
            <span style={{
              background: 'rgba(255, 0, 110, 0.1)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--color-accent)'
            }}>
              {restores.length} 条记录
            </span>
          </div>

          <Space size={12}>
            <button
              className="cyber-button"
              onClick={fetchRestores}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} />
              刷新
            </button>
            <button
              className="cyber-button"
              onClick={() => setCreateModalVisible(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--color-accent)',
                color: 'var(--color-accent)'
              }}
            >
              <RotateCcw size={14} />
              创建恢复任务
            </button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={restores}
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
        onCancel={() => {
          setCreateModalVisible(false);
          setSelectedBackup(null);
          setRestoreType('full');
          setPitrTime(null);
        }}
        footer={null}
        closable={false}
        width={600}
      >
        <div className="cyber-modal">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <RotateCcw size={24} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
              letterSpacing: '1px'
            }}>
              创建恢复任务
            </h3>
          </div>

          <div style={{
            background: 'rgba(255, 0, 110, 0.05)',
            border: '1px solid rgba(255, 0, 110, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-accent)', marginTop: '2px' }} />
            <div>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--color-text)',
                lineHeight: '1.5'
              }}>
                恢复操作将覆盖当前数据库数据，请确保已备份重要数据。PITR恢复可精确到指定时间点。
              </p>
            </div>
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
              选择备份
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择备份"
              value={selectedBackup?.id}
              onChange={(value) => {
                const backup = backups.find(b => b.id === value);
                setSelectedBackup(backup || null);
              }}
            >
              {backups.map(backup => (
                <Select.Option key={backup.id} value={backup.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: backup.database_type === 'mysql' ? '#3b5998' : '#336791'
                    }} />
                    备份 #{backup.id} - {backup.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL'} -
                    {new Date(backup.backup_time).toLocaleString()}
                  </div>
                </Select.Option>
              ))}
            </Select>
          </div>

          {selectedBackup && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                恢复类型
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setRestoreType('full');
                    setPitrTime(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: restoreType === 'full' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(0, 240, 255, 0.02)',
                    border: `1px solid ${restoreType === 'full' ? 'var(--color-success)' : 'var(--color-border)'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <History size={18} style={{ color: restoreType === 'full' ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: restoreType === 'full' ? 'var(--color-success)' : 'var(--color-text)'
                    }}>
                      全量恢复
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    lineHeight: '1.4'
                  }}>
                    恢复到备份创建时的状态
                  </p>
                </button>

                <button
                  onClick={() => setRestoreType('pitr')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: restoreType === 'pitr' ? 'rgba(255, 0, 110, 0.1)' : 'rgba(0, 240, 255, 0.02)',
                    border: `1px solid ${restoreType === 'pitr' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <Clock size={18} style={{ color: restoreType === 'pitr' ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: restoreType === 'pitr' ? 'var(--color-accent)' : 'var(--color-text)'
                    }}>
                      时间点恢复
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    lineHeight: '1.4'
                  }}>
                    恢复到指定的任意时间点
                  </p>
                </button>
              </div>
            </div>
          )}

          {selectedBackup && restoreType === 'pitr' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                选择恢复时间点
              </label>
              <DatePicker
                style={{ width: '100%' }}
                showTime
                value={pitrTime}
                onChange={setPitrTime}
                placeholder="选择目标恢复时间"
                disabledDate={(current) => {
                  if (!selectedBackup.backup_time) return false;
                  const backupTime = new Date(selectedBackup.backup_time);
                  const now = new Date();
                  return current.toDate().getTime() > now.getTime() || current.toDate().getTime() < backupTime.getTime();
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={12} />
                备份时间: {selectedBackup.backup_time ? new Date(selectedBackup.backup_time).toLocaleString() : '-'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              className="cyber-button"
              onClick={() => {
                setCreateModalVisible(false);
                setSelectedBackup(null);
                setRestoreType('full');
                setPitrTime(null);
              }}
              style={{ flex: 1 }}
            >
              取消
            </button>
            <button
              className="cyber-button"
              onClick={handleCreateRestore}
              disabled={!selectedBackup || (restoreType === 'pitr' && !pitrTime)}
              style={{
                flex: 1,
                borderColor: 'var(--color-accent)',
                color: 'var(--color-accent)'
              }}
            >
              <Play size={14} style={{ marginRight: '6px' }} />
              创建恢复任务
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};