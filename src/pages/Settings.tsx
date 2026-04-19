import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Switch, Space, message, Tabs, Table, Tag, Popconfirm } from 'antd';
import { Settings as SettingsIcon, Database, Bell, Shield, Bell as AlertIcon, Trash2, Check, Save, Folder, Clock, Mail, MessageSquare, Key, Timer } from 'lucide-react';
import { settingsAPI, alertAPI } from '../services/api';

interface Alert {
  id: number;
  type: string;
  level: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AlertSettings {
  alert_email_enabled: boolean;
  alert_email: string;
  alert_dingtalk_enabled: boolean;
  alert_dingtalk_webhook: string;
}

interface BackupSettings {
  backup_storage_path: string;
  backup_retention_days: number;
  backup_compression_enabled: boolean;
}

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    alert_email_enabled: false,
    alert_email: '',
    alert_dingtalk_enabled: false,
    alert_dingtalk_webhook: '',
  });
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    backup_storage_path: '/tmp/backups',
    backup_retention_days: 7,
    backup_compression_enabled: true,
  });
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchAlertSettings();
    fetchBackupSettings();
    fetchAlerts();
  }, []);

  const fetchAlertSettings = async () => {
    try {
      const data = await settingsAPI.getAlertSettings();
      if (data) {
        setAlertSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch alert settings:', error);
    }
  };

  const fetchBackupSettings = async () => {
    try {
      const data = await settingsAPI.getBackupSettings();
      if (data) {
        setBackupSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch backup settings:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const data = await alertAPI.getAll();
      setAlerts(data?.alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const handleSaveAlert = async () => {
    setLoading(true);
    try {
      await settingsAPI.setAlertSettings(alertSettings);
      message.success('告警设置已保存');
    } catch (error) {
      message.error('保存告警设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBackupSettings = async () => {
    setLoading(true);
    try {
      await settingsAPI.setBackupSettings(backupSettings);
      message.success('备份设置已保存');
    } catch (error) {
      message.error('保存备份设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await alertAPI.markAsRead(id);
      message.success('已标记为已读');
      fetchAlerts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await alertAPI.markAllAsRead();
      message.success('已标记所有为已读');
      fetchAlerts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDeleteAlert = async (id: number) => {
    try {
      await alertAPI.delete(id);
      message.success('告警已删除');
      fetchAlerts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getLevelConfig = (level: string) => {
    const configMap: Record<string, { color: string; bg: string; text: string }> = {
      info: { color: 'var(--color-primary)', bg: 'rgba(0, 240, 255, 0.1)', text: 'INFO' },
      warning: { color: 'var(--color-warning)', bg: 'rgba(255, 170, 0, 0.1)', text: 'WARNING' },
      error: { color: 'var(--color-error)', bg: 'rgba(255, 51, 102, 0.1)', text: 'ERROR' },
      critical: { color: 'var(--color-error)', bg: 'rgba(255, 51, 102, 0.2)', text: 'CRITICAL' }
    };
    return configMap[level] || { color: 'var(--color-text-muted)', bg: 'rgba(100, 116, 139, 0.1)', text: level.toUpperCase() };
  };

  const alertColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          color: 'var(--color-text-muted)'
        }}>
          {new Date(time).toLocaleString()}
        </span>
      )
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const config = getLevelConfig(level);
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            background: config.bg,
            border: `1px solid ${config.color}30`,
            borderRadius: '4px',
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            fontWeight: '600',
            color: config.color,
            letterSpacing: '0.5px'
          }}>
            {config.text}
          </span>
        );
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <span style={{ color: 'var(--color-text)' }}>{type}</span>
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{title}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (isRead: boolean) => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: isRead ? 'var(--color-success)' : 'var(--color-warning)',
          fontSize: '12px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isRead ? 'var(--color-success)' : 'var(--color-warning)'
          }} />
          {isRead ? '已读' : '未读'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Alert) => (
        <Space size={8}>
          {!record.is_read && (
            <button
              className="cyber-button"
              onClick={() => handleMarkAsRead(record.id)}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              <Check size={12} />
            </button>
          )}
          <Popconfirm
            title="确认删除此告警？"
            onConfirm={() => handleDeleteAlert(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <button
              className="cyber-button"
              style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            >
              <Trash2 size={12} />
            </button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  const tabItems = [
    {
      key: 'general',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SettingsIcon size={16} />
          常规设置
        </span>
      ),
      children: (
        <div className="animate-fade-in">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            <div className="cyber-card">
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                marginBottom: '20px',
                letterSpacing: '1px'
              }}>
                系统信息
              </h3>
              <Form layout="vertical">
                <Form.Item label="系统名称">
                  <Input
                    className="cyber-input"
                    placeholder="Databasus"
                    defaultValue="Databasus"
                  />
                </Form.Item>
                <Form.Item label="系统描述">
                  <Input.TextArea
                    className="cyber-input"
                    rows={3}
                    placeholder="数据库管理系统"
                    defaultValue="数据库管理系统"
                  />
                </Form.Item>
              </Form>
            </div>

            <div className="cyber-card">
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                marginBottom: '20px',
                letterSpacing: '1px'
              }}>
                系统选项
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-border)'
              }}>
                <div>
                  <span style={{ color: 'var(--color-text)', fontSize: '14px' }}>调试模式</span>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: 0 }}>启用详细日志输出</p>
                </div>
                <Switch />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0'
              }}>
                <div>
                  <span style={{ color: 'var(--color-text)', fontSize: '14px' }}>自动更新</span>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: 0 }}>自动检查并安装更新</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="cyber-button cyber-button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} />
              保存设置
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'backup',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} />
          备份设置
        </span>
      ),
      children: (
        <div className="animate-fade-in">
          <div className="cyber-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Folder size={20} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                存储配置
              </h3>
            </div>

            <Form layout="vertical">
              <Form.Item label="备份存储路径">
                <Input
                  className="cyber-input"
                  value={backupSettings.backup_storage_path}
                  onChange={e => setBackupSettings({ ...backupSettings, backup_storage_path: e.target.value })}
                  placeholder="/tmp/backups"
                  prefix={<Folder size={14} style={{ color: 'var(--color-text-muted)' }} />}
                />
              </Form.Item>

              <Form.Item label="备份保留天数">
                <Input
                  className="cyber-input"
                  type="number"
                  value={backupSettings.backup_retention_days}
                  onChange={e => setBackupSettings({ ...backupSettings, backup_retention_days: parseInt(e.target.value) || 7 })}
                  prefix={<Clock size={14} style={{ color: 'var(--color-text-muted)' }} />}
                />
              </Form.Item>
            </Form>
          </div>

          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Database size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                备份选项
              </h3>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: 'rgba(0, 240, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)'
            }}>
              <div>
                <span style={{ color: 'var(--color-text)', fontSize: '14px', fontWeight: 500 }}>启用备份压缩</span>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>
                  使用 gzip 压缩备份文件以节省存储空间
                </p>
              </div>
              <Switch
                checked={backupSettings.backup_compression_enabled}
                onChange={checked => setBackupSettings({ ...backupSettings, backup_compression_enabled: checked })}
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              loading={loading}
              onClick={handleSaveBackupSettings}
              className="cyber-button cyber-button-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              保存设置
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'notification',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} />
          告警设置
        </span>
      ),
      children: (
        <div className="animate-fade-in">
          <div className="cyber-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Mail size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                邮件告警
              </h3>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <span style={{ color: 'var(--color-text)', fontSize: '14px' }}>启用邮件告警</span>
              <Switch
                checked={alertSettings.alert_email_enabled}
                onChange={checked => setAlertSettings({ ...alertSettings, alert_email_enabled: checked })}
              />
            </div>

            <Form layout="vertical">
              <Form.Item label="告警邮箱地址">
                <Input
                  className="cyber-input"
                  value={alertSettings.alert_email}
                  onChange={e => setAlertSettings({ ...alertSettings, alert_email: e.target.value })}
                  placeholder="admin@example.com"
                  disabled={!alertSettings.alert_email_enabled}
                  prefix={<Mail size={14} style={{ color: 'var(--color-text-muted)' }} />}
                />
              </Form.Item>
            </Form>
          </div>

          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <MessageSquare size={20} style={{ color: 'var(--color-warning)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                钉钉告警
              </h3>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <span style={{ color: 'var(--color-text)', fontSize: '14px' }}>启用钉钉告警</span>
              <Switch
                checked={alertSettings.alert_dingtalk_enabled}
                onChange={checked => setAlertSettings({ ...alertSettings, alert_dingtalk_enabled: checked })}
              />
            </div>

            <Form layout="vertical">
              <Form.Item label="钉钉 Webhook 地址">
                <Input.TextArea
                  className="cyber-input"
                  value={alertSettings.alert_dingtalk_webhook}
                  onChange={e => setAlertSettings({ ...alertSettings, alert_dingtalk_webhook: e.target.value })}
                  placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                  rows={2}
                  disabled={!alertSettings.alert_dingtalk_enabled}
                />
              </Form.Item>
            </Form>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              onClick={handleSaveAlert}
              loading={loading}
              className="cyber-button cyber-button-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              保存设置
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'alerts',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertIcon size={16} />
          告警记录
          {alerts.filter(a => !a.is_read).length > 0 && (
            <span className="cyber-badge cyber-badge-primary" style={{ marginLeft: '4px' }}>
              {alerts.filter(a => !a.is_read).length}
            </span>
          )}
        </span>
      ),
      children: (
        <div className="animate-fade-in">
          <div className="cyber-card" style={{ padding: '0' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertIcon size={20} style={{ color: 'var(--color-accent)' }} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: '600',
                  letterSpacing: '1px'
                }}>
                  告警列表
                </span>
                <span style={{
                  background: 'rgba(255, 0, 110, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: 'var(--color-accent)'
                }}>
                  {alerts.filter(a => !a.is_read).length} 条未读
                </span>
              </div>

              <button
                className="cyber-button"
                onClick={handleMarkAllAsRead}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={14} />
                全部已读
              </button>
            </div>

            <Table
              columns={alertColumns}
              dataSource={alerts}
              rowKey="id"
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
        </div>
      ),
    },
    {
      key: 'security',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} />
          安全设置
        </span>
      ),
      children: (
        <div className="animate-fade-in">
          <div className="cyber-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Key size={20} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                认证配置
              </h3>
            </div>

            <Form layout="vertical">
              <Form.Item label="JWT 密钥">
                <Input.Password
                  className="cyber-input"
                  placeholder="输入 JWT 密钥"
                  prefix={<Key size={14} style={{ color: 'var(--color-text-muted)' }} />}
                />
              </Form.Item>
            </Form>
          </div>

          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Timer size={20} style={{ color: 'var(--color-warning)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                会话配置
              </h3>
            </div>

            <Form layout="vertical">
              <Form.Item label="会话超时(分钟)">
                <Input
                  className="cyber-input"
                  type="number"
                  placeholder="30"
                  defaultValue={30}
                  prefix={<Timer size={14} style={{ color: 'var(--color-text-muted)' }} />}
                />
              </Form.Item>
            </Form>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="cyber-button cyber-button-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} />
              保存设置
            </button>
          </div>
        </div>
      ),
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
          系统设置
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          配置系统参数，管理备份策略和告警通知
        </p>
      </div>

      <div className="cyber-card" style={{ padding: '0' }}>
        <div className="cyber-tabs" style={{ padding: '0 24px' }}>
          {tabItems.map((item) => (
            <div
              key={item.key}
              className={`cyber-tab ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {tabItems.find(t => t.key === activeTab)?.children}
        </div>
      </div>
    </div>
  );
};