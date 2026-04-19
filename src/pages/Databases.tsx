import React, { useEffect, useState } from 'react';
import { Table, Modal, Form, Input, Switch, message, Select, Space } from 'antd';
import { Plus, Edit, Delete, Database as DatabaseIcon, Server, CheckCircle, XCircle, Save } from 'lucide-react';
import { mysqlDatabaseAPI, postgresqlDatabaseAPI } from '../services/api';

export const Databases: React.FC = () => {
  const [mysqlDatabases, setMySQLDatabases] = useState<any[]>([]);
  const [postgresqlDatabases, setPostgreSQLDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<any>(null);
  const [databaseType, setDatabaseType] = useState<'mysql' | 'postgresql'>('mysql');
  const [activeTab, setActiveTab] = useState<'mysql' | 'postgresql'>('mysql');
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
      is_physical_backup_supported: database.is_physical_backup_supported,
      binary_log_enabled: database.binary_log_enabled,
      binary_log_path: database.binary_log_path,
      xtrabackup_path: database.xtrabackup_path,
      wal_enabled: database.wal_enabled,
      wal_path: database.wal_path,
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
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
      fontSize: '13px'
    }}>
      {enabled ? (
        <CheckCircle size={14} />
      ) : (
        <XCircle size={14} />
      )}
      {enabled ? '启用' : '未启用'}
    </span>
  );

  const mysqlColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: '600',
          fontSize: '14px',
          color: 'var(--color-text)'
        }}>
          {text}
        </span>
      )
    },
    {
      title: '主机:端口',
      key: 'connection',
      render: (_: any, record: any) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--color-primary)'
        }}>
          {record.host}:{record.port}
        </span>
      )
    },
    {
      title: '数据库',
      dataIndex: 'database_name',
      key: 'database_name',
      render: (text: string) => (
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {text}
        </span>
      )
    },
    {
      title: '物理备份',
      dataIndex: 'is_physical_backup_supported',
      key: 'is_physical_backup_supported',
      render: (enabled: boolean) => renderStatus(enabled)
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) => (
        <Space size={8}>
          <button
            className="cyber-button"
            onClick={() => handleEdit(record, 'mysql')}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            <Edit size={12} />
          </button>
          <button
            className="cyber-button"
            onClick={() => handleDelete(record.id, 'mysql')}
            style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          >
            <Delete size={12} />
          </button>
        </Space>
      )
    },
  ];

  const postgresqlColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: '600',
          fontSize: '14px',
          color: 'var(--color-text)'
        }}>
          {text}
        </span>
      )
    },
    {
      title: '主机:端口',
      key: 'connection',
      render: (_: any, record: any) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--color-primary)'
        }}>
          {record.host}:{record.port}
        </span>
      )
    },
    {
      title: '数据库',
      dataIndex: 'database_name',
      key: 'database_name',
      render: (text: string) => (
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {text}
        </span>
      )
    },
    {
      title: 'WAL日志',
      dataIndex: 'wal_enabled',
      key: 'wal_enabled',
      render: (enabled: boolean) => renderStatus(enabled)
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) => (
        <Space size={8}>
          <button
            className="cyber-button"
            onClick={() => handleEdit(record, 'postgresql')}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            <Edit size={12} />
          </button>
          <button
            className="cyber-button"
            onClick={() => handleDelete(record.id, 'postgresql')}
            style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          >
            <Delete size={12} />
          </button>
        </Space>
      )
    },
  ];

  const databases = activeTab === 'mysql' ? mysqlDatabases : postgresqlDatabases;
  const columns = activeTab === 'mysql' ? mysqlColumns : postgresqlColumns;

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
          数据库管理
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          管理MySQL和PostgreSQL数据库连接配置
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
            <DatabaseIcon size={20} style={{ color: 'var(--color-primary)' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '1px'
            }}>
              数据库列表
            </span>
            <span style={{
              background: 'rgba(0, 240, 255, 0.1)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--color-primary)'
            }}>
              {databases.length} 个数据库
            </span>
          </div>

          <button
            className="cyber-button cyber-button-primary"
            onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            添加数据库
          </button>
        </div>

        <div className="cyber-tabs" style={{ padding: '0 24px' }}>
          <div
            className={`cyber-tab ${activeTab === 'mysql' ? 'active' : ''}`}
            onClick={() => setActiveTab('mysql')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: activeTab === 'mysql' ? 'var(--color-primary)' : '#3b5998'
            }} />
            MySQL
          </div>
          <div
            className={`cyber-tab ${activeTab === 'postgresql' ? 'active' : ''}`}
            onClick={() => setActiveTab('postgresql')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: activeTab === 'postgresql' ? 'var(--color-primary)' : '#336791'
            }} />
            PostgreSQL
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={databases}
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
        />
      </div>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        closable={false}
        width={500}
      >
        <div className="cyber-modal">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <DatabaseIcon size={24} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0,
              letterSpacing: '1px'
            }}>
              {editingDatabase ? '编辑数据库' : '添加数据库'}
            </h3>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {!editingDatabase && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  数据库类型
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDatabaseType('mysql');
                      form.setFieldsValue({ database_type: 'mysql' });
                    }}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: databaseType === 'mysql' ? 'rgba(59, 89, 152, 0.15)' : 'rgba(0, 240, 255, 0.02)',
                      border: `1px solid ${databaseType === 'mysql' ? '#3b5998' : 'var(--color-border)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: databaseType === 'mysql' ? '#3b5998' : 'var(--color-text)'
                    }}>
                      MySQL
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDatabaseType('postgresql');
                      form.setFieldsValue({ database_type: 'postgresql' });
                    }}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: databaseType === 'postgresql' ? 'rgba(51, 103, 145, 0.15)' : 'rgba(0, 240, 255, 0.02)',
                      border: `1px solid ${databaseType === 'postgresql' ? '#336791' : 'var(--color-border)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: databaseType === 'postgresql' ? '#336791' : 'var(--color-text)'
                    }}>
                      PostgreSQL
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input className="cyber-input" placeholder="MySQL-Production" />
              </Form.Item>
              <Form.Item name="database_name" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
                <Input className="cyber-input" placeholder="mydb" />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <Form.Item name="host" label="主机" rules={[{ required: true, message: '请输入主机地址' }]}>
                <Input className="cyber-input" placeholder="192.168.1.100" />
              </Form.Item>
              <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                <Input className="cyber-input" type="number" placeholder={databaseType === 'mysql' ? '3306' : '5432'} />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Form.Item name="user" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input className="cyber-input" placeholder="root" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: !editingDatabase, message: '请输入密码' }]}>
                <Input.Password className="cyber-input" placeholder="••••••••" />
              </Form.Item>
            </div>

            {databaseType === 'mysql' && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 240, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  marginBottom: '16px'
                }}>
                  <span style={{ color: 'var(--color-text)', fontSize: '13px' }}>支持物理备份</span>
                  <Form.Item name="is_physical_backup_supported" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 240, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  marginBottom: '16px'
                }}>
                  <span style={{ color: 'var(--color-text)', fontSize: '13px' }}>启用二进制日志</span>
                  <Form.Item name="binary_log_enabled" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>

                <Form.Item name="binary_log_path" label="二进制日志路径">
                  <Input className="cyber-input" placeholder="/var/lib/mysql/binlog" />
                </Form.Item>

                <Form.Item name="xtrabackup_path" label="XtraBackup路径">
                  <Input className="cyber-input" placeholder="/usr/bin/innobackupex" />
                </Form.Item>
              </>
            )}

            {databaseType === 'postgresql' && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 240, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  marginBottom: '16px'
                }}>
                  <span style={{ color: 'var(--color-text)', fontSize: '13px' }}>启用WAL日志</span>
                  <Form.Item name="wal_enabled" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>

                <Form.Item name="wal_path" label="WAL日志路径">
                  <Input className="cyber-input" placeholder="/var/lib/postgresql/wal" />
                </Form.Item>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="cyber-button"
                onClick={() => setModalVisible(false)}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                type="submit"
                className="cyber-button cyber-button-primary"
                style={{ flex: 1 }}
              >
                <Save size={14} style={{ marginRight: '6px' }} />
                {editingDatabase ? '更新' : '创建'}
              </button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
};