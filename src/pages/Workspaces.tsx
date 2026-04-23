import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space } from 'antd';
import { Plus, Edit2, Trash2, Users, Crown } from 'lucide-react';

interface Workspace {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMember {
  id: number;
  user_id: number;
  workspace_id: number;
  role: string;
  username: string;
  email: string;
}

const roleColors: Record<string, string> = {
  owner: 'gold',
  admin: 'red',
  member: 'blue',
  viewer: 'green',
};

const roleLabels: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  viewer: '查看者',
};

export const Workspaces: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [form] = Form.useForm();
  const [inviteForm] = Form.useForm();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:6001/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      message.error('获取工作空间列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (workspaceId: number) => {
    try {
      const response = await fetch(`http://localhost:6001/api/workspaces/${workspaceId}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      message.error('获取成员列表失败');
    }
  };

  const handleCreate = async (values: { name: string }) => {
    try {
      const response = await fetch('http://localhost:6001/api/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('工作空间创建成功');
        setCreateModalOpen(false);
        form.resetFields();
        fetchWorkspaces();
      } else {
        const data = await response.json();
        message.error(data.error || '创建失败');
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:6001/api/workspaces/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('工作空间已删除');
        fetchWorkspaces();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleInvite = async (values: { email: string; role: string }) => {
    if (!selectedWorkspace) return;
    try {
      const response = await fetch(`http://localhost:6001/api/workspaces/${selectedWorkspace.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (response.ok) {
        message.success('邀请成功');
        inviteForm.resetFields();
        setInviteModalOpen(false);
        fetchMembers(selectedWorkspace.id);
      } else {
        const data = await response.json();
        message.error(data.error || '邀请失败');
      }
    } catch (error) {
      message.error('邀请失败');
    }
  };

  const handleUpdateRole = async (memberId: number, newRole: string) => {
    if (!selectedWorkspace) return;
    try {
      const response = await fetch(`http://localhost:6001/api/workspaces/${selectedWorkspace.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        message.success('角色已更新');
        fetchMembers(selectedWorkspace.id);
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedWorkspace) return;
    try {
      const response = await fetch(`http://localhost:6001/api/workspaces/${selectedWorkspace.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        message.success('成员已移除');
        fetchMembers(selectedWorkspace.id);
      }
    } catch (error) {
      message.error('移除失败');
    }
  };

  const openMembersModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    fetchMembers(workspace.id);
    setMembersModalOpen(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Workspace) => (
        <Space>
          <Button
            type="text"
            icon={<Users size={16} />}
            onClick={() => openMembersModal(record)}
          >
            成员
          </Button>
          <Popconfirm
            title="确定删除此工作空间？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<Trash2 size={16} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const memberColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleColors[role] || 'default'}>
          {roleLabels[role] || role}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkspaceMember) => (
        record.role !== 'owner' && (
          <Space>
            <Select
              value={record.role}
              onChange={(value) => handleUpdateRole(record.id, value)}
              style={{ width: 100 }}
              options={[
                { value: 'viewer', label: '查看者' },
                { value: 'member', label: '成员' },
                { value: 'admin', label: '管理员' },
              ]}
            />
            <Button
              type="text"
              danger
              onClick={() => handleRemoveMember(record.id)}
            >
              移除
            </Button>
          </Space>
        )
      ),
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">工作空间</h1>
          <p className="page-description">管理和组织您的团队工作空间</p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setCreateModalOpen(true)}
        >
          创建工作空间
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={workspaces}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="创建工作空间"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            name="name"
            label="工作空间名称"
            rules={[{ required: true, message: '请输入工作空间名称' }]}
          >
            <Input placeholder="请输入工作空间名称" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`成员管理 - ${selectedWorkspace?.name}`}
        open={membersModalOpen}
        onCancel={() => {
          setMembersModalOpen(false);
          setSelectedWorkspace(null);
          setMembers([]);
        }}
        footer={[
          <Button key="invite" type="primary" onClick={() => setInviteModalOpen(true)}>
            邀请成员
          </Button>,
          <Button key="close" onClick={() => setMembersModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <Table
          columns={memberColumns}
          dataSource={members}
          rowKey="id"
          pagination={false}
        />
      </Modal>

      <Modal
        title="邀请成员"
        open={inviteModalOpen}
        onCancel={() => {
          setInviteModalOpen(false);
          inviteForm.resetFields();
        }}
        footer={null}
      >
        <Form form={inviteForm} onFinish={handleInvite} layout="vertical">
          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="viewer">查看者</Select.Option>
              <Select.Option value="member">成员</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              邀请
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};