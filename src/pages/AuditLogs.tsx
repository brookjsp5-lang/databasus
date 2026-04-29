/**
 * AuditLogs - 审计日志页面组件
 * 
 * @description 提供系统审计日志功能：
 * - 查看用户操作日志
 * - 按时间和操作类型筛选
 * - 操作详情查看
 * - 导出审计日志
 * 
 * @module pages/AuditLogs
 * @requires React
 * @requires antd (Table, DatePicker, Select, Tag等)
 * @requires lucide-react (图标)
 */

import React, { useEffect, useState } from 'react';
import { Table, DatePicker, Select, Tag, Space, Card } from 'antd';
import { User, Clock } from 'lucide-react';

const { RangePicker } = DatePicker;

/**
 * 审计日志记录接口
 * @description 定义用户操作的审计日志
 */
interface AuditLog {
  /** 日志ID */
  id: number;
  /** 用户ID */
  user_id: number;
  /** 用户名 */
  username: string;
  /** 操作类型 */
  action: string;
  /** 资源类型 */
  resource: string;
  /** 操作详情 */
  details: string;
  /** IP地址 */
  ip_address: string;
  /** 操作时间 */
  created_at: string;
}

/** 操作类型标签映射 */
const actionLabels: Record<string, string> = {
  login: '登录',
  logout: '登出',
  register: '注册',
  create_database: '创建数据库',
  update_database: '更新数据库',
  delete_database: '删除数据库',
  create_backup: '创建备份',
  delete_backup: '删除备份',
  create_restore: '创建恢复',
  update_settings: '更新设置',
  invite_member: '邀请成员',
  update_member_role: '更新成员角色',
  remove_member: '移除成员',
};

/** 操作类型颜色映射 */
const actionColors: Record<string, string> = {
  login: 'green',
  logout: 'orange',
  register: 'blue',
  create_database: 'cyan',
  update_database: 'gold',
  delete_database: 'red',
  create_backup: 'green',
  delete_backup: 'red',
  create_restore: 'purple',
  update_settings: 'gold',
  invite_member: 'blue',
  update_member_role: 'gold',
  remove_member: 'red',
};

/**
 * 格式化日期时间
 * @description 将ISO日期字符串转换为可读格式
 * @param dateStr - ISO格式的日期字符串
 * @returns 格式化后的日期时间字符串
 */
const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    action: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
  });

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      if (filters.action) params.append('action', filters.action);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setFilters({
        ...filters,
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      });
    } else {
      setFilters({
        ...filters,
        start_date: undefined,
        end_date: undefined,
      });
    }
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <Space>
          <Clock size={14} />
          {formatDateTime(text)}
        </Space>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <Space>
          <User size={14} />
          {username || '系统'}
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => (
        <Tag color={actionColors[action] || 'default'}>
          {actionLabels[action] || action}
        </Tag>
      ),
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 120,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      render: (details: string) => (
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {details || '-'}
        </span>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">审计日志</h1>
        <p className="page-description">查看系统中所有用户的操作记录</p>
      </div>

      <Card className="filter-card" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, action: value })}
            options={Object.entries(actionLabels).map(([key, label]) => ({
              value: key,
              label,
            }))}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
};