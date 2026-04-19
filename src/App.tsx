import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Databases } from './pages/Databases';
import { Backups } from './pages/Backups';
import { Settings } from './pages/Settings';
import { Restores } from './pages/Restores';
import { AppLayout } from './components/Layout';
import { useAuthStore } from './store';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <AppLayout>{children}</AppLayout>;
};

function App() {
  const { setUser, setToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // 从localStorage中恢复用户信息和token
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
      <Router>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/databases" element={<ProtectedRoute><Databases /></ProtectedRoute>} />
          <Route path="/backups" element={<ProtectedRoute><Backups /></ProtectedRoute>} />
          <Route path="/restores" element={<ProtectedRoute><Restores /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;