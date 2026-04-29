import React, { useEffect, useState, useCallback } from 'react';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  Building2,
  Plus,
  ChevronDown,
  Check,
  Loader,
} from 'lucide-react';
import { workspaceAPI } from '../services/api';
import { useWorkspaceStore, Workspace } from '../store';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';

/**
 * WorkspaceSelector - 工作空间选择器组件
 *
 * @description 提供工作空间查看、切换和创建功能：
 * - 显示当前选中的工作空间
 * - 下拉列表展示所有可访问的工作空间
 * - 支持快速切换工作空间
 * - 提供创建工作空间的入口
 *
 * @module components/WorkspaceSelector
 */
export const WorkspaceSelector: React.FC = () => {
  const {
    workspaces,
    currentWorkspace,
    loading,
    setWorkspaces,
    setCurrentWorkspace,
    setLoading,
    setError,
  } = useWorkspaceStore();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /**
   * 获取工作空间列表
   * @description 从后端API获取工作空间列表并更新状态
   */
  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await workspaceAPI.getAll();
      const workspaceList = response.workspaces || [];
      setWorkspaces(workspaceList);

      // 如果没有选中工作空间，自动选中第一个
      if (!currentWorkspace && workspaceList.length > 0) {
        setCurrentWorkspace(workspaceList[0]);
      }
    } catch (error: any) {
      console.error('Failed to fetch workspaces:', error);
      setError(error.response?.data?.error || '获取工作空间失败');
      message.error('获取工作空间列表失败');
    } finally {
      setLoading(false);
    }
  }, [
    currentWorkspace,
    setWorkspaces,
    setCurrentWorkspace,
    setLoading,
    setError,
  ]);

  /**
   * 组件挂载时获取工作空间列表
   */
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  /**
   * 处理工作空间切换
   * @param workspace - 要切换到的目标工作空间
   */
  const handleWorkspaceChange = useCallback(
    (workspace: Workspace) => {
      if (workspace.id === currentWorkspace?.id) return;
      setCurrentWorkspace(workspace);
      message.success(`已切换到工作空间: ${workspace.name}`);
      setDropdownOpen(false);
    },
    [currentWorkspace, setCurrentWorkspace]
  );

  /**
   * 处理工作空间创建成功
   * @param workspace - 新创建的工作空间
   */
  const handleCreateSuccess = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspace(workspace);
      fetchWorkspaces();
      message.success(`工作空间 "${workspace.name}" 创建成功`);
    },
    [setCurrentWorkspace, fetchWorkspaces]
  );

  /**
   * 构建下拉菜单项
   */
  const dropdownItems: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border-light)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
          }}
        >
          选择工作空间
        </div>
      ),
      disabled: true,
    },
    ...(workspaces.map((workspace) => ({
      key: workspace.id,
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '4px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflow: 'hidden',
            }}
          >
            <Building2
              size={16}
              style={{
                color:
                  workspace.id === currentWorkspace?.id
                    ? 'var(--color-primary)'
                    : 'var(--color-text-muted)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight:
                  workspace.id === currentWorkspace?.id ? 600 : 400,
                color:
                  workspace.id === currentWorkspace?.id
                    ? 'var(--color-primary)'
                    : 'var(--color-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {workspace.name}
            </span>
          </div>
          {workspace.id === currentWorkspace?.id && (
            <Check
              size={16}
              style={{ color: 'var(--color-primary)', flexShrink: 0 }}
            />
          )}
        </div>
      ),
      onClick: () => handleWorkspaceChange(workspace),
    })) as MenuProps['items']),
    { type: 'divider' as const, key: 'divider' },
    {
      key: 'create',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 0',
            color: 'var(--color-primary)',
          }}
        >
          <Plus size={16} />
          <span>创建工作空间</span>
        </div>
      ),
      onClick: () => {
        setCreateModalVisible(true);
        setDropdownOpen(false);
      },
    },
  ];

  // 加载状态展示
  if (loading && workspaces.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          color: 'var(--color-text-muted)',
        }}
      >
        <Loader size={16} className="animate-spin" />
        <span style={{ fontSize: '14px' }}>加载中...</span>
      </div>
    );
  }

  return (
    <>
      <Dropdown
        menu={{ items: dropdownItems }}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        placement="bottomLeft"
        trigger={['click']}
        dropdownRender={(menu) => (
          <div
            className="cyber-dropdown"
            style={{
              background: 'var(--color-bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              minWidth: '240px',
              maxWidth: '320px',
              overflow: 'hidden',
            }}
          >
            {menu}
          </div>
        )}
      >
        <button
          type="button"
          aria-label="选择工作空间"
          aria-expanded={dropdownOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            background: 'rgba(0, 240, 255, 0.05)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'var(--color-text)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          <Building2
            size={18}
            style={{ color: 'var(--color-primary)', flexShrink: 0 }}
          />
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '140px',
              }}
            >
              {currentWorkspace?.name || '选择工作空间'}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
              }}
            >
              {workspaces.length > 0
                ? `${workspaces.length} 个工作空间`
                : '暂无工作空间'}
            </div>
          </div>
          <ChevronDown
            size={16}
            style={{
              color: 'var(--color-text-muted)',
              flexShrink: 0,
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </Dropdown>

      <WorkspaceCreateModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};
