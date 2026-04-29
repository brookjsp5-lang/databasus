/**
 * RestoreRecords - 恢复记录页面组件
 *
 * @description 展示存储恢复操作的历史记录：
 * - 恢复记录列表展示
 * - 按时间范围、状态、存储名称筛选
 * - 全局搜索功能
 * - 记录详情查看
 * - 数据量、耗时统计
 *
 * @module pages/RestoreRecords
 * @requires React
 * @requires antd (Table, Button, Modal, Form, Select, DatePicker, Input, Tag, Card, Space, Statistics)
 * @requires lucide-react (图标)
 * @requires services/api (restoreAPI)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Modal, Tag, message, Space, Card, Input, Select, DatePicker, Row, Col, Statistic, Tooltip, Descriptions } from 'antd';
import { RotateCcw, Clock, CheckCircle, XCircle, AlertTriangle, Search, Filter, RefreshCw, Info, Loader, Download, Database, Server, Timer, FileText } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { restoreAPI } from '../services/api';

/**
 * 恢复记录接口
 * @description 定义存储恢复操作的历史记录信息
 */
interface RestoreRecord {
  /** 恢复记录ID */
  id: number;
  /** 工作空间ID */
  workspace_id: number;
  /** 存储ID */
  storage_id: number;
  /** 存储名称 */
  storage_name?: string;
  /** 恢复名称 */
  name: string;
  /** 恢复类型: full | incremental | pitr */
  restore_type: string;
  /** 恢复状态: pending | running | success | failed | cancelled */
  status: string;
  /** 恢复进度 (%) */
  progress?: number;
  /** 恢复源（备份ID或路径） */
  source: string;
  /** 恢复目标 */
  target: string;
  /** 数据量大小 (bytes) */
  data_size?: number;
  /** 恢复耗时 (秒) */
  duration?: number;
  /** 错误信息 */
  error_msg?: string;
  /** 操作人 */
  operator?: string;
  /** 创建时间 */
  created_at: string;
  /** 开始时间 */
  started_at?: string;
  /** 完成时间 */
  completed_at?: string;
}

/**
 * 统计数据接口
 */
interface Stats {
  total: number;
  success: number;
  failed: number;
  running: number;
}

/**
 * 筛选条件接口
 */
interface FilterParams {
  search: string;
  status: string | null;
  restore_type: string | null;
  dateRange: [Dayjs | null, Dayjs | null] | null;
  storage_name: string;
}

/**
 * RestoreRecords 恢复记录组件
 *
 * @description 展示和管理存储恢复记录
 * - 查看所有恢复操作历史
 * - 按条件筛选和搜索
 * - 查看恢复详情
 * - 恢复统计概览
 *
 * @example
 * ```tsx
 * <RestoreRecords />
 * ```
 */
export const RestoreRecords: React.FC = () => {
  /** 恢复记录列表 */
  const [records, setRecords] = useState<RestoreRecord[]>([]);
  /** 加载状态 */
  const [loading, setLoading] = useState(false);
  /** 详情模态框可见性 */
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  /** 选中的记录 */
  const [selectedRecord, setSelectedRecord] = useState<RestoreRecord | null>(null);
  /** 筛选条件 */
  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    status: null,
    restore_type: null,
    dateRange: null,
    storage_name: '',
  });
  /** 详情加载状态 */
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  /** 获取恢复记录列表 */
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await restoreAPI.getAll();
      const restores = (data?.restores || []) as RestoreRecord[];
      setRecords(restores.map((r: any) => ({
        ...r,
        storage_name: r.storage_name || `存储 #${r.storage_id}`,
        operator: r.operator || '系统',
        data_size: r.data_size || r.file_size || 0,
        duration: r.duration || calculateDuration(r.started_at, r.completed_at),
      })));
    } catch (error) {
      console.error('Failed to fetch restore records:', error);
      message.error('获取恢复记录失败');
    } finally {
      setLoading(false);
    }
  };

  /** 计算恢复耗时 */
  const calculateDuration = (started?: string, completed?: string): number => {
    if (!started || !completed) return 0;
    const start = new Date(started).getTime();
    const end = new Date(completed).getTime();
    return Math.round((end - start) / 1000);
  };

  /** 获取统计数据 */
  const stats: Stats = useMemo(() => {
    return {
      total: records.length,
      success: records.filter(r => r.status === 'success').length,
      failed: records.filter(r => r.status === 'failed').length,
      running: records.filter(r => r.status === 'running' || r.status === 'pending').length,
    };
  }, [records]);

  /** 筛选后的记录 */
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !record.name.toLowerCase().includes(searchLower) &&
          !record.source.toLowerCase().includes(searchLower) &&
          !record.target.toLowerCase().includes(searchLower) &&
          !record.operator?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      if (filters.status && record.status !== filters.status) {
        return false;
      }

      if (filters.restore_type && record.restore_type !== filters.restore_type) {
        return false;
      }

      if (filters.storage_name && !record.storage_name?.toLowerCase().includes(filters.storage_name.toLowerCase())) {
        return false;
      }

      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const recordDate = dayjs(record.created_at);
        if (!recordDate.isAfter(filters.dateRange[0]) || !recordDate.isBefore(filters.dateRange[1].add(1, 'day'))) {
          return false;
        }
      }

      return true;
    });
  }, [records, filters]);

  /** 获取状态配置 */
  const getStatusConfig = (status: string) => {
    const configMap: Record<string, { color: string; icon: any; text: string; tagColor: string }> = {
      pending: { color: 'var(--color-warning)', icon: Clock, text: '等待中', tagColor: 'orange' },
      running: { color: 'var(--color-primary)', icon: Loader, text: '执行中', tagColor: 'processing' },
      success: { color: 'var(--color-success)', icon: CheckCircle, text: '成功', tagColor: 'success' },
      failed: { color: 'var(--color-danger)', icon: XCircle, text: '失败', tagColor: 'error' },
      cancelled: { color: 'var(--color-text-tertiary)', icon: AlertTriangle, text: '已取消', tagColor: 'default' },
    };
    return configMap[status] || { color: 'var(--color-text-tertiary)', icon: Clock, text: status, tagColor: 'default' };
  };

  /** 获取恢复类型配置 */
  const getRestoreTypeConfig = (type: string) => {
    const configMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: '全量恢复' },
      incremental: { color: 'cyan', text: '增量恢复' },
      pitr: { color: 'purple', text: '时间点恢复' },
    };
    return configMap[type] || { color: 'default', text: type };
  };

  /** 格式化数据大小 */
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

  /** 格式化耗时 */
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
  };

  /** 查看详情 */
  const handleViewDetail = async (record: RestoreRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  /** 重置筛选 */
  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: null,
      restore_type: null,
      dateRange: null,
      storage_name: '',
    });
  };

  /** 表格列定义 */
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
      ),
    },
    {
      title: '恢复名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <span className="font-medium">{name}</span>
      ),
    },
    {
      title: '存储名称',
      dataIndex: 'storage_name',
      key: 'storage_name',
      width: 150,
      render: (name: string) => (
        <Space>
          <Database size={14} style={{ color: 'var(--color-text-secondary)' }} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '恢复类型',
      dataIndex: 'restore_type',
      key: 'restore_type',
      width: 120,
      render: (type: string) => {
        const config = getRestoreTypeConfig(type);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const config = getStatusConfig(status);
        return (
          <Tag icon={<config.icon size={12} />} color={config.tagColor}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '数据量',
      dataIndex: 'data_size',
      key: 'data_size',
      width: 120,
      render: (size: number) => (
        <span className="text-sm">{formatDataSize(size)}</span>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => (
        <Space>
          <Timer size={14} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="text-sm">{formatDuration(duration)}</span>
        </Space>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
      render: (operator: string) => (
        <span className="text-sm text-secondary">{operator || '-'}</span>
      ),
    },
    {
      title: '恢复时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <span className="text-sm text-secondary">
          {new Date(time).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: RestoreRecord) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<Info size={14} />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">恢复记录</h1>
          <p className="page-description">查看所有存储恢复操作的历史记录</p>
        </div>
        <Space>
          <Button
            icon={<RefreshCw size={16} />}
            onClick={fetchRecords}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="总记录数"
              value={stats.total}
              prefix={<FileText size={16} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="成功"
              value={stats.success}
              valueStyle={{ color: 'var(--color-success)' }}
              prefix={<CheckCircle size={16} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: 'var(--color-danger)' }}
              prefix={<XCircle size={16} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="执行中"
              value={stats.running}
              valueStyle={{ color: 'var(--color-primary)' }}
              prefix={<Loader size={16} />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索恢复名称、源、目标..."
              prefix={<Search size={14} />}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="状态"
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              allowClear
              options={[
                { label: '等待中', value: 'pending' },
                { label: '执行中', value: 'running' },
                { label: '成功', value: 'success' },
                { label: '失败', value: 'failed' },
                { label: '已取消', value: 'cancelled' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="恢复类型"
              style={{ width: '100%' }}
              value={filters.restore_type}
              onChange={(value) => setFilters({ ...filters, restore_type: value })}
              allowClear
              options={[
                { label: '全量恢复', value: 'full' },
                { label: '增量恢复', value: 'incremental' },
                { label: '时间点恢复', value: 'pitr' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="存储名称"
              prefix={<Database size={14} />}
              value={filters.storage_name}
              onChange={(e) => setFilters({ ...filters, storage_name: e.target.value })}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
        </Row>
        {(filters.search || filters.status || filters.restore_type || filters.storage_name || filters.dateRange) && (
          <Button
            type="link"
            size="small"
            onClick={handleResetFilters}
            style={{ marginTop: '8px', padding: 0 }}
          >
            重置筛选
          </Button>
        )}
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <RotateCcw size={18} />
            <span>恢复记录详情</span>
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedRecord(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailModalVisible(false);
              setSelectedRecord(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedRecord && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col span={12}>
                <Card size="small" title="基本信息">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="记录ID">
                      <span className="font-mono">#{selectedRecord.id}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="恢复名称">{selectedRecord.name}</Descriptions.Item>
                    <Descriptions.Item label="存储名称">{selectedRecord.storage_name}</Descriptions.Item>
                    <Descriptions.Item label="恢复类型">
                      <Tag color={getRestoreTypeConfig(selectedRecord.restore_type).color}>
                        {getRestoreTypeConfig(selectedRecord.restore_type).text}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={getStatusConfig(selectedRecord.status).tagColor}>
                        {getStatusConfig(selectedRecord.status).text}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="性能指标">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="数据量">
                      {formatDataSize(selectedRecord.data_size || 0)}
                    </Descriptions.Item>
                    <Descriptions.Item label="恢复耗时">
                      {formatDuration(selectedRecord.duration || 0)}
                    </Descriptions.Item>
                    <Descriptions.Item label="操作人">
                      {selectedRecord.operator || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {new Date(selectedRecord.created_at).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="恢复详情" style={{ marginBottom: '16px' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="恢复源">
                  <Space>
                    <Download size={14} />
                    {selectedRecord.source}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="恢复目标">
                  <Space>
                    <Server size={14} />
                    {selectedRecord.target}
                  </Space>
                </Descriptions.Item>
                {selectedRecord.started_at && (
                  <Descriptions.Item label="开始时间">
                    {new Date(selectedRecord.started_at).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                )}
                {selectedRecord.completed_at && (
                  <Descriptions.Item label="完成时间">
                    {new Date(selectedRecord.completed_at).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {selectedRecord.error_msg && (
              <Card size="small" title="错误信息" style={{ background: 'var(--color-danger-bg)' }}>
                <Space>
                  <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                  <span style={{ color: 'var(--color-danger)' }}>{selectedRecord.error_msg}</span>
                </Space>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};