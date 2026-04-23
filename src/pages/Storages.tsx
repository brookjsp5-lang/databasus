import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space, Card } from 'antd';
import { Plus, Edit2, Trash2, HardDrive, Database } from 'lucide-react';

interface Storage {
  id: number;
  name: string;
  type: string;
  config: any;
  created_at: string;
  updated_at: string;
}

const storageTypeLabels: Record<string, string> = {
  local: '本地存储',
  s3: 'S3兼容存储',
  nas: 'NAS存储',
};

const storageTypeColors: Record<string, string> = {
  local: 'green',
  s3: 'blue',
  nas: 'purple',
};

export const Storages: React.FC = () => {
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStorage, setEditingStorage] = useState<Storage | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStorages();
  }, []);

  const fetchStorages = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/storages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStorages(data.storages || []);
      }
    } catch (error) {
      console.error('Failed to fetch storages:', error);
      message.error('获取存储列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const config: any = {};
      if (values.type === 'local') {
        config.path = values.path;
      } else if (values.type === 's3') {
        config.endpoint = values.endpoint;
        config.bucket = values.bucket;
        config.access_key = values.access_key;
        config.secret_key = values.secret_key;
        config.region = values.region || 'us-east-1';
      } else if (values.type === 'nas') {
        config.path = values.path;
        config.host = values.host;
      }

      const response = await fetch('http://localhost:6001/api/storages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...values, config })
      });
      if (response.ok) {
        message.success('存储创建成功');
        setModalOpen(false);
        form.resetFields();
        fetchStorages();
      } else {
        const data = await response.json();
        message.error(data.error || '创建失败');
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingStorage) return;
    try {
      const config: any = {};
      if (values.type === 'local') {
        config.path = values.path;
      } else if (values.type === 's3') {
        config.endpoint = values.endpoint;
        config.bucket = values.bucket;
        config.access_key = values.access_key;
        config.secret_key = values.secret_key;
        config.region = values.region || 'us-east-1';
      } else if (values.type === 'nas') {
        config.path = values.path;
        config.host = values.host;
      }

      const response = await fetch(`http://localhost:6001/api/storages/${editingStorage.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...values, config })
      });
      if (response.ok) {
        message.success('存储更新成功');
        setModalOpen(false);
        setEditingStorage(null);
        form.resetFields();
        fetchStorages();
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
      const response = await fetch(`http://localhost:6001/api/storages/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('存储已删除');
        fetchStorages();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const openEditModal = (storage: Storage) => {
    setEditingStorage(storage);
    form.setFieldsValue({
      name: storage.name,
      type: storage.type,
      ...storage.config,
    });
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={storageTypeColors[type] || 'default'}>
          {storageTypeLabels[type] || type}
        </Tag>
      ),
    },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      render: (config: any) => {
        if (!config) return '-';
        if (config.path) return `路径: ${config.path}`;
        if (config.endpoint && config.bucket) return `${config.endpoint}/${config.bucket}`;
        return '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Storage) => (
        <Space>
          <Button
            type="text"
            icon={<Edit2 size={16} />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="确定删除此存储？"
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
          <h1 className="page-title">存储管理</h1>
          <p className="page-description">配置备份存储目的地</p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setEditingStorage(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          添加存储
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={storages}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingStorage ? '编辑存储' : '添加存储'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingStorage(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          onFinish={editingStorage ? handleUpdate : handleCreate}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="存储名称"
            rules={[{ required: true, message: '请输入存储名称' }]}
          >
            <Input placeholder="请输入存储名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="存储类型"
            rules={[{ required: true, message: '请选择存储类型' }]}
          >
            <Select
              placeholder="请选择存储类型"
              onChange={() => form.resetFields(['path', 'endpoint', 'bucket', 'access_key', 'secret_key', 'region', 'host'])}
            >
              <Select.Option value="local">本地存储</Select.Option>
              <Select.Option value="s3">S3兼容存储</Select.Option>
              <Select.Option value="nas">NAS存储</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {() => {
              const type = form.getFieldValue('type');
              if (type === 'local') {
                return (
                  <Form.Item name="path" label="存储路径" rules={[{ required: true, message: '请输入存储路径' }]}>
                    <Input placeholder="/data/backups" />
                  </Form.Item>
                );
              }
              if (type === 's3') {
                return (
                  <>
                    <Form.Item name="endpoint" label="S3端点" rules={[{ required: true, message: '请输入S3端点' }]}>
                      <Input placeholder="https://s3.amazonaws.com" />
                    </Form.Item>
                    <Form.Item name="bucket" label="存储桶名称" rules={[{ required: true, message: '请输入存储桶名称' }]}>
                      <Input placeholder="my-backup-bucket" />
                    </Form.Item>
                    <Form.Item name="region" label="区域" initialValue="us-east-1">
                      <Input placeholder="us-east-1" />
                    </Form.Item>
                    <Form.Item name="access_key" label="访问密钥" rules={[{ required: true, message: '请输入访问密钥' }]}>
                      <Input placeholder="AKIAIOSFODNN7EXAMPLE" />
                    </Form.Item>
                    <Form.Item name="secret_key" label="秘密密钥" rules={[{ required: true, message: '请输入秘密密钥' }]}>
                      <Input.Password placeholder="请输入秘密密钥" />
                    </Form.Item>
                  </>
                );
              }
              if (type === 'nas') {
                return (
                  <>
                    <Form.Item name="host" label="NAS主机" rules={[{ required: true, message: '请输入NAS主机地址' }]}>
                      <Input placeholder="192.168.1.100" />
                    </Form.Item>
                    <Form.Item name="path" label="共享路径" rules={[{ required: true, message: '请输入共享路径' }]}>
                      <Input placeholder="/shared/backups" />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingStorage ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};