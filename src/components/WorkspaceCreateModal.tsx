import React, { useState, useCallback } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { Building2, Loader } from 'lucide-react';
import { workspaceAPI } from '../services/api';
import { Workspace } from '../store';

/**
 * WorkspaceCreateModalProps - 创建工作空间模态框属性
 */
interface WorkspaceCreateModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 取消回调 */
  onCancel: () => void;
  /** 创建成功回调 */
  onSuccess: (workspace: Workspace) => void;
}

/**
 * WorkspaceCreateModal - 工作空间创建模态框
 *
 * @description 提供工作空间创建表单：
 * - 工作空间名称输入（必填）
 * - 工作空间描述输入（可选）
 * - 表单验证
 * - 提交创建请求
 *
 * @module components/WorkspaceCreateModal
 */
export const WorkspaceCreateModal: React.FC<WorkspaceCreateModalProps> = ({
  visible,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  /**
   * 处理表单提交
   */
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await workspaceAPI.create({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      });

      if (response.workspace) {
        onSuccess(response.workspace as Workspace);
        form.resetFields();
      } else {
        message.error('创建工作空间失败：响应数据异常');
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误，不显示全局消息
        return;
      }
      console.error('Failed to create workspace:', error);
      message.error(
        error.response?.data?.error || '创建工作空间失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  }, [form, onSuccess]);

  /**
   * 处理取消
   */
  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          <Building2 size={22} style={{ color: 'var(--color-primary)' }} />
          创建工作空间
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={480}
      styles={{
        header: {
          borderBottom: '1px solid var(--color-border-light)',
          padding: '20px 24px',
        },
        body: {
          padding: '24px',
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        },
      }}
      style={{
        top: 100,
      }}
    >
      <div
        style={{
          marginBottom: '20px',
          padding: '12px 16px',
          background: 'rgba(0, 240, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          工作空间用于隔离不同项目或团队的数据资源。创建工作空间后，您可以在其中管理数据库、备份和存储配置。
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="name"
          label="工作空间名称"
          rules={[
            { required: true, message: '请输入工作空间名称' },
            { min: 2, message: '名称至少2个字符' },
            { max: 50, message: '名称最多50个字符' },
            {
              pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/,
              message: '名称只能包含中文、字母、数字、下划线和横线',
            },
          ]}
        >
          <Input
            placeholder="例如：生产环境、测试团队"
            size="large"
            style={{
              background: 'var(--color-bg-input)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
            disabled={loading}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述（可选）"
          rules={[{ max: 200, message: '描述最多200个字符' }]}
        >
          <Input.TextArea
            placeholder="简要描述工作空间的用途..."
            rows={3}
            style={{
              background: 'var(--color-bg-input)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
              resize: 'none',
            }}
            disabled={loading}
          />
        </Form.Item>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <Button
            size="large"
            onClick={handleCancel}
            disabled={loading}
            style={{
              background: 'transparent',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={handleSubmit}
            loading={loading}
            disabled={loading}
            style={{
              background: 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              minWidth: '120px',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader size={16} className="animate-spin" />
                创建中...
              </span>
            ) : (
              '创建工作空间'
            )}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
