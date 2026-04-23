import React, { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut, Bell } from 'lucide-react';
import { Layout as AntLayout } from 'antd';
import { useAuthStore } from '../store';

const { Header, Sider, Content } = AntLayout;

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { key: 'dashboard', icon: '◇', label: '仪表盘', path: '/dashboard' },
  { key: 'backup-center', icon: '▣', label: '备份中心', path: '/backup-center' },
  { key: 'restores', icon: '▧', label: 'PITR恢复', path: '/restores' },
  { key: 'storages', icon: '▥', label: '存储管理', path: '/storages' },
  { key: 'alerts', icon: '⚠', label: '告警通知', path: '/alerts' },
  { key: 'audit-logs', icon: '📋', label: '审计日志', path: '/audit-logs' },
  { key: 'settings', icon: '⚙', label: '系统设置', path: '/settings' },
];

export const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  const handleLogout = () => {
    logout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-dark)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header className="cyber-header" style={{
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #00c8d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: '700',
              fontSize: '18px',
              color: 'var(--color-bg-dark)'
            }}>
              D
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--color-text)',
                letterSpacing: '2px'
              }}>
                DATABASUS
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                Database Management System
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '8px',
            position: 'relative',
            transition: 'color 0.3s ease'
          }}>
            <Bell size={20} />
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-accent)'
            }} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                transition: 'background 0.3s ease'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: '600',
                fontSize: '14px',
                color: 'var(--color-bg-dark)'
              }}>
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text)'
              }}>
                {user?.username || 'User'}
              </span>
              <ChevronDown size={16} style={{
                color: 'var(--color-text-muted)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease'
              }} />
            </button>

            {dropdownOpen && (
              <div className="cyber-dropdown" style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '8px',
                minWidth: '180px',
                animation: 'slide-in-up 0.2s ease-out'
              }}>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-error)',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    transition: 'background 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 51, 102, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} />
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <aside
          className="cyber-sidebar"
          style={{
            width: sidebarOpen ? '240px' : '0',
            minHeight: 'calc(100vh - 64px)',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            position: 'sticky',
            top: '64px',
            height: 'calc(100vh - 64px)',
            background: 'var(--color-bg-sidebar)',
            borderRight: '1px solid var(--color-border-light)'
          }}
        >
          <nav style={{ 
            padding: '16px 12px 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {menuItems.map((item, index) => {
              const isActive = currentPath === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`cyber-menu-item ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                    background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                    transition: 'all 0.2s ease',
                    animation: sidebarOpen ? `slide-in-right 0.3s ease-out ${index * 0.05}s both` : 'none',
                    opacity: sidebarOpen ? 1 : 0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: isActive ? '600' : '500',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--color-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    fontSize: '18px',
                    width: '24px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span style={{
                      marginLeft: 'auto',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)'
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>

          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '12px',
            right: '12px',
            padding: '16px',
            background: 'rgba(0, 240, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px'
            }}>
              系统状态
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                boxShadow: '0 0 10px var(--color-success)'
              }} />
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>正常运行</span>
            </div>
          </div>
        </aside>

        <main style={{
          flex: 1,
          padding: '24px',
          minHeight: 'calc(100vh - 64px)',
          background: 'var(--color-bg-dark)',
          position: 'relative',
          overflow: 'auto'
        }}>
          <div className="cyber-grid-bg" style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.5
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};