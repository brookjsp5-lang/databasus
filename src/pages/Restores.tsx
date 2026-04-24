/**
 * Restores - PITR恢复页面组件
 * 
 * @description 提供数据库时间点恢复（PITR）功能：
 * - 恢复记录列表查看
 * - 创建新的恢复任务
 * - 选择备份和时间点
 * - 实时恢复进度跟踪
 * - 恢复历史记录
 * 
 * @module pages/Restores
 * @requires React
 * @requires antd (Table, Button, Modal等)
 * @requires lucide-react (图标)
 * @requires services/api (restoreAPI, backupAPI)
 * @requires hooks/useWebSocket (实时通信)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Tag, Modal, message, Select, DatePicker, Popconfirm, Progress, Alert, Space, Tooltip } from 'antd';
import { RotateCcw, Clock, Loader, CheckCircle, XCircle, AlertTriangle, RefreshCw, Info, Ban, History } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { restoreAPI, backupAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * 恢复记录接口
 * @description 定义数据库恢复任务的信息
 */
interface RestoreRecord {
  /** 恢复记录ID */
  id: number;
  /** 工作空间ID */
  workspace_id: number;
  /** 数据库ID */
  database_id: number;
  /** 数据库类型 */
  database_type: string;
  /** 关联的备份ID */
  backup_id: number;
  /** PITR时间点 */
  pitr_time?: string;
  /** 恢复状态 */
  status: string;
  /** 恢复进度 (%) */
  progress?: number;
  /** 错误信息 */
  error_msg?: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * 备份数据接口
 * @description 定义可用于恢复的备份信息
 */
interface Backup {
  /** 备份ID */
  id: number;
  /** 数据库ID */
  database_id: number;
  /** 数据库类型 */
  database_type: string;
  /** 备份类型 */
  backup_type: string;
  /** 备份状态 */
  status: string;
  /** 备份文件路径 */
  file_path?: string;
  /** 备份文件大小 */
  file_size?: number;
  /** 备份时间 */
  backup_time: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * 恢复进度更新接口
 * @description WebSocket推送的恢复进度信息
 */
interface ProgressUpdate {
  /** 恢复ID */
  restore_id: number;
  /** 恢复状态 */
  status: string;
  /** 恢复进度 (%) */
  progress: number;
  /** 状态消息 */
  message: string;
}

/**
 * PITR时间范围接口
 * @description 定义可恢复的时间范围
 */
interface PITRTimeRange {
  /** 最早可恢复时间 */
  min_time: string;
  /** 最晚可恢复时间 */
  max_time: string;
  /** 备份时间 */
  backup_time: string;
}

/**
 * Restores PITR恢复组件
 * 
 * @description 提供数据库时间点恢复功能
 * - 查看恢复历史记录
 * - 创建新的恢复任务
 * - 选择备份和时间点进行PITR
 * - 实时跟踪恢复进度
 * 
 * @example
 * ```tsx
 * <Restores />
 * ```
 */
export const Restores: React.FC = () => {
  /** 恢复记录列表 */
  const [restores, setRestores] = useState<RestoreRecord[]>([]);
  /** 可用备份列表 */
  const [backups, setBackups] = useState<Backup[]>([]);
  /** 加载状态 */
  const [loading, setLoading] = useState(false);
  /** 创建恢复模态框可见性 */
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [restoreType, setRestoreType] = useState<'full' | 'pitr'>('full');
  const [pitrTime, setPitrTime] = useState<Dayjs | null>(null);
  const [pitrTimeRange, setPitrTimeRange] = useState<PITRTimeRange | null>(null);
  const [backupBeforeRestore, setBackupBeforeRestore] = useState(true);
  const [isOriginalInstance, setIsOriginalInstance] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [validatingBackup, setValidatingBackup] = useState(false);
  const [backupValid, setBackupValid] = useState<boolean | null>(null);
  const [progressMap, setProgressMap] = useState<Record<number, ProgressUpdate>>({});

  const handleProgressUpdate = useCallback((data: any) => {
    if (data.type === 'progress_update' && data.payload) {
      const update = data.payload as ProgressUpdate;
      if (update.restore_id) {
        setProgressMap(prev => ({
          ...prev,
          [update.restore_id]: update
        }));

        if (update.status === 'success' || update.status === 'failed') {
          setTimeout(() => {
            fetchRestores();
          }, 1000);
        }
      }
    }
  }, []);

  useWebSocket({
    onMessage: handleProgressUpdate,
    onError: () => {},
  });

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

  const checkRestoreTarget = async (backup: Backup) => {
    try {
      const response = await restoreAPI.checkTarget({
        backup_id: backup.id,
        database_id: backup.database_id,
        database_type: backup.database_type
      });
      setIsOriginalInstance(response.is_original_instance);
      setWarningMessage(response.warning_message || '');
    } catch (error) {
      console.error('Failed to check restore target:', error);
    }
  };

  const fetchPITRTimeRange = async (backupId: number, databaseType: string) => {
    try {
      const response = await fetch(`/api/restores/pitr-time-range?backup_id=${backupId}&database_type=${databaseType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPitrTimeRange(data);
      }
    } catch (error) {
      console.error('Failed to fetch PITR time range:', error);
    }
  };

  const validateBackup = async (backupId: number, databaseType: string) => {
    setValidatingBackup(true);
    setBackupValid(null);
    try {
      const response = await fetch(`/api/restores/validate-backup?backup_id=${backupId}&database_type=${databaseType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBackupValid(data.is_valid);
        if (!data.is_valid) {
          message.error(`备份验证失败: ${data.error_msg}`);
        }
      }
    } catch (error) {
      console.error('Failed to validate backup:', error);
      setBackupValid(false);
    } finally {
      setValidatingBackup(false);
    }
  };

  const handleSelectBackup = async (value: number, option: any) => {
    const backup = option as Backup;
    setSelectedBackup(backup);
    setBackupValid(null);

    await checkRestoreTarget(backup);
    await validateBackup(backup.id, backup.database_type);

    if (restoreType === 'pitr') {
      await fetchPITRTimeRange(backup.id, backup.database_type);
    }
  };

  const handleRestoreTypeChange = (value: 'full' | 'pitr') => {
    setRestoreType(value);
    if (value === 'pitr' && selectedBackup) {
      fetchPITRTimeRange(selectedBackup.id, selectedBackup.database_type);
    } else {
      setPitrTime(null);
      setPitrTimeRange(null);
    }
  };

  const handleCreateRestore = async () => {
    if (!selectedBackup) {
      message.warning('请选择备份');
      return;
    }

    if (restoreType === 'pitr' && !pitrTime) {
      message.warning('请选择PITR恢复时间点');
      return;
    }

    try {
      const restoreData: any = {
        workspace_id: 1,
        database_id: selectedBackup.database_id,
        database_type: selectedBackup.database_type,
        backup_id: selectedBackup.id,
        backup_before_restore: backupBeforeRestore,
      };

      if (restoreType === 'pitr' && pitrTime) {
        restoreData.pitr_time = pitrTime.toISOString();
      }

      if (isOriginalInstance) {
        setPendingRestoreData(restoreData);
        setConfirmModalVisible(true);
        return;
      }

      await executeRestore(restoreData);
    } catch (error: any) {
      if (error?.requires_confirmation) {
        setPendingRestoreData(error);
        setConfirmModalVisible(true);
      } else {
        message.error('创建恢复任务失败');
      }
    }
  };

  const executeRestore = async (restoreData: any) => {
    try {
      await restoreAPI.create(restoreData);
      message.success('恢复任务已创建，正在执行...');
      setCreateModalVisible(false);
      setConfirmModalVisible(false);
      setSelectedBackup(null);
      setPitrTime(null);
      setConfirmRestore(false);
      setPendingRestoreData(null);
      setIsOriginalInstance(false);
      setWarningMessage('');
      fetchRestores();
    } catch (error: any) {
      if (error?.requires_confirmation) {
        setPendingRestoreData(restoreData);
        setConfirmModalVisible(true);
      } else {
        message.error('创建恢复任务失败');
      }
    }
  };

  const handleConfirmRestore = async () => {
    if (pendingRestoreData) {
      pendingRestoreData.confirm_restore = true;
      await executeRestore(pendingRestoreData);
    }
  };

  const handleCancelRestore = async (id: number) => {
    try {
      await fetch(`/api/restores/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      message.success('恢复任务已取消');
      fetchRestores();
    } catch (error) {
      message.error('取消恢复任务失败');
    }
  };

  const getStatusConfig = (status: string) => {
    const configMap: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'var(--color-warning)', icon: Clock, text: '等待中' },
      running: { color: 'var(--color-primary)', icon: Loader, text: '执行中' },
      success: { color: 'var(--color-success)', icon: CheckCircle, text: '成功' },
      failed: { color: 'var(--color-danger)', icon: XCircle, text: '失败' },
      cancelled: { color: 'var(--color-text-tertiary)', icon: Ban, text: '已取消' }
    };
    return configMap[status] || { color: 'var(--color-text-tertiary)', icon: Clock, text: status };
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
      width: 150,
      render: (id: number) => (
        <span className="font-medium">DB-{id}</span>
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
      title: '恢复类型',
      key: 'restore_type',
      width: 140,
      render: (_: any, record: RestoreRecord) => (
        <Tag color={record.pitr_time ? 'purple' : 'cyan'}>
          {record.pitr_time ? '时间点恢复' : '全量恢复'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string, record: RestoreRecord) => {
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
      width: 120,
      render: (_: any, record: RestoreRecord) => (
        <Space>
          {(record.status === 'pending' || record.status === 'running') && (
            <Tooltip title="取消恢复">
              <Button
                type="text"
                icon={<Ban size={14} />}
                onClick={() => handleCancelRestore(record.id)}
                danger
              />
            </Tooltip>
          )}
        </Space>
      )
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">恢复管理</h1>
          <p className="page-description">恢复数据库到指定时间点或全量恢复</p>
        </div>
        <Space>
          <Button
            icon={<RefreshCw size={16} />}
            onClick={fetchRestores}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<RotateCcw size={16} />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建恢复任务
          </Button>
        </Space>
      </div>

      <div className="card">
        <Table
          columns={columns}
          dataSource={restores}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title="创建恢复任务"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSelectedBackup(null);
          setPitrTime(null);
          setPitrTimeRange(null);
          setIsOriginalInstance(false);
          setWarningMessage('');
          setBackupValid(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="create"
            type="primary"
            onClick={handleCreateRestore}
            disabled={!selectedBackup || (restoreType === 'pitr' && !pitrTime)}
          >
            创建恢复任务
          </Button>
        ]}
        width={650}
      >
        <div className="mb-6">
          <label className="form-label">选择备份</label>
          <Select
            placeholder="请选择要恢复的备份"
            className="w-full"
            value={selectedBackup?.id}
            onChange={handleSelectBackup}
            options={backups.map(backup => ({
              label: `备份 #${backup.id} - ${backup.database_type} - ${new Date(backup.created_at).toLocaleString()} - ${(backup.file_size / 1024 / 1024).toFixed(2)} MB`,
              value: backup.id,
              ...backup
            }))}
          />
          {validatingBackup && (
            <div className="mt-2 text-sm text-secondary">
              正在验证备份文件...
            </div>
          )}
          {backupValid === true && (
            <div className="mt-2 text-sm text-success flex items-center gap-1">
              <CheckCircle size={14} /> 备份文件验证通过
            </div>
          )}
          {backupValid === false && (
            <div className="mt-2 text-sm text-danger flex items-center gap-1">
              <XCircle size={14} /> 备份文件验证失败
            </div>
          )}
        </div>

        {isOriginalInstance && warningMessage && (
          <Alert
            type="warning"
            message="危险操作警告"
            description={warningMessage}
            icon={<AlertTriangle size={20} />}
            showIcon
            className="mb-4"
          />
        )}

        <div className="mb-6">
          <label className="form-label">恢复类型</label>
          <Select
            className="w-full"
            value={restoreType}
            onChange={handleRestoreTypeChange}
            options={[
              { label: '全量恢复', value: 'full' },
              { label: '时间点恢复 (PITR)', value: 'pitr' }
            ]}
          />
        </div>

        {restoreType === 'pitr' && (
          <div className="mb-6">
            <label className="form-label">选择时间点</label>
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-secondary" />
              <span className="text-xs text-secondary">
                可恢复时间范围: {pitrTimeRange ? (
                  `${new Date(pitrTimeRange.backup_time).toLocaleString()} 至 ${new Date(pitrTimeRange.max_time).toLocaleString()}`
                ) : '加载中...'}
              </span>
            </div>
            <DatePicker
              showTime
              className="w-full"
              value={pitrTime}
              onChange={(date) => setPitrTime(date)}
              placeholder="选择恢复时间点"
              disabledDate={(current) => {
                if (!pitrTimeRange) return false;
                const min = dayjs(pitrTimeRange.backup_time);
                const max = dayjs(pitrTimeRange.max_time);
                return current.isBefore(min) || current.isAfter(max);
              }}
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-info">
              <Info size={12} />
              <span>时间点恢复将应用备份时间点之后的所有WAL/BinLog日志</span>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={backupBeforeRestore}
              onChange={(e) => setBackupBeforeRestore(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">恢复前先备份当前数据（推荐）</span>
          </label>
        </div>

        <div className="bg-danger bg-opacity-10 p-4 rounded-lg border border-danger border-opacity-20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-danger mb-1">风险提示</p>
              <p className="text-sm text-secondary">
                恢复操作将覆盖当前数据库内容，此操作不可逆。请谨慎操作。
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="确认恢复操作"
        open={confirmModalVisible}
        onCancel={() => {
          setConfirmModalVisible(false);
          setConfirmRestore(false);
          setPendingRestoreData(null);
        }}
        onOk={handleConfirmRestore}
        okText="确认恢复"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: !confirmRestore }}
        width={500}
      >
        <Alert
          type="error"
          message="警告：恢复到原始数据库"
          description={
            <div className="mt-2">
              <p className="mb-2">您正在执行恢复到原始数据库实例的操作。</p>
              <p className="font-semibold">当前数据库的数据将被备份覆盖，此操作不可逆！</p>
            </div>
          }
          showIcon
          className="mb-4"
        />

        <div className="bg-warning bg-opacity-10 p-4 rounded-lg border border-warning border-opacity-20 mb-4">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning mb-1">建议</p>
              <p className="text-sm text-secondary">
                勾选"恢复前先备份当前数据"选项，系统会在恢复前自动创建当前数据的备份。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={confirmRestore}
            onChange={(e) => setConfirmRestore(e.target.checked)}
            className="w-4 h-4"
            id="confirmRestore"
          />
          <label htmlFor="confirmRestore" className="text-sm cursor-pointer">
            我已了解恢复操作的风险，确认要继续执行恢复
          </label>
        </div>
      </Modal>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};