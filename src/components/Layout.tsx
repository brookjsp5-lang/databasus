import React, { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut, Bell } from 'lucide-react';
import { Layout as AntLayout, Drawer } from 'antd';
import { useAuthStore } from '../store';
import { WorkspaceSelector } from './WorkspaceSelector';

const { Header, Sider, Content } = AntLayout;

/**
 * Layout组件属性接口
 * @description 定义布局组件的props
 */
interface LayoutProps {
  children: ReactNode;
}

/**
 * 菜单项类型定义
 * @description 侧边栏导航菜单项
 */
interface MenuItem {
  key: string;
  icon: string;
  label: string;
  path?: string;
  children?: MenuItem[];
}

/**
 * 菜单配置
 * @description 应用程序的主要导航菜单项
 */
const menuItems: MenuItem[] = [
  { key: 'dashboard', icon: '◇', label: '仪表盘', path: '/dashboard' },
  { key: 'backup-center', icon: '▣', label: '备份中心', path: '/backup-center' },
  { key: 'restores', icon: '▧', label: 'PITR恢复', path: '/restores' },
  { key: 'storages', icon: '▥', label: '存储管理', path: '/storages' },
  { key: 'alerts', icon: '⚠', label: '告警通知', path: '/alerts' },
  { key: 'audit-logs', icon: '📋', label: '审计日志', path: '/audit-logs' },
  { key: 'settings', icon: '⚙', label: '系统设置', path: '/settings' },
];

/**
 * 移动端断点
 * @description 小于此宽度时显示移动端布局
 */
const MOBILE_BREAKPOINT = 768;

/**
 * AppLayout 主布局组件
 *
 * @description 提供应用程序的整体布局结构
 * - 顶部导航栏（Logo、工作空间选择器、通知、用户菜单）
 * - 侧边栏（导航菜单）
 * - 主内容区域
 * - 支持桌面端和移动端自适应
 *
 * @example
 * ```tsx
 * <AppLayout>
 *   <Dashboard />
 * </AppLayout>
 * ```
 */
export const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // 侧边栏展开状态（桌面端）
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 用户下拉菜单状态
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // 移动端抽屉状态
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // 是否为移动端
  const [isMobile, setIsMobile] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      // 移动端默认关闭侧边栏
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    // 初始检查
    checkMobile();

    // 添加监听器
    window.addEventListener('resize', checkMobile);

    // 清理
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 获取当前路由
  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  /**
   * 处理登出
   * @description 清除用户状态和本地存储
   */
  const handleLogout = () => {
    logout();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setDropdownOpen(false);
  };

  /**
   * 渲染菜单项
   * @description 渲染侧边栏导航菜单项，支持子菜单
   */
  const renderMenuItem = (item: MenuItem, index: number, isChild: boolean = false) => {
    if (item.children) {
      return (
        <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isChild ? '8px 16px 8px 44px' : '12px 16px',
              borderRadius: '8px',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: '500',
              fontSize: '14px',
              animation: sidebarOpen ? `slide-in-right 0.3s ease-out ${index * 0.05}s both` : 'none',
              opacity: sidebarOpen ? 1 : 0,
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
          </div>
          {item.children.map((child, childIndex) => renderMenuItem(child, childIndex, true))}
        </div>
      );
    }

    const isActive = currentPath === item.key;
    return (
      <Link
        key={item.key}
        to={item.path || '#'}
        className={`cyber-menu-item ${isActive ? 'active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: isChild ? '8px 16px 8px 44px' : '12px 16px',
          borderRadius: '8px',
          textDecoration: 'none',
          color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
          background: isActive ? 'var(--color-primary-bg)' : 'transparent',
          transition: 'all 0.2s ease',
          animation: sidebarOpen ? `slide-in-right 0.3s ease-out ${index * 0.05}s both` : 'none',
          opacity: sidebarOpen ? 1 : 0,
          fontFamily: 'var(--font-body)',
          fontWeight: isActive ? '600' : '500',
          fontSize: '14px',
        }}
        onClick={() => {
          if (isMobile) {
            setMobileDrawerOpen(false);
          }
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
  };

  /**
   * 渲染侧边栏内容
   * @description 渲染导航菜单和状态信息
   */
  const renderSidebarContent = () => (
    <>
      <nav style={{
        padding: '16px 12px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {menuItems.map((item, index) => renderMenuItem(item, index))}
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
    </>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-dark)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部导航栏 */}
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
          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
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
            <Menu size={20} />
          </button>

          {/* 桌面端侧边栏切换按钮 */}
          {!isMobile && (
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
          )}

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
                DataTrue
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

          {/* 工作空间选择器 - 桌面端显示 */}
          {!isMobile && (
            <div style={{ marginLeft: '16px' }}>
              <WorkspaceSelector />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* 通知按钮 */}
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

          {/* 用户下拉菜单 */}
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

      {/* 主体内容区域 */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* 桌面端侧边栏 */}
        {!isMobile && (
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
            {renderSidebarContent()}
          </aside>
        )}

        {/* 移动端抽屉 */}
        {isMobile && (
          <Drawer
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #00c8d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '700',
                  fontSize: '14px',
                  color: 'var(--color-bg-dark)'
                }}>
                  D
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  DataTrue
                </span>
              </div>
            }
            placement="left"
            onClose={() => setMobileDrawerOpen(false)}
            open={mobileDrawerOpen}
            width={280}
            styles={{
              header: {
                background: 'var(--color-bg-sidebar)',
                borderBottom: '1px solid var(--color-border-light)',
              },
              body: {
                background: 'var(--color-bg-sidebar)',
                padding: '12px',
              },
            }}
            closeIcon={<X size={20} />}
          >
            {/* 移动端工作空间选择器 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
              <WorkspaceSelector />
            </div>
            {renderSidebarContent()}
          </Drawer>
        )}

        {/* 主内容区域 */}
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
