/**
 * AuthPage - 用户认证页面组件
 * 
 * @description 提供用户登录和注册功能：
 * - 登录表单（邮箱+密码）
 * - 注册表单（用户名+邮箱+密码）
 * - 表单验证和数据提交
 * - 登录状态管理和Token存储
 * 
 * @module pages/AuthPage
 * @requires React
 * @requires antd (Form, Input, Button, Typography, Tabs, message)
 * @requires lucide-react (图标)
 * @requires services/api (authAPI)
 * @requires store (useAuthStore)
 */

import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Tabs } from 'antd';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store';

const { Title, Text, Paragraph } = Typography;

/**
 * 登录表单数据接口
 * @description 定义登录表单的数据结构
 */
interface LoginFormValues {
  /** 用户邮箱 */
  email: string;
  /** 用户密码 */
  password: string;
}

/**
 * 注册表单数据接口
 * @description 定义注册表单的数据结构
 */
interface RegisterFormValues {
  /** 用户名 */
  username: string;
  /** 用户邮箱 */
  email: string;
  /** 用户密码 */
  password: string;
}

/**
 * AuthPage 认证页面组件
 * 
 * @description 用户认证主组件，提供登录和注册功能
 * - 支持Tab切换登录/注册表单
 * - 表单验证和错误提示
 * - 登录成功后自动跳转仪表盘
 * 
 * @example
 * ```tsx
 * <AuthPage />
 * ```
 */
export const AuthPage: React.FC = () => {
  /** 当前激活的Tab: 'login' | 'register' */
  const [activeTab, setActiveTab] = useState('login');
  /** 提交按钮加载状态 */
  const [loading, setLoading] = useState(false);
  /** Auth store，用于存储用户状态 */
  const { setUser, setToken } = useAuthStore();

  /**
   * 处理用户登录
   * @description 验证表单数据，调用登录API，成功后存储Token并跳转
   * @param values - 表单数据（邮箱、密码）
   */
  const handleLogin = async (values: LoginFormValues) => {
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

  /**
   * 处理用户注册
   * @description 验证表单数据，调用注册API，成功后存储Token并跳转
   * @param values - 表单数据（用户名、邮箱、密码）
   */
  const handleRegister = async (values: RegisterFormValues) => {
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
    <Form onFinish={handleLogin} layout="vertical" size="large">
      <Form.Item
        name="email"
        label="邮箱地址"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '请输入有效的邮箱地址' }
        ]}
      >
        <Input 
          prefix={<Mail size={18} className="text-tertiary" />}
          placeholder="admin@example.com"
          className="auth-input"
        />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password 
          prefix={<Lock size={18} className="text-tertiary" />}
          placeholder="输入密码"
          className="auth-input"
        />
      </Form.Item>
      <Form.Item style={{ marginTop: '24px' }}>
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading} 
          block
          className="auth-submit-btn"
        >
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  const registerForm = (
    <Form onFinish={handleRegister} layout="vertical" size="large">
      <Form.Item
        name="username"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' }, 
          { min: 3, message: '用户名至少3个字符' }
        ]}
      >
        <Input 
          prefix={<User size={18} className="text-tertiary" />}
          placeholder="设置用户名"
          className="auth-input"
        />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱地址"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '请输入有效的邮箱地址' }
        ]}
      >
        <Input 
          prefix={<Mail size={18} className="text-tertiary" />}
          placeholder="admin@example.com"
          className="auth-input"
        />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' }, 
          { min: 6, message: '密码至少6个字符' }
        ]}
      >
        <Input.Password 
          prefix={<Lock size={18} className="text-tertiary" />}
          placeholder="设置密码"
          className="auth-input"
        />
      </Form.Item>
      <Form.Item style={{ marginTop: '24px' }}>
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading} 
          block
          className="auth-submit-btn"
        >
          创建账户
        </Button>
      </Form.Item>
    </Form>
  );

  const tabItems = [
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
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-gradient"></div>
        <div className="auth-pattern"></div>
      </div>
      
      <div className="auth-content">
        <div className="auth-card animate-scale-in">
          <div className="auth-header">
            <div className="auth-logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="var(--color-primary)"/>
                <path d="M14 24L20 30L34 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <Title level={2} className="auth-title">DataBus</Title>
            <Text className="auth-subtitle">数据库备份与恢复系统</Text>
          </div>

          <div className="auth-tabs">
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              items={tabItems}
              centered
              className="auth-tabs-component"
            />
          </div>

          <div className="auth-footer">
            <div className="auth-info">
              <AlertCircle size={14} />
              <Text className="text-xs">
                安全的数据库备份解决方案，保护您的关键数据资产
              </Text>
            </div>
          </div>
        </div>

        <div className="auth-features animate-slide-up">
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ background: 'var(--color-success-bg)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 0L12.2451 6.90983H19.5106L13.6327 11.1803L15.8779 18.0902L10 13.8197L4.12215 18.0902L6.36729 11.1803L0.489435 6.90983H7.75486L10 0Z" fill="var(--color-success)"/>
              </svg>
            </div>
            <div>
              <Text strong className="auth-feature-title">企业级安全</Text>
              <Text className="auth-feature-desc">端到端加密保护</Text>
            </div>
          </div>
          
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ background: 'var(--color-primary-bg)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 12V18H7V12H3ZM3 6V8H17V6H3ZM5 14V16H9V14H5ZM11 14V16H15V14H11ZM5 10V12H15V10H5Z" fill="var(--color-primary)"/>
              </svg>
            </div>
            <div>
              <Text strong className="auth-feature-title">实时监控</Text>
              <Text className="auth-feature-desc">24/7 状态监控</Text>
            </div>
          </div>
          
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ background: 'var(--color-warning-bg)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 0L0 7V13L10 20L20 13V7L10 0ZM10 17L3 12V8L10 3L17 8V12L10 17Z" fill="var(--color-warning)"/>
              </svg>
            </div>
            <div>
              <Text strong className="auth-feature-title">快速恢复</Text>
              <Text className="auth-feature-desc">即时点时间恢复</Text>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .auth-background {
          position: absolute;
          inset: 0;
          z-index: 0;
        }

        .auth-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            var(--color-primary-bg) 0%, 
            var(--color-bg-base) 50%, 
            var(--color-info-bg) 100%
          );
        }

        .auth-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 1px 1px, var(--color-border-light) 1px, transparent 0);
          background-size: 32px 32px;
          opacity: 0.5;
        }

        .auth-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
        }

        .auth-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-2xl);
          padding: 48px 40px;
          box-shadow: var(--shadow-2xl);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-logo {
          margin-bottom: 16px;
        }

        .auth-title {
          font-family: var(--font-display);
          font-size: 28px !important;
          font-weight: 800 !important;
          color: var(--color-text-primary);
          margin: 0 0 8px 0 !important;
          letter-spacing: -0.5px;
        }

        .auth-subtitle {
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .auth-tabs {
          margin-bottom: 24px;
        }

        .auth-tabs-component .ant-tabs-nav {
          margin-bottom: 24px;
        }

        .auth-input {
          height: 44px;
          font-size: 15px;
        }

        .auth-submit-btn {
          height: 44px;
          font-size: 15px;
          font-weight: 600;
          border-radius: var(--radius-lg);
        }

        .auth-footer {
          padding-top: 24px;
          border-top: 1px solid var(--color-border-light);
        }

        .auth-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--color-text-tertiary);
        }

        .auth-features {
          margin-top: 32px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .auth-feature {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: 20px 16px;
          text-align: center;
          transition: all var(--transition-base);
        }

        .auth-feature:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .auth-feature-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .auth-feature-title {
          display: block;
          font-size: 13px;
          color: var(--color-text-primary);
          margin-bottom: 4px;
        }

        .auth-feature-desc {
          display: block;
          font-size: 11px;
          color: var(--color-text-tertiary);
        }

        @media (max-width: 768px) {
          .auth-card {
            padding: 32px 24px;
          }

          .auth-features {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .auth-feature {
            display: flex;
            align-items: center;
            gap: 12px;
            text-align: left;
            padding: 16px;
          }

          .auth-feature-icon {
            margin: 0;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
};
