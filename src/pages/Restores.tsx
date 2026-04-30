/**
 * Restores - PITR恢复页面组件
 * 
 * @description 提供数据库时间点恢复（PITR）功能：
 * - 恢复任务管理（创建、查看、取消）
 * - 恢复记录列表（筛选、搜索、详情查看）
 * - 选择备份和时间点进行PITR
 * - 实时恢复进度跟踪（WebSocket）
 * - 统计概览
 * 
 * @module pages/Restores
 * @requires React
 * @requires antd (Table, Button, Modal, Form, Tabs, Tag, Card, Space, Statistic, Row, Col等)
 * @requires lucide-react (图标)
 * @requires services/api (restoreAPI, backupAPI)
 * @requires hooks/useWebSocket (实时通信)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Tag, Modal, message, Select, DatePicker, Progress, Alert, Space, Tooltip, Card, Tabs, Input, Row, Col, Statistic, Descriptions, Form } from 'antd';
import { RotateCcw, Clock, Loader, CheckCircle, XCircle, AlertTriangle, RefreshCw, Info, Ban, History, FileText, Search, Database, Download, Server, Timer, Plus, Edit2, Trash2, TestTube } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { restoreAPI, backupAPI, restoreInstanceAPI } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface RestoreRecord {
  id: number;
  workspace_id: number;
  database_id: number;
  database_type: string;
  backup_id: number;
  target_kind?: 'original' | 'restore_instance';
  target_name?: string;
  pitr_time?: string;
  status: string;
  progress?: number;
  error_msg?: string;
  created_at: string;
  name?: string;
  storage_id?: number;
  storage_name?: string;
  restore_type?: string;
  source?: string;
  target?: string;
  data_size?: number;
  duration?: number;
  operator?: string;
  started_at?: string;
  completed_at?: string;
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

interface RestoreInstance {
  id: number;
  workspace_id: number;
  name: string;
  database_type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  user: string;
  database_name: string;
  engine_version?: string;
  created_at?: string;
}

interface RestoreInstanceFormData {
  name: string;
  database_type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  user: string;
  password?: string;
  database_name: string;
  engine_version?: string;
}

interface ProgressUpdate {
  restore_id: number;
  status: string;
  progress: number;
  message: string;
}

interface PITRTimeRange {
  min_time: string;
  max_time: string;
  backup_time: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  running: number;
}

interface FilterParams {
  search: string;
  status: string | null;
  restore_type: string | null;
  dateRange: [Dayjs | null, Dayjs | null] | null;
}

export const Restores: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tasks');

  const [restores, setRestores] = useState<RestoreRecord[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [restoreInstances, setRestoreInstances] = useState<RestoreInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<number, ProgressUpdate>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [targetKind, setTargetKind] = useState<'original' | 'restore_instance'>('original');
  const [selectedRestoreInstanceId, setSelectedRestoreInstanceId] = useState<number | null>(null);
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

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RestoreRecord | null>(null);
  const [instanceModalVisible, setInstanceModalVisible] = useState(false);
  const [instanceModalMode, setInstanceModalMode] = useState<'create' | 'edit'>('create');
  const [editingInstance, setEditingInstance] = useState<RestoreInstance | null>(null);
  const [testingInstanceConnection, setTestingInstanceConnection] = useState(false);
  const [instanceForm] = Form.useForm<RestoreInstanceFormData>();
  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    status: null,
    restore_type: null,
    dateRange: null,
  });

  const handleProgressUpdate = useCallback((data: any) => {
    if (data.type === 'progress_update' && data.payload) {
      const update = data.payload as ProgressUpdate;
      if (update.restore_id) {
        setProgressMap(prev => ({
          ...prev,
          [update.restore_id]: update
        }));
        if (update.status === 'success' || update.status === 'failed') {
          setTimeout(() => { fetchRestores(); }, 1000);
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
    fetchRestoreInstances();
  }, []);

  const fetchRestores = async () => {
    setLoading(true);
    try {
      const data = await restoreAPI.getAll();
      const restoreList = (data?.restores || []) as RestoreRecord[];
      setRestores(restoreList.map((r: any) => ({
        ...r,
        name: r.name || `恢复 #${r.id}`,
        storage_name: r.storage_name || `存储 #${r.storage_id || '-'}`,
        target: r.target || r.target_name || (r.target_kind === 'restore_instance' ? '恢复实例' : '原实例'),
        operator: r.operator || '系统',
        data_size: r.data_size || r.file_size || 0,
        duration: r.duration || calculateDuration(r.started_at, r.completed_at),
      })));
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

  const fetchRestoreInstances = async () => {
    setInstanceLoading(true);
    try {
      const data = await restoreInstanceAPI.getAll();
      setRestoreInstances((data?.instances || []) as RestoreInstance[]);
    } catch (error) {
      console.error('Failed to fetch restore instances:', error);
      message.error('获取恢复实例失败');
    } finally {
      setInstanceLoading(false);
    }
  };

  const calculateDuration = (started?: string, completed?: string): number => {
    if (!started || !completed) return 0;
    return Math.round((new Date(completed).getTime() - new Date(started).getTime()) / 1000);
  };

  const checkRestoreTarget = async (backup: Backup) => {
    try {
      const response = await restoreAPI.checkTarget({
        backup_id: backup.id,
        database_id: targetKind === 'original' ? backup.database_id : undefined,
        database_type: backup.database_type,
        target_kind: targetKind,
        target_instance_id: targetKind === 'restore_instance' ? selectedRestoreInstanceId || undefined : undefined,
      });
      setIsOriginalInstance(response.is_original_instance);
      setWarningMessage(response.warning_message || '');
    } catch (error) {
      console.error('Failed to check restore target:', error);
    }
  };

  const syncRestoreTargetWarning = async (
    backup: Backup | null,
    nextTargetKind: 'original' | 'restore_instance' = targetKind,
    nextRestoreInstanceId: number | null = selectedRestoreInstanceId,
  ) => {
    if (!backup) {
      setIsOriginalInstance(false);
      setWarningMessage('');
      return;
    }

    try {
      const response = await restoreAPI.checkTarget({
        backup_id: backup.id,
        database_id: nextTargetKind === 'original' ? backup.database_id : undefined,
        database_type: backup.database_type,
        target_kind: nextTargetKind,
        target_instance_id: nextTargetKind === 'restore_instance' ? nextRestoreInstanceId || undefined : undefined,
      });
      setIsOriginalInstance(response.is_original_instance);
      setWarningMessage(response.warning_message || '');
    } catch (error) {
      console.error('Failed to sync restore target warning:', error);
      setIsOriginalInstance(false);
      setWarningMessage('');
    }
  };

  const fetchPITRTimeRange = async (backupId: number, databaseType: string) => {
    try {
      const response = await fetch(`/api/restores/pitr-time-range?backup_id=${backupId}&database_type=${databaseType}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
    let nextRestoreInstanceId = selectedRestoreInstanceId;
    if (
      targetKind === 'restore_instance' &&
      selectedRestoreInstanceId &&
      !restoreInstances.some((instance) => instance.id === selectedRestoreInstanceId && instance.database_type === backup.database_type)
    ) {
      setSelectedRestoreInstanceId(null);
      nextRestoreInstanceId = null;
    }
    await syncRestoreTargetWarning(backup, targetKind, nextRestoreInstanceId);
    await validateBackup(backup.id, backup.database_type);
    if (restoreType === 'pitr') {
      await fetchPITRTimeRange(backup.id, backup.database_type);
    }
  };

  const handleTargetKindChange = async (value: 'original' | 'restore_instance') => {
    setTargetKind(value);
    if (value === 'original') {
      setSelectedRestoreInstanceId(null);
      await syncRestoreTargetWarning(selectedBackup, value, null);
      return;
    }
    await syncRestoreTargetWarning(selectedBackup, value, selectedRestoreInstanceId);
  };

  const handleSelectRestoreInstance = async (value: number) => {
    setSelectedRestoreInstanceId(value);
    await syncRestoreTargetWarning(selectedBackup, 'restore_instance', value);
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
    if (targetKind === 'restore_instance' && !selectedRestoreInstanceId) {
      message.warning('请选择恢复实例');
      return;
    }
    if (restoreType === 'pitr' && !pitrTime) {
      message.warning('请选择PITR恢复时间点');
      return;
    }
    try {
      const restoreData: any = {
        workspace_id: 1,
        database_type: selectedBackup.database_type,
        backup_id: selectedBackup.id,
        backup_before_restore: backupBeforeRestore,
        target_kind: targetKind,
      };
      if (targetKind === 'original') {
        restoreData.database_id = selectedBackup.database_id;
      } else {
        restoreData.target_instance_id = selectedRestoreInstanceId;
      }
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
      resetCreateForm();
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

  const resetCreateForm = () => {
    setSelectedBackup(null);
    setTargetKind('original');
    setSelectedRestoreInstanceId(null);
    setPitrTime(null);
    setPitrTimeRange(null);
    setIsOriginalInstance(false);
    setWarningMessage('');
    setConfirmRestore(false);
    setPendingRestoreData(null);
    setBackupValid(null);
  };

  const openCreateInstanceModal = () => {
    setInstanceModalMode('create');
    setEditingInstance(null);
    instanceForm.resetFields();
    instanceForm.setFieldsValue({ database_type: 'mysql', port: 3306 });
    setInstanceModalVisible(true);
  };

  const openEditInstanceModal = (instance: RestoreInstance) => {
    setInstanceModalMode('edit');
    setEditingInstance(instance);
    instanceForm.setFieldsValue({
      ...instance,
      password: '',
    });
    setInstanceModalVisible(true);
  };

  const handleRestoreInstanceTypeChange = (value: 'mysql' | 'postgresql') => {
    instanceForm.setFieldValue('database_type', value);
    instanceForm.setFieldValue('port', value === 'mysql' ? 3306 : 5432);
    instanceForm.setFieldValue('engine_version', value === 'mysql' ? '8.0' : '16');
  };

  const handleTestRestoreInstance = async () => {
    try {
      const values = await instanceForm.validateFields();
      if (!values.password && instanceModalMode === 'edit') {
        message.warning('编辑模式下测试连接需要重新输入密码');
        return;
      }
      setTestingInstanceConnection(true);
      await restoreInstanceAPI.test({
        database_type: values.database_type,
        host: values.host,
        port: values.port,
        user: values.user,
        password: values.password || '',
        database_name: values.database_name,
      });
      message.success('恢复实例连接测试成功');
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.response?.data?.error || '恢复实例连接测试失败');
    } finally {
      setTestingInstanceConnection(false);
    }
  };

  const handleSubmitRestoreInstance = async () => {
    try {
      const values = await instanceForm.validateFields();
      if (instanceModalMode === 'create') {
        await restoreInstanceAPI.create({ ...values, workspace_id: 1 });
        message.success('恢复实例创建成功');
      } else if (editingInstance) {
        await restoreInstanceAPI.update(editingInstance.id, values);
        message.success('恢复实例更新成功');
      }
      setInstanceModalVisible(false);
      setEditingInstance(null);
      instanceForm.resetFields();
      fetchRestoreInstances();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.response?.data?.error || '保存恢复实例失败');
    }
  };

  const handleDeleteRestoreInstance = async (instance: RestoreInstance) => {
    try {
      await restoreInstanceAPI.delete(instance.id);
      message.success('恢复实例已删除');
      if (selectedRestoreInstanceId === instance.id) {
        setSelectedRestoreInstanceId(null);
      }
      fetchRestoreInstances();
    } catch (error) {
      message.error('删除恢复实例失败');
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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      message.success('恢复任务已取消');
      fetchRestores();
    } catch (error) {
      message.error('取消恢复任务失败');
    }
  };

  const getStatusConfig = (status: string) => {
    const configMap: Record<string, { color: string; icon: any; text: string; tagColor: string }> = {
      pending: { color: 'var(--color-warning)', icon: Clock, text: '等待中', tagColor: 'orange' },
      running: { color: 'var(--color-primary)', icon: Loader, text: '执行中', tagColor: 'processing' },
      success: { color: 'var(--color-success)', icon: CheckCircle, text: '成功', tagColor: 'success' },
      failed: { color: 'var(--color-danger)', icon: XCircle, text: '失败', tagColor: 'error' },
      cancelled: { color: 'var(--color-text-tertiary)', icon: Ban, text: '已取消', tagColor: 'default' },
    };
    return configMap[status] || { color: 'var(--color-text-tertiary)', icon: Clock, text: status, tagColor: 'default' };
  };

  const getRestoreTypeConfig = (type: string) => {
    const configMap: Record<string, { color: string; text: string }> = {
      full: { color: 'cyan', text: '全量恢复' },
      incremental: { color: 'blue', text: '增量恢复' },
      pitr: { color: 'purple', text: '时间点恢复' },
    };
    return configMap[type] || { color: 'default', text: type };
  };

  const formatDataSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
  };

  const stats: Stats = useMemo(() => ({
    total: restores.length,
    success: restores.filter(r => r.status === 'success').length,
    failed: restores.filter(r => r.status === 'failed').length,
    running: restores.filter(r => r.status === 'running' || r.status === 'pending').length,
  }), [restores]);

  const filteredRecords = useMemo(() => {
    return restores.filter(record => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!record.name?.toLowerCase().includes(s) &&
            !record.source?.toLowerCase().includes(s) &&
            !record.target?.toLowerCase().includes(s) &&
            !record.operator?.toLowerCase().includes(s)) {
          return false;
        }
      }
      if (filters.status && record.status !== filters.status) return false;
      if (filters.restore_type && record.restore_type !== filters.restore_type) return false;
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const d = dayjs(record.created_at);
        if (!d.isAfter(filters.dateRange[0]) || !d.isBefore(filters.dateRange[1].add(1, 'day'))) return false;
      }
      return true;
    });
  }, [restores, filters]);

  const filteredRestoreInstances = useMemo(() => {
    if (!selectedBackup) {
      return restoreInstances;
    }
    return restoreInstances.filter((instance) => instance.database_type === selectedBackup.database_type);
  }, [restoreInstances, selectedBackup]);

  const handleViewDetail = (record: RestoreRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const handleResetFilters = () => {
    setFilters({ search: '', status: null, restore_type: null, dateRange: null });
  };

  const fetchRecords = fetchRestores;

  const taskColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: number) => <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>#{id}</span> },
    { title: '数据库', dataIndex: 'database_id', key: 'database_id', width: 150, render: (id: number) => <span className="font-medium">DB-{id}</span> },
    { title: '类型', dataIndex: 'database_type', key: 'database_type', width: 120, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{type === 'mysql' ? 'MySQL' : 'PostgreSQL'}</Tag> },
    { title: '恢复类型', key: 'restore_type', width: 140, render: (_: any, record: RestoreRecord) => <Tag color={record.pitr_time ? 'purple' : 'cyan'}>{record.pitr_time ? '时间点恢复' : '全量恢复'}</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 180,
      render: (status: string, record: RestoreRecord) => {
        const config = getStatusConfig(status);
        const progress = progressMap[record.id]?.progress || record.progress || 0;
        const progressMsg = progressMap[record.id]?.message;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <config.icon size={14} style={{ color: config.color, animation: status === 'running' ? 'spin 1s linear infinite' : 'none' }} />
              <span style={{ color: config.color, fontWeight: 500 }}>{config.text}</span>
            </div>
            {status === 'running' && progress > 0 && <Progress percent={Math.round(progress)} size="small" strokeColor="var(--color-primary)" trailColor="var(--color-bg-hover)" format={(p) => `${p}%`} />}
            {progressMsg && status === 'running' && <span className="text-xs text-secondary">{progressMsg}</span>}
          </div>
        );
      }
    },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => <span className="text-sm text-secondary">{new Date(time).toLocaleString()}</span> },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: RestoreRecord) => (
        <Space>
          {(record.status === 'pending' || record.status === 'running') && (
            <Tooltip title="取消恢复">
              <Button type="text" icon={<Ban size={14} />} onClick={() => handleCancelRestore(record.id)} danger />
            </Tooltip>
          )}
          <Tooltip title="查看详情">
            <Button type="text" icon={<Info size={14} />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  const recordColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id: number) => <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>#{id}</span> },
    { title: '恢复名称', dataIndex: 'name', key: 'name', width: 200, render: (name: string) => <span className="font-medium">{name}</span> },
    { title: '存储名称', dataIndex: 'storage_name', key: 'storage_name', width: 150, render: (name: string) => <Space><Database size={14} style={{ color: 'var(--color-text-secondary)' }} /><span>{name}</span></Space> },
    { title: '恢复类型', dataIndex: 'restore_type', key: 'restore_type', width: 120, render: (type: string) => { const c = getRestoreTypeConfig(type); return <Tag color={c.color}>{c.text}</Tag>; } },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (status: string) => { const c = getStatusConfig(status); return <Tag icon={<c.icon size={12} />} color={c.tagColor}>{c.text}</Tag>; } },
    { title: '数据量', dataIndex: 'data_size', key: 'data_size', width: 120, render: (size: number) => <span className="text-sm">{formatDataSize(size)}</span> },
    { title: '耗时', dataIndex: 'duration', key: 'duration', width: 100, render: (duration: number) => <Space><Timer size={14} style={{ color: 'var(--color-text-secondary)' }} /><span className="text-sm">{formatDuration(duration)}</span></Space> },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100, render: (operator: string) => <span className="text-sm text-secondary">{operator || '-'}</span> },
    { title: '恢复时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (time: string) => <span className="text-sm text-secondary">{new Date(time).toLocaleString('zh-CN')}</span> },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: RestoreRecord) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="text" icon={<Info size={14} />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  const restoreInstanceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (name: string) => <span className="font-medium">{name}</span> },
    { title: '类型', dataIndex: 'database_type', key: 'database_type', width: 120, render: (type: string) => <Tag color={type === 'mysql' ? 'blue' : 'green'}>{type === 'mysql' ? 'MySQL' : 'PostgreSQL'}</Tag> },
    { title: '连接地址', key: 'host', render: (_: any, record: RestoreInstance) => <span className="text-sm text-secondary">{record.host}:{record.port}</span> },
    { title: '数据库名', dataIndex: 'database_name', key: 'database_name' },
    { title: '用户名', dataIndex: 'user', key: 'user' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: RestoreInstance) => (
        <Space>
          <Tooltip title="编辑恢复实例">
            <Button type="text" icon={<Edit2 size={14} />} onClick={() => openEditInstanceModal(record)} />
          </Tooltip>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<TestTube size={14} />}
              onClick={async () => {
                instanceForm.setFieldsValue({ ...record, password: '' });
                openEditInstanceModal(record);
              }}
            />
          </Tooltip>
          <Tooltip title="删除恢复实例">
            <Button
              type="text"
              danger
              icon={<Trash2 size={14} />}
              onClick={() =>
                Modal.confirm({
                  title: '删除恢复实例',
                  content: `确定删除恢复实例“${record.name}”吗？`,
                  okText: '删除',
                  okButtonProps: { danger: true },
                  cancelText: '取消',
                  onOk: () => handleDeleteRestoreInstance(record),
                })
              }
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'tasks',
      label: <span className="flex items-center gap-2"><RotateCcw size={16} />恢复任务</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">恢复任务管理</h3>
              <p className="text-sm text-secondary">创建和管理数据库恢复任务</p>
            </div>
            <Space>
              <Button icon={<RefreshCw size={16} />} onClick={fetchRestores}>刷新</Button>
              <Button type="primary" icon={<RotateCcw size={16} />} onClick={() => setCreateModalVisible(true)}>创建恢复任务</Button>
            </Space>
          </div>
          <Table columns={taskColumns} dataSource={restores} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
        </div>
      )
    },
    {
      key: 'records',
      label: <span className="flex items-center gap-2"><History size={16} />恢复记录</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">恢复历史记录</h3>
              <p className="text-sm text-secondary">查看所有恢复操作的历史记录和统计信息</p>
            </div>
            <Space>
              <Button icon={<RefreshCw size={16} />} onClick={fetchRecords}>刷新</Button>
            </Space>
          </div>

          <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
            <Col xs={12} sm={6}>
              <Card size="small" loading={loading}>
                <Statistic title="总记录数" value={stats.total} prefix={<FileText size={16} />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" loading={loading}>
                <Statistic title="成功" value={stats.success} valueStyle={{ color: 'var(--color-success)' }} prefix={<CheckCircle size={16} />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" loading={loading}>
                <Statistic title="失败" value={stats.failed} valueStyle={{ color: 'var(--color-danger)' }} prefix={<XCircle size={16} />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" loading={loading}>
                <Statistic title="执行中" value={stats.running} valueStyle={{ color: 'var(--color-primary)' }} prefix={<Loader size={16} />} />
              </Card>
            </Col>
          </Row>

          <Card size="small" style={{ marginBottom: '16px' }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Input placeholder="搜索恢复名称、源、目标..." prefix={<Search size={14} />} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} allowClear />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select placeholder="状态" style={{ width: '100%' }} value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} allowClear options={[
                  { label: '等待中', value: 'pending' },
                  { label: '执行中', value: 'running' },
                  { label: '成功', value: 'success' },
                  { label: '失败', value: 'failed' },
                  { label: '已取消', value: 'cancelled' },
                ]} />
              </Col>
              <Col xs={12} sm={6} md={4}>
                <Select placeholder="恢复类型" style={{ width: '100%' }} value={filters.restore_type} onChange={(value) => setFilters({ ...filters, restore_type: value })} allowClear options={[
                  { label: '全量恢复', value: 'full' },
                  { label: '增量恢复', value: 'incremental' },
                  { label: '时间点恢复', value: 'pitr' },
                ]} />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <DatePicker.RangePicker style={{ width: '100%' }} value={filters.dateRange} onChange={(dates) => setFilters({ ...filters, dateRange: dates })} placeholder={['开始日期', '结束日期']} />
              </Col>
            </Row>
            {(filters.search || filters.status || filters.restore_type || filters.dateRange) && (
              <Button type="link" size="small" onClick={handleResetFilters} style={{ marginTop: '8px', padding: 0 }}>重置筛选</Button>
            )}
          </Card>

          <Table columns={recordColumns} dataSource={filteredRecords} rowKey="id" loading={loading} pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条记录` }} scroll={{ x: 1200 }} />
        </div>
      )
    },
    {
      key: 'instances',
      label: <span className="flex items-center gap-2"><Server size={16} />恢复实例</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">恢复实例管理</h3>
              <p className="text-sm text-secondary">维护可用于 PITR 恢复的目标实例，仅包含连接设置与连接测试</p>
            </div>
            <Space>
              <Button icon={<RefreshCw size={16} />} onClick={fetchRestoreInstances}>刷新</Button>
              <Button type="primary" icon={<Plus size={16} />} onClick={openCreateInstanceModal}>新增恢复实例</Button>
            </Space>
          </div>
          <Table
            columns={restoreInstanceColumns}
            dataSource={restoreInstances}
            rowKey="id"
            loading={instanceLoading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      )
    }
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">恢复管理</h1>
        <p className="page-description">数据库时间点恢复（PITR）与恢复记录管理</p>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal
        title="创建恢复任务"
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); resetCreateForm(); }}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalVisible(false)}>取消</Button>,
          <Button
            key="create"
            type="primary"
            onClick={handleCreateRestore}
            disabled={!selectedBackup || (targetKind === 'restore_instance' && !selectedRestoreInstanceId) || (restoreType === 'pitr' && !pitrTime)}
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
          {validatingBackup && <div className="mt-2 text-sm text-secondary">正在验证备份文件...</div>}
          {backupValid === true && <div className="mt-2 text-sm text-success flex items-center gap-1"><CheckCircle size={14} /> 备份文件验证通过</div>}
          {backupValid === false && <div className="mt-2 text-sm text-danger flex items-center gap-1"><XCircle size={14} /> 备份文件验证失败</div>}
        </div>

        <div className="mb-6">
          <label className="form-label">恢复目标</label>
          <Select
            className="w-full"
            value={targetKind}
            onChange={handleTargetKindChange}
            options={[
              { label: '恢复到原实例', value: 'original' },
              { label: '恢复到恢复实例', value: 'restore_instance' },
            ]}
          />
          <div className="mt-2 text-xs text-secondary">
            {targetKind === 'original'
              ? '将恢复到备份文件所属的原数据库实例，系统会进行风险提醒。'
              : '将恢复到你维护的恢复实例，不会触发原实例覆盖提醒。'}
          </div>
        </div>

        {targetKind === 'restore_instance' && (
          <div className="mb-6">
            <label className="form-label">选择恢复实例</label>
            <Select
              className="w-full"
              placeholder={selectedBackup ? '请选择与备份类型一致的恢复实例' : '请先选择备份'}
              value={selectedRestoreInstanceId ?? undefined}
              onChange={handleSelectRestoreInstance}
              disabled={!selectedBackup}
              options={filteredRestoreInstances.map((instance) => ({
                label: `${instance.name} (${instance.host}:${instance.port}/${instance.database_name})`,
                value: instance.id,
              }))}
            />
            <div className="mt-2 flex justify-between items-center">
              <span className="text-xs text-secondary">仅展示与当前备份数据库类型一致的恢复实例</span>
              <Button type="link" size="small" onClick={() => { setActiveTab('instances'); openCreateInstanceModal(); }}>没有合适实例？立即新增</Button>
            </div>
          </div>
        )}

        {isOriginalInstance && warningMessage && (
          <Alert type="warning" message="危险操作警告" description={warningMessage} icon={<AlertTriangle size={20} />} showIcon className="mb-4" />
        )}

        <div className="mb-6">
          <label className="form-label">恢复类型</label>
          <Select className="w-full" value={restoreType} onChange={handleRestoreTypeChange} options={[
            { label: '全量恢复', value: 'full' },
            { label: '时间点恢复 (PITR)', value: 'pitr' }
          ]} />
        </div>

        {restoreType === 'pitr' && (
          <div className="mb-6">
            <label className="form-label">选择时间点</label>
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-secondary" />
              <span className="text-xs text-secondary">
                可恢复时间范围: {pitrTimeRange ? `${new Date(pitrTimeRange.backup_time).toLocaleString()} 至 ${new Date(pitrTimeRange.max_time).toLocaleString()}` : '加载中...'}
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
            <input type="checkbox" checked={backupBeforeRestore} onChange={(e) => setBackupBeforeRestore(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">恢复前先备份当前数据（推荐）</span>
          </label>
        </div>

        <div className={`${targetKind === 'original' ? 'bg-danger' : 'bg-info'} bg-opacity-10 p-4 rounded-lg border ${targetKind === 'original' ? 'border-danger' : 'border-info'} border-opacity-20`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className={`${targetKind === 'original' ? 'text-danger' : 'text-info'} flex-shrink-0 mt-0.5`} />
            <div>
              <p className={`text-sm font-semibold ${targetKind === 'original' ? 'text-danger' : 'text-info'} mb-1`}>
                {targetKind === 'original' ? '风险提示' : '目标实例说明'}
              </p>
              <p className="text-sm text-secondary">
                {targetKind === 'original'
                  ? '恢复操作将覆盖当前数据库内容，此操作不可逆。请谨慎操作。'
                  : '恢复将写入所选恢复实例，不会覆盖备份源原实例，但仍建议确认目标实例为空闲或可覆盖。'}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={instanceModalMode === 'create' ? '新增恢复实例' : `编辑恢复实例：${editingInstance?.name || ''}`}
        open={instanceModalVisible}
        onCancel={() => {
          setInstanceModalVisible(false);
          setEditingInstance(null);
          instanceForm.resetFields();
        }}
        onOk={handleSubmitRestoreInstance}
        okText={instanceModalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
        width={620}
        footer={[
          <Button key="test" icon={<TestTube size={14} />} loading={testingInstanceConnection} onClick={handleTestRestoreInstance}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => {
            setInstanceModalVisible(false);
            setEditingInstance(null);
            instanceForm.resetFields();
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmitRestoreInstance}>
            {instanceModalMode === 'create' ? '创建' : '保存'}
          </Button>,
        ]}
      >
        <Form form={instanceForm} layout="vertical" initialValues={{ database_type: 'mysql', port: 3306, engine_version: '8.0' }}>
          <Form.Item name="name" label="实例名称" rules={[{ required: true, message: '请输入实例名称' }]}>
            <Input placeholder="例如：MySQL恢复实例A" />
          </Form.Item>
          <Form.Item name="database_type" label="数据库类型" rules={[{ required: true, message: '请选择数据库类型' }]}>
            <Select
              onChange={handleRestoreInstanceTypeChange}
              options={[
                { label: 'MySQL', value: 'mysql' },
                { label: 'PostgreSQL', value: 'postgresql' },
              ]}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]}>
                <Input placeholder="127.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="user" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="root" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={instanceModalMode === 'create' ? [{ required: true, message: '请输入密码' }] : []}
                extra={instanceModalMode === 'edit' ? '留空表示保持原密码不变；测试连接时需重新输入密码' : undefined}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="database_name" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
                <Input placeholder="target_db" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="engine_version" label="版本">
                <Input placeholder="8.0 / 16" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="确认恢复操作"
        open={confirmModalVisible}
        onCancel={() => { setConfirmModalVisible(false); setConfirmRestore(false); setPendingRestoreData(null); }}
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
              <p className="text-sm text-secondary">勾选"恢复前先备份当前数据"选项，系统会在恢复前自动创建当前数据的备份。</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} className="w-4 h-4" id="confirmRestore" />
          <label htmlFor="confirmRestore" className="text-sm cursor-pointer">我已了解恢复操作的风险，确认要继续执行恢复</label>
        </div>
      </Modal>

      <Modal
        title={<Space><RotateCcw size={18} /><span>恢复记录详情</span></Space>}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedRecord(null); }}
        footer={[<Button key="close" onClick={() => { setDetailModalVisible(false); setSelectedRecord(null); }}>关闭</Button>]}
        width={700}
      >
        {selectedRecord && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card size="small" title="基本信息">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="记录ID"><span className="font-mono">#{selectedRecord.id}</span></Descriptions.Item>
                    <Descriptions.Item label="恢复名称">{selectedRecord.name}</Descriptions.Item>
                    <Descriptions.Item label="存储名称">{selectedRecord.storage_name}</Descriptions.Item>
                    <Descriptions.Item label="恢复类型"><Tag color={getRestoreTypeConfig(selectedRecord.restore_type || '').color}>{getRestoreTypeConfig(selectedRecord.restore_type || '').text}</Tag></Descriptions.Item>
                    <Descriptions.Item label="状态"><Tag color={getStatusConfig(selectedRecord.status).tagColor}>{getStatusConfig(selectedRecord.status).text}</Tag></Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="性能指标">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="数据量">{formatDataSize(selectedRecord.data_size || 0)}</Descriptions.Item>
                    <Descriptions.Item label="恢复耗时">{formatDuration(selectedRecord.duration || 0)}</Descriptions.Item>
                    <Descriptions.Item label="操作人">{selectedRecord.operator || '-'}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{new Date(selectedRecord.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="恢复详情" style={{ marginBottom: '16px' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="恢复源"><Space><Download size={14} />{selectedRecord.source || '-'}</Space></Descriptions.Item>
                <Descriptions.Item label="恢复目标"><Space><Server size={14} />{selectedRecord.target || '-'}</Space></Descriptions.Item>
                {selectedRecord.started_at && <Descriptions.Item label="开始时间">{new Date(selectedRecord.started_at).toLocaleString('zh-CN')}</Descriptions.Item>}
                {selectedRecord.completed_at && <Descriptions.Item label="完成时间">{new Date(selectedRecord.completed_at).toLocaleString('zh-CN')}</Descriptions.Item>}
              </Descriptions>
            </Card>

            {selectedRecord.error_msg && (
              <Card size="small" title="错误信息" style={{ background: 'var(--color-danger-bg)' }}>
                <Space><AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} /><span style={{ color: 'var(--color-danger)' }}>{selectedRecord.error_msg}</span></Space>
              </Card>
            )}
          </div>
        )}
      </Modal>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
