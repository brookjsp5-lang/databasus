import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, message, Space, Card, Badge, Form, Input, Switch, Tabs, Select, Tooltip, Alert } from 'antd';
import { Bell, Check, Trash2, Eye, AlertTriangle, AlertCircle, Info, CheckCircle, Mail, MessageSquare, Settings, Volume2, Send, Loader, Shield, Lock } from 'lucide-react';
import { settingsAPI } from '../services/api';

interface Alert {
  id: number;
  level: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: string;
  from_address: string;
  from_name: string;
  is_enabled: boolean;
}

interface AlertSettings {
  alert_email_enabled: boolean;
  alert_email: string;
  alert_dingtalk_enabled: boolean;
  alert_dingtalk_webhook: string;
  alert_wechat_enabled: boolean;
  alert_wechat_webhook: string;
  alert_levels: string[];
  alert_frequency: string;
}

interface UserPreferences {
  email_enabled: boolean;
  dingtalk_enabled: boolean;
  wechat_enabled: boolean;
  min_alert_level: string;
  alert_frequency: string;
}

const alertLevelConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  info: { color: 'blue', icon: <Info size={14} />, label: '信息' },
  warning: { color: 'gold', icon: <AlertTriangle size={14} />, label: '警告' },
  error: { color: 'red', icon: <AlertCircle size={14} />, label: '错误' },
  success: { color: 'green', icon: <CheckCircle size={14} />, label: '成功' },
};

const levelOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
  { label: '成功', value: 'success' },
];

const frequencyOptions = [
  { label: '即时通知', value: 'immediate' },
  { label: '每5分钟汇总', value: '5min' },
  { label: '每15分钟汇总', value: '15min' },
  { label: '每小时汇总', value: '1hour' },
  { label: '每日汇总', value: 'daily' },
];

const encryptionOptions = [
  { label: '无加密', value: 'none' },
  { label: 'TLS', value: 'tls' },
  { label: 'SSL', value: 'ssl' },
  { label: 'STARTTLS', value: 'starttls' },
];

const commonSMTPPorts: Record<string, number> = {
  none: 25,
  tls: 587,
  ssl: 465,
  starttls: 587,
};

export const Alerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [smtpForm] = Form.useForm();
  const [testEmailForm] = Form.useForm();

  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls',
    from_address: '',
    from_name: 'DataTrue',
    is_enabled: false,
  });

  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    alert_email_enabled: false,
    alert_email: '',
    alert_dingtalk_enabled: false,
    alert_dingtalk_webhook: '',
    alert_wechat_enabled: false,
    alert_wechat_webhook: '',
    alert_levels: ['warning', 'error'],
    alert_frequency: 'immediate',
  });

  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    email_enabled: true,
    dingtalk_enabled: false,
    wechat_enabled: false,
    min_alert_level: 'warning',
    alert_frequency: 'immediate',
  });

  useEffect(() => {
    fetchAlerts();
    fetchUnreadCount();
    fetchSMTPConfig();
    fetchAlertSettings();
    fetchUserPreferences();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      message.error('获取告警列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('http://localhost:6001/api/alerts/unread-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchSMTPConfig = async () => {
    setSmtpLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/settings/smtp', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.smtp_config) {
          setSmtpConfig(data.smtp_config);
          smtpForm.setFieldsValue(data.smtp_config);
        }
      }
    } catch (error) {
      console.error('Failed to fetch SMTP config:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const data = await settingsAPI.getAlertSettings();
      if (data) {
        setAlertSettings({
          alert_email_enabled: data.alert_email_enabled || false,
          alert_email: data.alert_email || '',
          alert_dingtalk_enabled: data.alert_dingtalk_enabled || false,
          alert_dingtalk_webhook: data.alert_dingtalk_webhook || '',
          alert_wechat_enabled: data.alert_wechat_enabled || false,
          alert_wechat_webhook: data.alert_wechat_webhook || '',
          alert_levels: data.alert_levels || ['warning', 'error'],
          alert_frequency: data.alert_frequency || 'immediate',
        });
      }
    } catch (error) {
      console.error('Failed to fetch alert settings:', error);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const response = await fetch('http://localhost:6001/api/alerts/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserPreferences(data.preferences || userPreferences);
      }
    } catch (error) {
      console.error('Failed to fetch user preferences:', error);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:6001/api/alerts/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('已标记为已读');
        fetchAlerts();
        fetchUnreadCount();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('http://localhost:6001/api/alerts/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('已全部标记为已读');
        fetchAlerts();
        fetchUnreadCount();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:6001/api/alerts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('告警已删除');
        fetchAlerts();
        fetchUnreadCount();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSaveSMTPConfig = async () => {
    setSettingsLoading(true);
    try {
      const values = await smtpForm.validateFields();
      const response = await fetch('http://localhost:6001/api/settings/smtp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('SMTP配置已保存');
        fetchSMTPConfig();
      } else {
        const data = await response.json();
        message.error(data.error || '保存失败');
      }
    } catch (error) {
      message.error('保存SMTP配置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleTestSMTPConnection = async () => {
    setSettingsLoading(true);
    try {
      const values = await smtpForm.validateFields();
      const response = await fetch('http://localhost:6001/api/settings/smtp/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        message.success('SMTP连接测试成功！');
      } else {
        message.error(`SMTP连接测试失败: ${data.error}`);
      }
    } catch (error) {
      message.error('测试SMTP连接失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      const values = await testEmailForm.validateFields();
      const response = await fetch('http://localhost:6001/api/settings/smtp/test-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to_address: values.test_email })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        message.success('测试邮件已发送，请查收！');
        testEmailForm.resetFields();
      } else {
        message.error(`发送测试邮件失败: ${data.error}`);
      }
    } catch (error) {
      message.error('发送测试邮件失败');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSettingsLoading(true);
    try {
      await settingsAPI.setAlertSettings({
        ...alertSettings,
        preferences: userPreferences
      });
      message.success('通知设置已保存');
    } catch (error) {
      message.error('保存通知设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setSettingsLoading(true);
    try {
      await fetch('http://localhost:6001/api/alerts/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preferences: userPreferences })
      });
      message.success('通知偏好已保存');
    } catch (error) {
      message.error('保存偏好失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleEncryptionChange = (value: string) => {
    smtpForm.setFieldsValue({ port: commonSMTPPorts[value] || 587 });
  };

  const columns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const config = alertLevelConfig[level] || alertLevelConfig.info;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Alert) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!record.is_read && <Badge status="processing" />}
          <span style={{ fontWeight: record.is_read ? 400 : 600 }}>{title}</span>
        </div>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => (
        <span style={{ color: 'var(--color-text-secondary)' }}>{text}</span>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Alert) => (
        <Space>
          {!record.is_read && (
            <Button type="text" size="small" icon={<Eye size={14} />} onClick={() => handleMarkAsRead(record.id)}>
              已读
            </Button>
          )}
          <Button type="text" danger size="small" icon={<Trash2 size={14} />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'alerts',
      label: <span className="flex items-center gap-2"><Bell size={16} />告警记录</span>,
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">告警历史</h3>
              <p className="text-sm text-secondary">
                {unreadCount > 0 ? (
                  <span style={{ color: 'var(--color-warning)' }}>您有 {unreadCount} 条未读告警</span>
                ) : (
                  '暂无未读告警'
                )}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button icon={<Check size={16} />} onClick={handleMarkAllAsRead}>全部标为已读</Button>
            )}
          </div>
          <Table
            columns={columns}
            dataSource={alerts}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Bell size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>暂无告警信息</p>
                </div>
              ),
            }}
          />
        </div>
      )
    },
    {
      key: 'smtp',
      label: <span className="flex items-center gap-2"><Mail size={16} />邮件配置</span>,
      children: (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">SMTP服务器配置</h3>
            <Card title={<span className="flex items-center gap-2"><Shield size={16} />SMTP配置</span>} style={{ marginBottom: 16 }}>
              <Form form={smtpForm} layout="vertical" initialValues={smtpConfig}>
                <div className="flex items-center gap-4 mb-4">
                  <Form.Item name="is_enabled" valuePropName="checked" noStyle>
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                  <span className="text-sm text-secondary">启用邮件通知功能</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Form.Item name="host" label="SMTP服务器地址" rules={[{ required: true, message: '请输入SMTP服务器地址' }]}>
                    <Input placeholder="smtp.example.com" prefix={<Mail size={16} className="text-tertiary" />} />
                  </Form.Item>
                  <Form.Item name="port" label="端口号" rules={[{ required: true, message: '请输入端口号' }]}>
                    <Input type="number" placeholder="587" />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Form.Item name="encryption" label="加密类型" rules={[{ required: true, message: '请选择加密类型' }]}>
                    <Select options={encryptionOptions} onChange={handleEncryptionChange} placeholder="选择加密类型" />
                  </Form.Item>
                  <Form.Item name="from_name" label="发件人名称" rules={[{ required: true, message: '请输入发件人名称' }]}>
                    <Input placeholder="DataTrue System" />
                  </Form.Item>
                </div>

                <Form.Item name="from_address" label="发件人邮箱" rules={[
                  { required: true, message: '请输入发件人邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}>
                  <Input placeholder="noreply@example.com" prefix={<Mail size={16} className="text-tertiary" />} />
                </Form.Item>

                <div className="grid grid-cols-2 gap-4">
                  <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input placeholder="smtp_username" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password placeholder="smtp_password" />
                  </Form.Item>
                </div>

                <div className="bg-info bg-opacity-10 p-4 rounded-lg border border-info border-opacity-20 mb-4">
                  <p className="text-sm text-info">
                    <Info size={14} className="inline mr-1" />
                    安全提示：密码将加密存储。请确保使用正确的SMTP凭据。
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="primary" onClick={handleSaveSMTPConfig} loading={settingsLoading}>保存配置</Button>
                  <Button onClick={handleTestSMTPConnection} loading={settingsLoading}>测试连接</Button>
                </div>
              </Form>
            </Card>

            <Card title={<span className="flex items-center gap-2"><Send size={16} />发送测试邮件</span>}>
              <Form form={testEmailForm} layout="vertical" style={{ maxWidth: 400 }}>
                <Form.Item
                  name="test_email"
                  label="收件人邮箱"
                  rules={[
                    { required: true, message: '请输入收件人邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input placeholder="test@example.com" prefix={<Mail size={16} className="text-tertiary" />} />
                </Form.Item>
                <Button type="primary" icon={<Send size={16} />} onClick={handleSendTestEmail} loading={testEmailLoading}>
                  发送测试邮件
                </Button>
              </Form>
            </Card>
          </div>
        </div>
      )
    },
    {
      key: 'settings',
      label: <span className="flex items-center gap-2"><Settings size={16} />通知设置</span>,
      children: (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">通知方式配置</h3>
            <Card title={<span className="flex items-center gap-2"><Mail size={16} />邮件通知</span>} style={{ marginBottom: 16 }}>
              <Form layout="vertical">
                <Form.Item label="启用邮件通知">
                  <Switch
                    checked={alertSettings.alert_email_enabled}
                    onChange={(checked) => setAlertSettings({ ...alertSettings, alert_email_enabled: checked })}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                </Form.Item>
                {alertSettings.alert_email_enabled && (
                  <Form.Item label="告警接收邮箱">
                    <Input
                      value={alertSettings.alert_email}
                      onChange={(e) => setAlertSettings({ ...alertSettings, alert_email: e.target.value })}
                      placeholder="admin@example.com"
                      prefix={<Mail size={16} className="text-tertiary" />}
                    />
                  </Form.Item>
                )}
              </Form>
            </Card>

            <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} />钉钉通知</span>} style={{ marginBottom: 16 }}>
              <Form layout="vertical">
                <Form.Item label="启用钉钉通知">
                  <Switch
                    checked={alertSettings.alert_dingtalk_enabled}
                    onChange={(checked) => setAlertSettings({ ...alertSettings, alert_dingtalk_enabled: checked })}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                </Form.Item>
                {alertSettings.alert_dingtalk_enabled && (
                  <Form.Item label="钉钉 Webhook 地址">
                    <Input
                      value={alertSettings.alert_dingtalk_webhook}
                      onChange={(e) => setAlertSettings({ ...alertSettings, alert_dingtalk_webhook: e.target.value })}
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                      prefix={<MessageSquare size={16} className="text-tertiary" />}
                    />
                  </Form.Item>
                )}
              </Form>
            </Card>

            <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} />企业微信通知</span>} style={{ marginBottom: 16 }}>
              <Form layout="vertical">
                <Form.Item label="启用企业微信通知">
                  <Switch
                    checked={alertSettings.alert_wechat_enabled}
                    onChange={(checked) => setAlertSettings({ ...alertSettings, alert_wechat_enabled: checked })}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                </Form.Item>
                {alertSettings.alert_wechat_enabled && (
                  <Form.Item label="企业微信 Webhook 地址">
                    <Input
                      value={alertSettings.alert_wechat_webhook}
                      onChange={(e) => setAlertSettings({ ...alertSettings, alert_wechat_webhook: e.target.value })}
                      placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                      prefix={<MessageSquare size={16} className="text-tertiary" />}
                    />
                  </Form.Item>
                )}
              </Form>
            </Card>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">通知偏好设置</h3>
            <Card title={<span className="flex items-center gap-2"><Volume2 size={16} />告警级别阈值</span>} style={{ marginBottom: 16 }}>
              <Form layout="vertical">
                <Form.Item label="接收以下级别的告警通知">
                  <Select
                    mode="multiple"
                    value={userPreferences.min_alert_level}
                    onChange={(value) => setUserPreferences({ ...userPreferences, min_alert_level: value })}
                    options={levelOptions}
                    style={{ width: '100%' }}
                    placeholder="选择告警级别"
                  />
                </Form.Item>
                <div className="bg-info bg-opacity-10 p-4 rounded-lg border border-info border-opacity-20">
                  <p className="text-sm text-info">
                    设置您希望接收的最低告警级别。低于此级别的告警将不会发送通知。
                  </p>
                </div>
              </Form>
            </Card>

            <Card title={<span className="flex items-center gap-2"><Bell size={16} />通知频率</span>}>
              <Form layout="vertical">
                <Form.Item label="通知汇总频率">
                  <Select
                    value={userPreferences.alert_frequency}
                    onChange={(value) => setUserPreferences({ ...userPreferences, alert_frequency: value })}
                    options={frequencyOptions}
                    style={{ width: '100%' }}
                    placeholder="选择通知频率"
                  />
                </Form.Item>
                <div className="bg-info bg-opacity-10 p-4 rounded-lg border border-info border-opacity-20">
                  <p className="text-sm text-info">
                    设置告警通知的汇总频率。即时通知会在告警发生时立即发送，汇总通知则会按设定时间间隔发送。
                  </p>
                </div>
              </Form>
            </Card>
          </div>

          <Button type="primary" onClick={handleSaveNotificationSettings} loading={settingsLoading} size="large">
            保存所有设置
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">告警通知</h1>
        <p className="page-description">查看告警历史和管理通知设置</p>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};