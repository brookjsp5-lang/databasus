import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Tabs, Row, Col } from 'antd';
import { Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store';

const { Title, Text } = Typography;

export const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const { setUser, setToken } = useAuthStore();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const response = await authAPI.login(values);
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      message.success('登录成功');
      window.location.href = '/dashboard';
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; email: string; password: string }) => {
    setLoading(true);
    try {
      const response = await authAPI.register(values);
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      message.success('注册成功');
      window.location.href = '/dashboard';
    } catch (error: any) {
      message.error(error.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const loginForm = (
    <Form onFinish={handleLogin} layout="vertical">
      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
      >
        <Input prefix={<Mail className="w-4 h-4" />} placeholder="请输入邮箱" />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<Lock className="w-4 h-4" />}
          placeholder="请输入密码"
          iconRender={(visible) => (visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  const registerForm = (
    <Form onFinish={handleRegister} layout="vertical">
      <Form.Item
        name="username"
        label="用户名"
        rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '用户名至少3个字符' }]}
      >
        <Input prefix={<User className="w-4 h-4" />} placeholder="请输入用户名" />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
      >
        <Input prefix={<Mail className="w-4 h-4" />} placeholder="请输入邮箱" />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6个字符' }]}
      >
        <Input.Password
          prefix={<Lock className="w-4 h-4" />}
          placeholder="请输入密码"
          iconRender={(visible) => (visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />)}
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          注册
        </Button>
      </Form.Item>
    </Form>
  );

  const items = [
    {
      key: 'login',
      label: '登录',
      children: loginForm,
    },
    {
      key: 'register',
      label: '注册',
      children: registerForm,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Row justify="center" align="middle" style={{ width: '100%' }}>
        <Col xs={24} sm={16} md={12} lg={8}>
          <Card
            title={
              <div style={{ textAlign: 'center' }}>
                <Title level={3}>Databasus 数据库管理系统</Title>
                <Text type="secondary">登录或注册以开始使用</Text>
              </div>
            }
            style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
          >
            <Tabs activeKey={activeTab} onChange={setActiveTab} centered items={items} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};