import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Switch, message, Tabs, Progress } from 'antd';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { settingsAPI, authAPI } from '../services/api';
import { useAuthStore } from '../store';

interface UserProfile {
  username: string;
  email: string;
}

const passwordStrengthLabels = ['弱', '中等', '强', '非常强'];
const passwordStrengthColors = ['#ff4d4f', '#faad14', '#52c41a', '#13c41a'];

const checkPasswordStrength = (password: string): number => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  return Math.min(score, 4);
};

export const Settings: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
        email: user.email
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const values = await profileForm.validateFields();
      await authAPI.updateProfile({
        username: values.username,
        email: values.email
      });
      message.success('个人资料已保存');
      if (user) {
        const updatedUser = { ...user, username: values.username, email: values.email };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setLoading(true);
    try {
      const values = await passwordForm.validateFields();
      if (values.new_password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        setLoading(false);
        return;
      }
      if (values.new_password !== newPassword) {
        message.error('密码强度不足');
        setLoading(false);
        return;
      }
      await authAPI.changePassword({
        current_password: values.current_password,
        new_password: values.new_password
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
      setNewPassword('');
      setPasswordStrength(0);
    } catch (error: any) {
      if (error?.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('修改密码失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'profile',
      label: <span className="flex items-center gap-2"><User size={16} />个人资料</span>,
      children: (
        <Card title={<span className="flex items-center gap-2"><User size={18} />个人信息</span>}>
          <Form form={profileForm} layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="请输入用户名" prefix={<User size={16} className="text-tertiary" />} />
            </Form.Item>
            <Form.Item name="email" label="邮箱地址" rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}>
              <Input placeholder="请输入邮箱地址" prefix={<span style={{ color: 'var(--color-text-muted)' }}>@</span>} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveProfile} loading={loading}>
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )
    },
    {
      key: 'password',
      label: <span className="flex items-center gap-2"><Lock size={16} />修改密码</span>,
      children: (
        <Card title={<span className="flex items-center gap-2"><Lock size={18} />修改密码</span>}>
          <Form form={passwordForm} layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item name="current_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
              <Input.Password
                placeholder="请输入当前密码"
                prefix={<Lock size={16} className="text-tertiary" />}
                iconRender={(visible) => visible ? <Eye size={16} /> : <EyeOff size={16} />}
              />
            </Form.Item>
            <Form.Item label="新密码" rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度至少8位' }
            ]}>
              <Input.Password
                placeholder="请输入新密码"
                prefix={<Lock size={16} className="text-tertiary" />}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordStrength(checkPasswordStrength(e.target.value));
                }}
                iconRender={(visible) => visible ? <Eye size={16} /> : <EyeOff size={16} />}
              />
            </Form.Item>
            {newPassword && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-secondary">密码强度</span>
                  <span style={{ color: passwordStrengthColors[passwordStrength], fontSize: 12 }}>
                    {passwordStrengthLabels[passwordStrength]}
                  </span>
                </div>
                <Progress
                  percent={(passwordStrength + 1) * 20}
                  showInfo={false}
                  strokeColor={passwordStrengthColors[passwordStrength]}
                  trailColor="var(--color-bg-hover)"
                  size="small"
                />
                <div className="text-xs text-tertiary mt-1">
                  建议：使用8位以上，包含大小写字母、数字和特殊字符
                </div>
              </div>
            )}
            <Form.Item
              name="confirm_password"
              label="确认新密码"
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                placeholder="请再次输入新密码"
                prefix={<Lock size={16} className="text-tertiary" />}
                iconRender={(visible) => visible ? <Eye size={16} /> : <EyeOff size={16} />}
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                onClick={handleChangePassword}
                loading={loading}
                disabled={passwordStrength < 2}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">系统设置</h1>
        <p className="page-description">管理个人资料和安全设置</p>
      </div>

      <Card>
        <Tabs defaultActiveKey="profile" items={tabItems} />
      </Card>
    </div>
  );
};