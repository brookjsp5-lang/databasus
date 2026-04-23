import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Steps, Alert, Space, Tag, Divider, InputNumber, DatePicker, message, Card, Radio, Tooltip, Popconfirm } from 'antd';
import { Plus, Database as DatabaseIcon, Clock, HardDrive, Bell, Save, CheckCircle, XCircle, Wifi, WifiOff, Loader, Info, AlertTriangle } from 'lucide-react';
import { mysqlDatabaseAPI, postgresqlDatabaseAPI, backupConfigAPI, storageAPI } from '../services/api';
import dayjs from 'dayjs';

interface DatabaseWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface DatabaseFormData {
  name: string;
  database_type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  user: string;
  password: string;
  database_name: string;
  engine_version: string;
  workspace_id: number;
}

interface ScheduleFormData {
  schedule_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';
  cron_expression?: string;
  hourly_interval?: number;
  daily_time?: string;
  weekly_days?: string[];
  monthly_day?: number;
  monthly_time?: string;
  enabled: boolean;
}

interface StorageFormData {
  storage_type: 'local' | 's3' | 'nas';
  local_path?: string;
  s3_bucket?: string;
  s3_region?: string;
  s3_endpoint?: string;
  s3_access_key?: string;
  s3_secret_key?: string;
  nas_path?: string;
  nas_host?: string;
}

interface RetentionFormData {
  retention_type: 'time' | 'count';
  retention_days?: number;
  retention_count?: number;
  max_backup_size?: number;
  total_storage_limit?: number;
}

interface NotificationFormData {
  email_enabled: boolean;
  email?: string;
  webhook_enabled: boolean;
  webhook_url?: string;
  notify_on_success: boolean;
  notify_on_failure: boolean;
}

interface BackupConfigFormData {
  backup_type: 'physical' | 'logical';
  compress: boolean;
  compress_level?: number;
  encryption_enabled: boolean;
  encryption_key?: string;
}

const STEPS = [
  { title: '数据库类型', icon: <DatabaseIcon size={16} /> },
  { title: '连接设置', icon: <Wifi size={16} /> },
  { title: '备份类型', icon: <HardDrive size={16} /> },
  { title: '排程配置', icon: <Clock size={16} /> },
  { title: '存储位置', icon: <HardDrive size={16} /> },
  { title: '保留策略', icon: <Clock size={16} /> },
  { title: '通知设置', icon: <Bell size={16} /> },
];

const SUPPORTED_MYSQL_VERSIONS = ['5.7', '8.0', '8.4', '9.0'];
const SUPPORTED_POSTGRESQL_VERSIONS = ['12', '13', '14', '15', '16', '17', '18'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DatabaseWizard: React.FC<DatabaseWizardProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [testingStorage, setTestingStorage] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testingNotification, setTestingNotification] = useState(false);

  const [databaseForm] = Form.useForm<DatabaseFormData>();
  const [scheduleForm] = Form.useForm<ScheduleFormData>();
  const [storageForm] = Form.useForm<StorageFormData>();
  const [retentionForm] = Form.useForm<RetentionFormData>();
  const [notificationForm] = Form.useForm<NotificationFormData>();
  const [backupConfigForm] = Form.useForm<BackupConfigFormData>();

  const [storages, setStorages] = useState<any[]>([]);

  useEffect(() => {
    fetchStorages();
    scheduleForm.setFieldsValue({
      schedule_type: 'daily',
      enabled: true,
      daily_time: '04:00',
    });
    retentionForm.setFieldsValue({
      retention_type: 'time',
      retention_days: 7,
    });
    backupConfigForm.setFieldsValue({
      backup_type: 'physical',
      compress: true,
      compress_level: 6,
      encryption_enabled: false,
    });
    notificationForm.setFieldsValue({
      notify_on_success: true,
      notify_on_failure: true,
    });
  }, []);

  const fetchStorages = async () => {
    try {
      const response = await storageAPI.getAll();
      setStorages(response?.storages || []);
    } catch (error) {
      console.error('Failed to fetch storages:', error);
    }
  };

  const handleDatabaseTypeChange = (type: 'mysql' | 'postgresql') => {
    databaseForm.setFieldValue('database_type', type);
    databaseForm.setFieldValue('port', type === 'mysql' ? 3306 : 5432);
    databaseForm.setFieldValue('engine_version', type === 'mysql' ? '8.0' : '16');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionError('');

    try {
      const values = databaseForm.getFieldsValue();
      const testPayload = {
        host: values.host,
        port: values.port,
        user: values.user,
        password: values.password,
        database_name: values.database_name,
        engine_version: values.engine_version,
      };

      if (values.database_type === 'mysql') {
        await mysqlDatabaseAPI.create({ ...testPayload, workspace_id: 1, name: values.name + '_test' });
      } else {
        await postgresqlDatabaseAPI.create({ ...testPayload, workspace_id: 1, name: values.name + '_test' });
      }

      setConnectionStatus('success');
      message.success('数据库连接测试成功！');
    } catch (error: any) {
      setConnectionStatus('failed');
      setConnectionError(error.response?.data?.error || '连接失败，请检查数据库配置');
      message.error('数据库连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestStorage = async () => {
    setTestingStorage(true);
    setStorageStatus('idle');

    try {
      const values = storageForm.getFieldsValue();

      if (values.storage_type === 'local') {
        if (!values.local_path) {
          message.error('请输入本地存储路径');
          setStorageStatus('failed');
          return;
        }
        message.success('本地存储路径验证成功');
        setStorageStatus('success');
      } else if (values.storage_type === 's3') {
        if (!values.s3_bucket || !values.s3_region) {
          message.error('请填写S3配置信息');
          setStorageStatus('failed');
          return;
        }
        message.success('S3存储配置验证成功');
        setStorageStatus('success');
      } else if (values.storage_type === 'nas') {
        if (!values.nas_path) {
          message.error('请输入NAS路径');
          setStorageStatus('failed');
          return;
        }
        message.success('NAS存储配置验证成功');
        setStorageStatus('success');
      }
    } catch (error) {
      setStorageStatus('failed');
      message.error('存储验证失败');
    } finally {
      setTestingStorage(false);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);

    try {
      const values = notificationForm.getFieldsValue();

      if (values.webhook_enabled && values.webhook_url) {
        await fetch(values.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: { content: 'DatabasUS 通知测试消息' }
          })
        });
        message.success('Webhook通知测试成功！');
      } else if (values.email_enabled && values.email) {
        message.info('邮件通知已配置（实际发送需要SMTP服务器）');
      } else {
        message.warning('请先启用并配置通知渠道');
      }
    } catch (error) {
      message.error('通知测试失败');
    } finally {
      setTestingNotification(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        await databaseForm.validateFields();
      } catch {
        return;
      }
    } else if (currentStep === 4) {
      try {
        await storageForm.validateFields();
      } catch {
        return;
      }
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const dbValues = databaseForm.getFieldsValue();
      const schedValues = scheduleForm.getFieldsValue();
      const storValues = storageForm.getFieldsValue();
      const retValues = retentionForm.getFieldsValue();
      const notifValues = notificationForm.getFieldsValue();
      const backupValues = backupConfigForm.getFieldsValue();

      let databaseId: number;

      const dbPayload = {
        name: dbValues.name,
        host: dbValues.host,
        port: dbValues.port,
        user: dbValues.user,
        password: dbValues.password,
        database_name: dbValues.database_name,
        engine_version: dbValues.engine_version,
        workspace_id: 1,
        is_physical_backup_supported: backupValues.backup_type === 'physical',
        binary_log_enabled: dbValues.database_type === 'mysql',
        binary_log_path: '/var/lib/mysql',
        xtrabackup_path: '/usr/bin/xtrabackup',
        wal_enabled: dbValues.database_type === 'postgresql',
        wal_path: '/var/lib/postgresql/wal_archive',
      };

      if (dbValues.database_type === 'mysql') {
        const response = await mysqlDatabaseAPI.create(dbPayload);
        databaseId = response?.database?.id;
      } else {
        const response = await postgresqlDatabaseAPI.create(dbPayload);
        databaseId = response?.database?.id;
      }

      let storageId: number;
      if (storValues.storage_type === 'local') {
        const storageResponse = await storageAPI.create({
          name: 'Local Storage',
          type: 'local',
          config: { path: storValues.local_path },
          workspace_id: 1,
        });
        storageId = storageResponse?.storage?.id;
      } else if (storValues.storage_type === 's3') {
        const storageResponse = await storageAPI.create({
          name: 'S3 Storage',
          type: 's3',
          config: {
            bucket: storValues.s3_bucket,
            region: storValues.s3_region,
            endpoint: storValues.s3_endpoint,
            access_key: storValues.s3_access_key,
            secret_key: storValues.s3_secret_key,
          },
          workspace_id: 1,
        });
        storageId = storageResponse?.storage?.id;
      } else {
        const storageResponse = await storageAPI.create({
          name: 'NAS Storage',
          type: 'nas',
          config: {
            path: storValues.nas_path,
            host: storValues.nas_host,
          },
          workspace_id: 1,
        });
        storageId = storageResponse?.storage?.id;
      }

      const scheduleCron = generateCronExpression(schedValues);

      const backupConfigPayload = {
        name: `${dbValues.name} Backup Config`,
        database_id: databaseId,
        database_type: dbValues.database_type,
        storage_id: storageId,
        workspace_id: 1,
        schedule_type: schedValues.schedule_type,
        cron_expression: scheduleCron,
        backup_type: backupValues.backup_type,
        retention_type: retValues.retention_type,
        retention_days: retValues.retention_days,
        retention_count: retValues.retention_count,
        compress: backupValues.compress,
        compress_level: backupValues.compress_level,
        encryption_enabled: backupValues.encryption_enabled,
        encryption_key: backupValues.encryption_key,
        email_enabled: notifValues.email_enabled,
        email: notifValues.email,
        webhook_enabled: notifValues.webhook_enabled,
        webhook_url: notifValues.webhook_url,
        notify_on_success: notifValues.notify_on_success,
        notify_on_failure: notifValues.notify_on_failure,
        enabled: schedValues.enabled,
      };

      await backupConfigAPI.create(backupConfigPayload);

      message.success('数据库和备份配置创建成功！');
      onComplete?.();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败，请检查配置');
    } finally {
      setLoading(false);
    }
  };

  const generateCronExpression = (schedule: ScheduleFormData): string => {
    switch (schedule.schedule_type) {
      case 'hourly':
        return `0 */${schedule.hourly_interval || 1} * * *`;
      case 'daily':
        const [hours, minutes] = (schedule.daily_time || '04:00').split(':');
        return `${minutes} ${hours} * * *`;
      case 'weekly':
        const dayIndex = schedule.weekly_days?.[0] ? WEEKDAYS.indexOf(schedule.weekly_days[0]) + 1 : 1;
        const [wh, wm] = (schedule.daily_time || '04:00').split(':');
        return `${wm} ${wh} * * ${dayIndex}`;
      case 'monthly':
        return `0 ${schedule.monthly_time || '04:00'} ${schedule.monthly_day || 1} * *`;
      case 'cron':
        return schedule.cron_expression || '0 0 * * *';
      default:
        return '0 0 * * *';
    }
  };

  const renderDatabaseTypeStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">选择数据库类型</h3>
        <p className="step-description">请选择要添加的数据库类型</p>

        <Form.Item name="database_type" rules={[{ required: true }]}>
          <Radio.Group className="database-type-selector">
            <Radio.Button value="mysql" className="database-type-option">
              <div className="database-type-content">
                <div className="database-type-icon mysql">
                  <DatabaseIcon size={32} />
                </div>
                <div className="database-type-info">
                  <span className="database-type-name">MySQL</span>
                  <span className="database-type-versions">支持 5.7, 8.0, 8.4, 9.0</span>
                </div>
              </div>
            </Radio.Button>
            <Radio.Button value="postgresql" className="database-type-option">
              <div className="database-type-content">
                <div className="database-type-icon postgresql">
                  <DatabaseIcon size={32} />
                </div>
                <div className="database-type-info">
                  <span className="database-type-name">PostgreSQL</span>
                  <span className="database-type-versions">支持 12, 13, 14, 15, 16, 17, 18</span>
                </div>
              </div>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
      </div>
    </Card>
  );

  const renderConnectionStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">数据库连接设置</h3>
        <p className="step-description">填写数据库连接信息</p>

        <Form.Item
          name="name"
          label="数据库名称"
          rules={[{ required: true, message: '请输入数据库名称' }]}
        >
          <Input placeholder="MySQL-Production" />
        </Form.Item>

        <div className="form-row">
          <Form.Item
            name="host"
            label="主机地址"
            className="flex-1"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="localhost 或 IP地址" />
          </Form.Item>

          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className="form-row">
          <Form.Item
            name="user"
            label="用户名"
            className="flex-1"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="root" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            className="flex-1"
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </div>

        <Form.Item
          name="database_name"
          label="数据库名"
          rules={[{ required: true, message: '请输入数据库名' }]}
        >
          <Input placeholder="mydb" />
        </Form.Item>

        <Form.Item
          name="engine_version"
          label="数据库版本"
          rules={[{ required: true, message: '请选择数据库版本' }]}
        >
          <Select placeholder="选择版本">
            {databaseForm.getFieldValue('database_type') === 'mysql'
              ? SUPPORTED_MYSQL_VERSIONS.map(v => (
                  <Select.Option key={v} value={v}>MySQL {v}</Select.Option>
                ))
              : SUPPORTED_POSTGRESQL_VERSIONS.map(v => (
                  <Select.Option key={v} value={v}>PostgreSQL {v}</Select.Option>
                ))
            }
          </Select>
        </Form.Item>

        <div className="connection-test-section">
          <Button
            onClick={handleTestConnection}
            loading={testingConnection}
            icon={testingConnection ? <Loader size={14} className="spin" /> : connectionStatus === 'success' ? <CheckCircle size={14} /> : connectionStatus === 'failed' ? <XCircle size={14} /> : <Wifi size={14} />}
            type={connectionStatus === 'success' ? 'primary' : 'default'}
            danger={connectionStatus === 'failed'}
          >
            {testingConnection ? '测试中...' : '测试连接'}
          </Button>

          {connectionStatus === 'success' && (
            <Tag color="success" className="ml-2">连接成功</Tag>
          )}
          {connectionStatus === 'failed' && (
            <Tag color="error" className="ml-2">{connectionError || '连接失败'}</Tag>
          )}
        </div>
      </div>
    </Card>
  );

  const renderBackupTypeStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">备份类型配置</h3>
        <p className="step-description">选择备份方式并配置相关选项</p>

        <Form.Item name="backup_type" label="备份类型" rules={[{ required: true }]}>
          <Radio.Group className="backup-type-selector">
            <Radio.Button value="physical">
              <div className="backup-type-content">
                <span className="backup-type-name">物理备份</span>
                <span className="backup-type-desc">使用 xtrabackup/pg_basebackup，速度快</span>
              </div>
            </Radio.Button>
            <Radio.Button value="logical">
              <div className="backup-type-content">
                <span className="backup-type-name">逻辑备份</span>
                <span className="backup-type-desc">使用 mysqldump/pg_dump，兼容性好</span>
              </div>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Divider />

        <Form.Item name="compress" label="启用压缩" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.compress !== curr.compress}
        >
          {({ getFieldValue }) =>
            getFieldValue('compress') && (
              <Form.Item name="compress_level" label="压缩级别" extra="1-9，数字越大压缩率越高（也更慢）">
                <InputNumber min={1} max={9} defaultValue={6} style={{ width: 200 }} />
              </Form.Item>
            )
          }
        </Form.Item>

        <Form.Item name="encryption_enabled" label="启用加密" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.encryption_enabled !== curr.encryption_enabled}
        >
          {({ getFieldValue }) =>
            getFieldValue('encryption_enabled') && (
              <Form.Item name="encryption_key" label="加密密钥" rules={[{ required: true, message: '请输入加密密钥' }]}>
                <Input.Password placeholder="请输入32位加密密钥" />
              </Form.Item>
            )
          }
        </Form.Item>
      </div>
    </Card>
  );

  const renderScheduleStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">备份排程配置</h3>
        <p className="step-description">设置自动备份的执行周期</p>

        <Form.Item name="schedule_type" label="排程类型" rules={[{ required: true }]}>
          <Radio.Group className="schedule-type-selector">
            <Radio.Button value="hourly">按小时</Radio.Button>
            <Radio.Button value="daily">按日</Radio.Button>
            <Radio.Button value="weekly">按周</Radio.Button>
            <Radio.Button value="monthly">按月</Radio.Button>
            <Radio.Button value="cron">自定义Cron</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <div className="schedule-options">
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.schedule_type !== curr.schedule_type}
          >
            {({ getFieldValue }) => {
              const scheduleType = getFieldValue('schedule_type');

              if (scheduleType === 'hourly') {
                return (
                  <Form.Item name="hourly_interval" label="执行间隔（小时）">
                    <InputNumber min={1} max={24} defaultValue={1} />
                  </Form.Item>
                );
              }

              if (scheduleType === 'daily') {
                return (
                  <Form.Item name="daily_time" label="执行时间" className="time-picker">
                    <Input type="time" defaultValue="04:00" />
                  </Form.Item>
                );
              }

              if (scheduleType === 'weekly') {
                return (
                  <>
                    <Form.Item name="weekly_days" label="选择星期">
                      <Select mode="multiple" placeholder="选择星期" maxTagCount={1}>
                        {WEEKDAYS.map(day => (
                          <Select.Option key={day} value={day}>{day}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item name="daily_time" label="执行时间">
                      <Input type="time" defaultValue="04:00" />
                    </Form.Item>
                  </>
                );
              }

              if (scheduleType === 'monthly') {
                return (
                  <>
                    <Form.Item name="monthly_day" label="每月几号">
                      <InputNumber min={1} max={31} defaultValue={1} />
                    </Form.Item>
                    <Form.Item name="monthly_time" label="执行时间">
                      <Input type="time" defaultValue="04:00" />
                    </Form.Item>
                  </>
                );
              }

              if (scheduleType === 'cron') {
                return (
                  <Form.Item name="cron_expression" label="Cron表达式" rules={[{ required: true, message: '请输入Cron表达式' }]}>
                    <Input placeholder="0 0 * * * (默认每天凌晨)" />
                  </Form.Item>
                );
              }

              return null;
            }}
          </Form.Item>
        </div>

        <Alert
          message="Cron表达式说明"
          description={
            <div className="cron-help">
              <p><code>分 时 日 月 周</code></p>
              <p>示例: <code>0 4 * * *</code> = 每天凌晨4点</p>
              <p>示例: <code>0 */2 * * *</code> = 每2小时</p>
              <p>示例: <code>0 4 * * 1</code> = 每周一凌晨4点</p>
            </div>
          }
          type="info"
          showIcon
          icon={<Info size={16} />}
          className="mt-4"
        />

        <Form.Item name="enabled" label="启用自动备份" valuePropName="checked" className="mt-4">
          <Switch defaultChecked />
        </Form.Item>
      </div>
    </Card>
  );

  const renderStorageStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">存储位置选择</h3>
        <p className="step-description">选择备份文件的存储位置</p>

        <Form.Item name="storage_type" label="存储类型" rules={[{ required: true }]}>
          <Radio.Group className="storage-type-selector">
            <Radio.Button value="local">
              <div className="storage-type-content">
                <span>本地存储</span>
              </div>
            </Radio.Button>
            <Radio.Button value="s3">
              <div className="storage-type-content">
                <span>S3/云存储</span>
              </div>
            </Radio.Button>
            <Radio.Button value="nas">
              <div className="storage-type-content">
                <span>NAS存储</span>
              </div>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        <div className="storage-options">
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.storage_type !== curr.storage_type}
          >
            {({ getFieldValue }) => {
              const storageType = getFieldValue('storage_type');

              if (storageType === 'local') {
                return (
                  <Form.Item
                    name="local_path"
                    label="本地路径"
                    rules={[{ required: true, message: '请输入本地存储路径' }]}
                  >
                    <Input placeholder="/var/backups/databasus" />
                  </Form.Item>
                );
              }

              if (storageType === 's3') {
                return (
                  <>
                    <Form.Item
                      name="s3_bucket"
                      label="S3 Bucket"
                      rules={[{ required: true, message: '请输入Bucket名称' }]}
                    >
                      <Input placeholder="my-backup-bucket" />
                    </Form.Item>
                    <Form.Item
                      name="s3_region"
                      label="区域"
                      rules={[{ required: true, message: '请选择区域' }]}
                    >
                      <Select placeholder="选择AWS区域">
                        <Select.Option value="us-east-1">US East (N. Virginia)</Select.Option>
                        <Select.Option value="us-west-2">US West (Oregon)</Select.Option>
                        <Select.Option value="eu-west-1">Europe (Ireland)</Select.Option>
                        <Select.Option value="ap-northeast-1">Asia Pacific (Tokyo)</Select.Option>
                        <Select.Option value="cn-north-1">China (Beijing)</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="s3_endpoint" label="自定义端点（可选）">
                      <Input placeholder="https://s3.example.com (用于兼容S3的存储)" />
                    </Form.Item>
                    <div className="form-row">
                      <Form.Item name="s3_access_key" label="Access Key" className="flex-1">
                        <Input placeholder="AKIA..." />
                      </Form.Item>
                      <Form.Item name="s3_secret_key" label="Secret Key" className="flex-1">
                        <Input.Password placeholder="••••••••" />
                      </Form.Item>
                    </div>
                  </>
                );
              }

              if (storageType === 'nas') {
                return (
                  <>
                    <Form.Item
                      name="nas_host"
                      label="NAS主机"
                    >
                      <Input placeholder="192.168.1.100" />
                    </Form.Item>
                    <Form.Item
                      name="nas_path"
                      label="NAS路径"
                      rules={[{ required: true, message: '请输入NAS路径' }]}
                    >
                      <Input placeholder="/mnt/nas/backups" />
                    </Form.Item>
                  </>
                );
              }

              return null;
            }}
          </Form.Item>
        </div>

        <Button
          onClick={handleTestStorage}
          loading={testingStorage}
          icon={testingStorage ? <Loader size={14} className="spin" /> : storageStatus === 'success' ? <CheckCircle size={14} /> : storageStatus === 'failed' ? <XCircle size={14} /> : <HardDrive size={14} />}
          type={storageStatus === 'success' ? 'primary' : 'default'}
          danger={storageStatus === 'failed'}
          className="mt-4"
        >
          {testingStorage ? '验证中...' : '验证存储'}
        </Button>
      </div>
    </Card>
  );

  const renderRetentionStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">保留策略配置</h3>
        <p className="step-description">设置备份文件的保留规则</p>

        <Form.Item name="retention_type" label="保留方式" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="time">
              <div className="retention-option">
                <span className="retention-name">按时间保留</span>
                <span className="retention-desc">保留一定天数内的备份</span>
              </div>
            </Radio>
            <Radio value="count">
              <div className="retention-option">
                <span className="retention-name">按数量保留</span>
                <span className="retention-desc">保留最近一定数量的备份</span>
              </div>
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.retention_type !== curr.retention_type}
        >
          {({ getFieldValue }) => {
            const retentionType = getFieldValue('retention_type');

            if (retentionType === 'time') {
              return (
                <Form.Item
                  name="retention_days"
                  label="保留天数"
                  rules={[{ required: true, message: '请输入保留天数' }]}
                >
                  <Select placeholder="选择保留天数">
                    <Select.Option value={7}>7 天</Select.Option>
                    <Select.Option value={14}>14 天</Select.Option>
                    <Select.Option value={30}>30 天</Select.Option>
                    <Select.Option value={60}>60 天</Select.Option>
                    <Select.Option value={90}>90 天</Select.Option>
                    <Select.Option value={180}>180 天</Select.Option>
                    <Select.Option value={365}>1 年</Select.Option>
                  </Select>
                </Form.Item>
              );
            }

            if (retentionType === 'count') {
              return (
                <Form.Item
                  name="retention_count"
                  label="保留数量"
                  rules={[{ required: true, message: '请输入保留数量' }]}
                >
                  <Select placeholder="选择保留数量">
                    <Select.Option value={10}>10 个备份</Select.Option>
                    <Select.Option value={20}>20 个备份</Select.Option>
                    <Select.Option value={30}>30 个备份</Select.Option>
                    <Select.Option value={50}>50 个备份</Select.Option>
                    <Select.Option value={100}>100 个备份</Select.Option>
                  </Select>
                </Form.Item>
              );
            }

            return null;
          }}
        </Form.Item>

        <Divider />

        <h4 className="subsection-title">存储限制（可选）</h4>

        <Form.Item name="max_backup_size" label="单备份大小限制 (MB)">
          <InputNumber min={0} placeholder="0 表示不限制" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="total_storage_limit" label="总存储大小限制 (GB)">
          <InputNumber min={0} placeholder="0 表示不限制" style={{ width: '100%' }} />
        </Form.Item>

        <Alert
          message="GFS保留策略提示"
          description="如需配置更复杂的层级保留策略（如每小时、每天、每周、每月的备份独立保留），请在高级设置中配置。"
          type="info"
          showIcon
          className="mt-4"
        />
      </div>
    </Card>
  );

  const renderNotificationStep = () => (
    <Card className="wizard-card">
      <div className="step-content">
        <h3 className="step-title">通知设置</h3>
        <p className="step-description">配置备份完成后的通知方式（可选）</p>

        <Form.Item name="email_enabled" label="启用邮件通知" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.email_enabled !== curr.email_enabled}
        >
          {({ getFieldValue }) =>
            getFieldValue('email_enabled') && (
              <Form.Item
                name="email"
                label="通知邮箱"
                rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input placeholder="admin@example.com" />
              </Form.Item>
            )
          }
        </Form.Item>

        <Form.Item name="webhook_enabled" label="启用Webhook通知" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.webhook_enabled !== curr.webhook_enabled}
        >
          {({ getFieldValue }) =>
            getFieldValue('webhook_enabled') && (
              <Form.Item
                name="webhook_url"
                label="Webhook URL"
                rules={[{ required: true, message: '请输入Webhook URL' }]}
              >
                <Input placeholder="https://hooks.slack.com/services/..." />
              </Form.Item>
            )
          }
        </Form.Item>

        <Divider />

        <h4 className="subsection-title">通知事件</h4>

        <Form.Item name="notify_on_success" label="备份成功时通知" valuePropName="checked">
          <Switch defaultChecked />
        </Form.Item>

        <Form.Item name="notify_on_failure" label="备份失败时通知" valuePropName="checked">
          <Switch defaultChecked />
        </Form.Item>

        <Button
          onClick={handleTestNotification}
          loading={testingNotification}
          className="mt-4"
        >
          发送测试通知
        </Button>
      </div>
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderDatabaseTypeStep();
      case 1:
        return renderConnectionStep();
      case 2:
        return renderBackupTypeStep();
      case 3:
        return renderScheduleStep();
      case 4:
        return renderStorageStep();
      case 5:
        return renderRetentionStep();
      case 6:
        return renderNotificationStep();
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return databaseForm.getFieldValue('database_type');
      case 1:
        return databaseForm.getFieldValue('host') && databaseForm.getFieldValue('database_name');
      default:
        return true;
    }
  };

  return (
    <div className="database-wizard">
      <div className="wizard-header">
        <h2 className="wizard-title">新建数据库向导</h2>
        <p className="wizard-description">按照步骤配置您的数据库备份计划</p>
      </div>

      <Steps
        current={currentStep}
        className="wizard-steps"
        items={STEPS.map((step, index) => ({
          title: step.title,
          icon: step.icon,
          status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
        }))}
      />

      <div className="wizard-content">
        <Form form={databaseForm} layout="vertical" className="wizard-form">
          {renderStepContent()}
        </Form>

        <Form form={scheduleForm} layout="vertical" className="wizard-form" style={{ display: 'none' }}>
        </Form>

        <Form form={storageForm} layout="vertical" className="wizard-form" style={{ display: 'none' }}>
        </Form>

        <Form form={retentionForm} layout="vertical" className="wizard-form" style={{ display: 'none' }}>
        </Form>

        <Form form={notificationForm} layout="vertical" className="wizard-form" style={{ display: 'none' }}>
        </Form>

        <Form form={backupConfigForm} layout="vertical" className="wizard-form" style={{ display: 'none' }}>
        </Form>
      </div>

      <div className="wizard-footer">
        <Space>
          {currentStep > 0 && (
            <Button onClick={handleBack}>
              上一步
            </Button>
          )}
          {onCancel && (
            <Button onClick={onCancel}>
              取消
            </Button>
          )}
        </Space>

        <Space>
          {currentStep === STEPS.length - 1 ? (
            <Button
              type="primary"
              onClick={handleSave}
              loading={loading}
              icon={<Save size={16} />}
            >
              保存并启动
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              下一步
            </Button>
          )}
        </Space>
      </div>

      <style>{`
        .database-wizard {
          background: var(--color-bg-primary);
          border-radius: var(--radius-lg);
          padding: 24px;
        }

        .wizard-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .wizard-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .wizard-description {
          color: var(--color-text-secondary);
        }

        .wizard-steps {
          margin-bottom: 32px;
        }

        .wizard-content {
          min-height: 400px;
        }

        .wizard-card {
          max-width: 700px;
          margin: 0 auto;
        }

        .step-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .step-description {
          color: var(--color-text-secondary);
          margin-bottom: 24px;
        }

        .database-type-selector,
        .backup-type-selector,
        .storage-type-selector,
        .schedule-type-selector {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .database-type-option,
        .backup-type-selector .ant-radio-button-wrapper,
        .storage-type-selector .ant-radio-button-wrapper {
          height: auto !important;
          padding: 16px 24px !important;
          border-radius: var(--radius-md) !important;
        }

        .database-type-content,
        .backup-type-content,
        .storage-type-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .database-type-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .database-type-icon.mysql {
          background: rgba(59, 89, 152, 0.1);
          color: #3b5998;
        }

        .database-type-icon.postgresql {
          background: rgba(51, 103, 145, 0.1);
          color: #336791;
        }

        .database-type-name,
        .backup-type-name {
          font-weight: 600;
          font-size: 16px;
        }

        .database-type-versions,
        .backup-type-desc {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .form-row {
          display: flex;
          gap: 16px;
        }

        .form-row .flex-1 {
          flex: 1;
        }

        .connection-test-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }

        .storage-options,
        .schedule-options {
          margin-top: 16px;
        }

        .subsection-title {
          font-size: 14px;
          font-weight: 600;
          margin: 16px 0 8px;
        }

        .cron-help {
          font-size: 12px;
        }

        .cron-help code {
          background: var(--color-bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }

        .retention-option {
          display: flex;
          flex-direction: column;
        }

        .retention-name {
          font-weight: 500;
        }

        .retention-desc {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .wizard-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .ml-2 {
          margin-left: 8px;
        }

        .mt-4 {
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
};

export default DatabaseWizard;