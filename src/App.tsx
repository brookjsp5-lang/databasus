import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { BackupCenter } from './pages/BackupCenter';
import { Settings } from './pages/Settings';
import { Restores } from './pages/Restores';
import { Storages } from './pages/Storages';
import { Alerts } from './pages/Alerts';
import { AuditLogs } from './pages/AuditLogs';
import { DatabaseWizard } from './pages/DatabaseWizard';
import { UserGuide } from './pages/UserGuide';
import { AppLayout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store';

/**
 * 受保护的路由组件
 * @description 检查用户是否已认证，未认证则重定向到登录页
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <AppLayout>{children}</AppLayout>;
};

/**
 * 全局错误处理回调
 * @description 记录全局错误信息
 */
const globalErrorHandler = (error: Error, errorInfo: React.ErrorInfo) => {
  console.error('Global error caught:', error, errorInfo);
  // 可以在这里发送错误报告到服务器
};

/**
 * App 主应用组件
 * @description 应用程序入口点，包含路由配置和全局状态初始化
 */
function App() {
  const { setUser, setToken, isAuthenticated } = useAuthStore();

  /**
   * 初始化用户状态
   * @description 从localStorage恢复用户登录状态
   */
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setUser(user);
        setToken(token);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [setUser, setToken]);

  return (
    <ConfigProvider locale={zhCN}>
      {/* 全局错误边界，捕获所有未处理的错误 */}
      <ErrorBoundary onError={globalErrorHandler} showDetails={import.meta.env.DEV}>
        <Router>
          <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<AuthPage />} />
            
            {/* 受保护的路由 */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/backup-center" element={<ProtectedRoute><BackupCenter /></ProtectedRoute>} />
            <Route path="/restores" element={<ProtectedRoute><Restores /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/storages" element={<ProtectedRoute><Storages /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/user-guide" element={<ProtectedRoute><UserGuide /></ProtectedRoute>} />
            <Route path="/database-wizard" element={<ProtectedRoute><DatabaseWizard /></ProtectedRoute>} />
            
            {/* 默认重定向 */}
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </ConfigProvider>
  );
}

export default App;
