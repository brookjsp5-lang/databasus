import React, { useEffect, useState } from 'react';
import { Table, Modal, Form, Input, Switch, message, Select, Space, Button, Tag, Divider, Alert } from 'antd';
import { Plus, Edit, Delete, Database as DatabaseIcon, CheckCircle, XCircle, Info, Wand2 } from 'lucide-react';
import { mysqlDatabaseAPI, postgresqlDatabaseAPI } from '../services/api';
import DatabaseWizard from './DatabaseWizard';

export const Databases: React.FC = () => {
  const [mysqlDatabases, setMySQLDatabases] = useState<any[]>([]);
  const [postgresqlDatabases, setPostgreSQLDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<any>(null);
  const [databaseType, setDatabaseType] = useState<'mysql' | 'postgresql'>('mysql');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const mysqlResponse = await mysqlDatabaseAPI.getAll();
      const postgresqlResponse = await postgresqlDatabaseAPI.getAll();
      setMySQLDatabases(mysqlResponse.databases || []);
      setPostgreSQLDatabases(postgresqlResponse.databases || []);
    } catch (error) {
      message.error('获取数据库列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDatabase(null);
    setDatabaseType('mysql');
    form.resetFields();
    form.setFieldsValue({
      is_physical_backup_supported: false,
      binary_log_enabled: false,
      wal_enabled: false,
    });
    setModalVisible(true);
  };

  const handleEdit = (database: any, type: 'mysql' | 'postgresql') => {
    setEditingDatabase(database);
    setDatabaseType(type);
    form.setFieldsValue({
      name: database.name,
      host: database.host,
      port: database.port,
      user: database.user,
      password: '',
      database_name: database.database_name,
      is_physical_backup_supported: database.is_physical_backup_supported || false,
      binary_log_enabled: database.binary_log_enabled || false,
      binary_log_path: database.binary_log_path || '',
      xtrabackup_path: database.xtrabackup_path || '',
      wal_enabled: database.wal_enabled || false,
      wal_path: database.wal_path || '',
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number, type: 'mysql' | 'postgresql') => {
    try {
      if (type === 'mysql') {
        await mysqlDatabaseAPI.delete(id);
      } else {
        await postgresqlDatabaseAPI.delete(id);
      }
      message.success('删除成功');
      fetchDatabases();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const { database_type, ...submitValues } = values;

      if (editingDatabase) {
        if (databaseType === 'mysql') {
          await mysqlDatabaseAPI.update(editingDatabase.id, submitValues);
        } else {
          await postgresqlDatabaseAPI.update(editingDatabase.id, submitValues);
        }
        message.success('更新成功');
      } else {
        if (databaseType === 'mysql') {
          await mysqlDatabaseAPI.create({ ...submitValues, workspace_id: 1 });
        } else {
          await postgresqlDatabaseAPI.create({ ...submitValues, workspace_id: 1 });
        }
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchDatabases();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const renderStatus = (enabled: boolean) => (
    <div className="status-indicator">
      {enabled ? (
        <>
          <span className="status-dot online"></span>
          <span className="text-sm text-success">启用</span>
        </>
      ) : (
        <>
          <span className="status-dot offline"></span>
          <span className="text-sm text-tertiary">未启用</span>
        </>
      )}
    </div>
  );

  const renderBackupFeatures = (record: any, type: 'mysql' | 'postgresql') => {
    if (type === 'mysql') {
      return (
        <div className="flex gap-2 flex-wrap">
          {record.is_physical_backup_supported && (
            <Tag color="purple">物理备份</Tag>
          )}
          {record.binary_log_enabled && (
            <Tag color="blue">BinLog</Tag>
          )}
          {!record.is_physical_backup_supported && !record.binary_log_enabled && (
            <span className="text-tertiary text-xs">未配置</span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex gap-2 flex-wrap">
          {record.is_physical_backup_supported && (
            <Tag color="purple">物理备份</Tag>
          )}
          {record.wal_enabled && (
            <Tag color="green">WAL</Tag>
          )}
          {!record.is_physical_backup_supported && !record.wal_enabled && (
            <span className="text-tertiary text-xs">未配置</span>
          )}
        </div>
      );
    }
  };

  const databaseColumns = (type: 'mysql' | 'postgresql') => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div className="flex items-center gap-3">
          <div className="database-icon" style={{ background: type === 'mysql' ? 'rgba(59, 89, 152, 0.1)' : 'rgba(51, 103, 145, 0.1)' }}>
            <DatabaseIcon size={16} style={{ color: type === 'mysql' ? '#3b5998' : '#336791' }} />
          </div>
          <span className="font-semibold">{text}</span>
        </div>
      )
    },
    {
      title: '连接信息',
      key: 'connection',
      render: (_: any, record: any) => (
        <span className="font-mono text-sm" style={{ color: 'var(--color-primary)' }}>
          {record.host}:{record.port}
        </span>
      )
    },
    {
      title: '数据库名',
      dataIndex: 'database_name',
      key: 'database_name',
      render: (text: string) => <span className="text-secondary">{text}</span>
    },
    {
      title: '备份功能',
      key: 'backup_features',
      width: 200,
      render: (_: any, record: any) => renderBackupFeatures(record, type)
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: any) => (
        <Space size={8}>
          <Button
            type="text"
            icon={<Edit size={14} />}
            onClick={() => handleEdit(record, type)}
            className="btn-ghost btn-icon"
          />
          <Button
            type="text"
            icon={<Delete size={14} />}
            onClick={() => handleDelete(record.id, type)}
            className="btn-ghost btn-icon"
            danger
          />
        </Space>
      )
    },
  ];

  const currentDatabases = databaseType === 'mysql' ? mysqlDatabases : postgresqlDatabases;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">数据库管理</h1>
          <p className="page-description">管理 MySQL 和 PostgreSQL 数据库连接</p>
        </div>
        <Space>
          <Button
            icon={<Wand2 size={16} />}
            onClick={() => setWizardVisible(true)}
          >
            快速启动
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            添加数据库
          </Button>
        </Space>
      </div>

      <div className="card">
        <div className="flex gap-2 mb-6">
          <Button
            type={databaseType === 'mysql' ? 'primary' : 'default'}
            onClick={() => setDatabaseType('mysql')}
          >
            MySQL ({mysqlDatabases.length})
          </Button>
          <Button
            type={databaseType === 'postgresql' ? 'primary' : 'default'}
            onClick={() => setDatabaseType('postgresql')}
          >
            PostgreSQL ({postgresqlDatabases.length})
          </Button>
        </div>

        <Table
          columns={databaseColumns(databaseType)}
          dataSource={currentDatabases}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title={editingDatabase ? '编辑数据库' : '添加数据库'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ database_type: databaseType }}
        >
          <div className="flex gap-4">
            <Form.Item name="database_type" label="数据库类型" className="w-32">
              <Select
                options={[
                  { label: 'MySQL', value: 'mysql' },
                  { label: 'PostgreSQL', value: 'postgresql' }
                ]}
                onChange={(value) => setDatabaseType(value)}
              />
            </Form.Item>
            <Form.Item name="name" label="名称" className="flex-1" rules={[{ required: true }]}>
              <Input placeholder="MySQL-Production" />
            </Form.Item>
          </div>

          <div className="flex gap-4">
            <Form.Item name="host" label="主机" className="flex-1" rules={[{ required: true }]}>
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item name="port" label="端口" className="w-28" rules={[{ required: true }]}>
              <Input type="number" placeholder={databaseType === 'mysql' ? '3306' : '5432'} />
            </Form.Item>
          </div>

          <div className="flex gap-4">
            <Form.Item name="user" label="用户名" className="flex-1" rules={[{ required: true }]}>
              <Input placeholder="root" />
            </Form.Item>
            <Form.Item name="password" label="密码" className="flex-1">
              <Input.Password placeholder="••••••••" />
            </Form.Item>
          </div>

          <Form.Item name="database_name" label="数据库名" rules={[{ required: true }]}>
            <Input placeholder="mydb" />
          </Form.Item>

          <Divider orientation="left">备份配置</Divider>

          <Alert
            message="备份功能说明"
            description={
              databaseType === 'mysql'
                ? '物理备份需要配置xtrabackup路径。BinLog备份用于实时增量备份和时间点恢复(PITR)。'
                : '物理备份需要配置pg_basebackup。WAL备份用于实时增量备份和时间点恢复(PITR)。'
            }
            type="info"
            showIcon
            icon={<Info size={16} />}
            className="mb-4"
          />

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="is_physical_backup_supported" label="启用物理备份" valuePropName="checked" tooltip="使用xtrabackup(MySQL)或pg_basebackup(PostgreSQL)进行备份">
              <Switch />
            </Form.Item>

            {databaseType === 'mysql' ? (
              <Form.Item name="binary_log_enabled" label="启用BinLog备份" valuePropName="checked" tooltip="实时备份MySQL二进制日志，用于PITR时间点恢复">
                <Switch />
              </Form.Item>
            ) : (
              <Form.Item name="wal_enabled" label="启用WAL备份" valuePropName="checked" tooltip="实时备份PostgreSQL WAL日志，用于PITR时间点恢复">
                <Switch />
              </Form.Item>
            )}
          </div>

          <div className="flex gap-4">
            <Form.Item
              name={databaseType === 'mysql' ? 'xtrabackup_path' : 'wal_path'}
              label={databaseType === 'mysql' ? 'xtrabackup路径' : 'WAL归档路径'}
              className="flex-1"
              tooltip={databaseType === 'mysql' ? 'xtrabackup二进制文件路径，如/usr/bin/xtrabackup' : 'WAL归档目录路径'}
            >
              <Input placeholder={databaseType === 'mysql' ? '/usr/bin/xtrabackup' : '/var/lib/postgresql/wal_archive'} />
            </Form.Item>

            {databaseType === 'mysql' && (
              <Form.Item name="binary_log_path" label="BinLog路径" className="flex-1" tooltip="MySQL二进制日志目录路径">
                <Input placeholder="/var/lib/mysql" />
              </Form.Item>
            )}

            {databaseType === 'postgresql' && (
              <Form.Item name="wal_path" label="WAL路径" className="flex-1" tooltip="PostgreSQL WAL日志目录路径">
                <Input placeholder="/var/lib/postgresql/wal_archive" />
              </Form.Item>
            )}
          </div>

          <Form.Item style={{ marginTop: '24px' }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingDatabase ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建数据库向导"
        open={wizardVisible}
        onCancel={() => setWizardVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <DatabaseWizard
          onComplete={() => {
            setWizardVisible(false);
            fetchDatabases();
          }}
          onCancel={() => setWizardVisible(false)}
        />
      </Modal>

      <style>{`
        .database-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};