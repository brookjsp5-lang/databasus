import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space, Switch, Card } from 'antd';
import { Plus, Edit2, Trash2, Clock, Database } from 'lucide-react';

interface BackupConfig {
  id: number;
  workspace_id: number;
  database_id: number;
  database_type: string;
  backup_type: string;
  cron_expression: string;
  retention_days: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const backupTypeLabels: Record<string, string> = {
  full: '全量备份',
  incremental: '增量备份',
  physical: '物理备份',
};

const databaseTypeLabels: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

const scheduleTypeLabels: Record<string, string> = {
  hourly: '每小时',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  cron: '自定义Cron',
};

export const BackupConfigs: React.FC = () => {
  const [configs, setConfigs] = useState<BackupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BackupConfig | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/backup-configs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch backup configs:', error);
      message.error('获取备份配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const response = await fetch('http://localhost:6001/api/backup-configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('备份配置创建成功');
        setModalOpen(false);
        form.resetFields();
        fetchConfigs();
      } else {
        const data = await response.json();
        message.error(data.error || '创建失败');
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingConfig) return;
    try {
      const response = await fetch(`http://localhost:6001/api/backup-configs/${editingConfig.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('备份配置更新成功');
        setModalOpen(false);
        setEditingConfig(null);
        form.resetFields();
        fetchConfigs();
      } else {
        const data = await response.json();
        message.error(data.error || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:6001/api/backup-configs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('备份配置已删除');
        fetchConfigs();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      const config = configs.find(c => c.id === id);
      if (!config) return;
      const response = await fetch(`http://localhost:6001/api/backup-configs/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...config, is_enabled: enabled })
      });
      if (response.ok) {
        message.success(`备份配置已${enabled ? '启用' : '禁用'}`);
        fetchConfigs();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const openEditModal = (config: BackupConfig) => {
    setEditingConfig(config);
    form.setFieldsValue(config);
    setModalOpen(true);
  };

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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '数据库类型',
      dataIndex: 'database_type',
      key: 'database_type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === 'mysql' ? 'blue' : 'green'}>
          {databaseTypeLabels[type] || type}
        </Tag>
      ),
    },
    {
      title: '备份类型',
      dataIndex: 'backup_type',
      key: 'backup_type',
      width: 120,
      render: (type: string) => (
        <Tag>
          {backupTypeLabels[type] || type}
        </Tag>
      ),
    },
    {
      title: '调度表达式',
      dataIndex: 'cron_expression',
      key: 'cron_expression',
      render: (cron: string) => (
        <Space>
          <Clock size={14} />
          {getCronDescription(cron)}
        </Space>
      ),
    },
    {
      title: '保留天数',
      dataIndex: 'retention_days',
      key: 'retention_days',
      width: 100,
      render: (days: number) => `${days} 天`,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled: boolean, record: BackupConfig) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: BackupConfig) => (
        <Space>
          <Button
            type="text"
            icon={<Edit2 size={16} />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确定删除此备份配置？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<Trash2 size={16} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">备份配置</h1>
          <p className="page-description">配置自动备份计划和保留策略</p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setEditingConfig(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          创建备份配置
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingConfig ? '编辑备份配置' : '创建备份配置'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingConfig(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          onFinish={editingConfig ? handleUpdate : handleCreate}
          layout="vertical"
          initialValues={{
            workspace_id: 1,
            is_enabled: true,
            retention_days: 7,
            backup_type: 'full',
          }}
        >
          <Form.Item
            name="database_type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select placeholder="请选择数据库类型">
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="database_id"
            label="数据库ID"
            rules={[{ required: true, message: '请输入数据库ID' }]}
          >
            <Input type="number" placeholder="请输入数据库ID" />
          </Form.Item>

          <Form.Item
            name="backup_type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
          >
            <Select placeholder="请选择备份类型">
              <Select.Option value="full">全量备份</Select.Option>
              <Select.Option value="incremental">增量备份</Select.Option>
              <Select.Option value="physical">物理备份</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="schedule_type"
            label="调度类型"
            rules={[{ required: true, message: '请选择调度类型' }]}
          >
            <Select placeholder="请选择调度类型">
              <Select.Option value="hourly">每小时</Select.Option>
              <Select.Option value="daily">每天</Select.Option>
              <Select.Option value="weekly">每周</Select.Option>
              <Select.Option value="monthly">每月</Select.Option>
              <Select.Option value="cron">自定义Cron</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule_type !== curr.schedule_type}>
            {() => {
              const scheduleType = form.getFieldValue('schedule_type');
              let cronExpression = '';
              if (scheduleType === 'hourly') cronExpression = '0 * * * *';
              else if (scheduleType === 'daily') cronExpression = '0 0 * * *';
              else if (scheduleType === 'weekly') cronExpression = '0 0 * * 0';
              else if (scheduleType === 'monthly') cronExpression = '0 0 1 * *';
              return (
                <Form.Item
                  name="cron_expression"
                  label="Cron表达式"
                  rules={[{ required: true, message: '请输入Cron表达式' }]}
                  initialValue={cronExpression}
                >
                  <Input placeholder="0 0 * * *" />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="retention_days"
            label="保留天数"
            rules={[{ required: true, message: '请输入保留天数' }]}
          >
            <Input type="number" placeholder="7" min={1} />
          </Form.Item>

          <Form.Item
            name="is_enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingConfig ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};