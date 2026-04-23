import React, { useEffect, useState } from 'react';
import { Row, Col, Table, Tag, Progress, Card } from 'antd';
import { Database, HardDrive, CheckCircle, Server, TrendingUp, Clock } from 'lucide-react';
import { statsAPI, backupAPI } from '../services/api';

interface StatsData {
  total_databases: number;
  total_backups: number;
  success_rate: number;
  storage_used: number;
  storage_total: number;
  active_backups: number;
  failed_backups: number;
  pending_backups: number;
  recent_backups_count: number;
  total_restores: number;
  success_restores: number;
  failed_restores: number;
}

interface RecentBackup {
  id: number;
  database: string;
  type: string;
  status: string;
  size: string;
  time: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentBackups, setRecentBackups] = useState<RecentBackup[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, backupsData] = await Promise.all([
        statsAPI.getDashboardStats(1).catch(() => null),
        backupAPI.getAll().catch(() => null)
      ]);

      if (statsData) {
        setStats(statsData);
      } else {
        setStats({
          total_databases: 0,
          total_backups: 0,
          success_rate: 0,
          storage_used: 0,
          storage_total: 500,
          active_backups: 0,
          failed_backups: 0,
          pending_backups: 0,
          recent_backups_count: 0,
          total_restores: 0,
          success_restores: 0,
          failed_restores: 0
        });
      }

      if (backupsData?.backups) {
        const formattedBackups: RecentBackup[] = backupsData.backups.slice(0, 5).map((backup: any) => ({
          id: backup.id,
          database: `DB-${backup.database_id}`,
          type: backup.backup_type === 'physical' ? '物理备份' : '逻辑备份',
          status: backup.status,
          size: backup.file_size ? `${(backup.file_size / 1024 / 1024).toFixed(2)} MB` : '-',
          time: new Date(backup.created_at).toLocaleString()
        }));
        setRecentBackups(formattedBackups);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setStats({
        total_databases: 0,
        total_backups: 0,
        success_rate: 0,
        storage_used: 0,
        storage_total: 500,
        active_backups: 0,
        failed_backups: 0,
        pending_backups: 0,
        recent_backups_count: 0,
        total_restores: 0,
        success_restores: 0,
        failed_restores: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: '数据库总数',
      value: stats?.total_databases || 0,
      icon: Database,
      color: 'var(--color-primary)',
      trend: '+2',
      trendDirection: 'up'
    },
    {
      label: '备份任务',
      value: stats?.total_backups || 0,
      icon: HardDrive,
      color: 'var(--color-info)',
      trend: '+12',
      trendDirection: 'up'
    },
    {
      label: '成功率',
      value: `${(stats?.success_rate || 0).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'var(--color-success)',
      trend: '+0.5%',
      trendDirection: 'up'
    },
    {
      label: '存储使用',
      value: `${(stats?.storage_used || 0).toFixed(2)}GB`,
      icon: Server,
      color: 'var(--color-warning)',
      trend: `${Math.round(((stats?.storage_used || 0) / (stats?.storage_total || 500)) * 100)}%`,
      trendDirection: 'neutral'
    },
  ];

  const columns = [
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
      render: (text: string) => (
        <div className="flex items-center gap-3">
          <div className="database-icon">
            <Database size={16} />
          </div>
          <span className="font-medium">{text}</span>
        </div>
      )
    },
    {
      title: '备份类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <Tag className="backup-type-tag">{text}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string; bg: string }> = {
          success: { color: 'var(--color-success)', text: '成功', bg: 'var(--color-success-bg)' },
          failed: { color: 'var(--color-danger)', text: '失败', bg: 'var(--color-danger-bg)' },
          running: { color: 'var(--color-primary)', text: '进行中', bg: 'var(--color-primary-bg)' },
          pending: { color: 'var(--color-warning)', text: '等待中', bg: 'var(--color-warning-bg)' }
        };
        const config = statusConfig[status] || { color: 'var(--color-text-tertiary)', text: status, bg: 'var(--color-bg-hover)' };
        return (
          <div className="status-indicator">
            <span className={`status-dot ${status}`}></span>
            <span style={{ color: config.color, fontWeight: 500 }}>{config.text}</span>
          </div>
        );
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (text: string) => <span className="text-secondary">{text}</span>
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (text: string) => <span className="text-secondary">{text}</span>
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">控制台</h1>
        <p className="page-description">实时监控系统状态和数据备份情况</p>
      </div>

      <div className="dashboard-grid">
        <Row gutter={[24, 24]}>
          {statCards.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <div
                className="stat-card animate-slide-up"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  '--stat-color': stat.color,
                  '--stat-bg': `${stat.color}15`
                } as React.CSSProperties}
              >
                <div className="stat-card-header">
                  <div className="stat-card-icon">
                    <stat.icon size={24} />
                  </div>
                  <span className={`stat-card-trend ${stat.trendDirection}`}>
                    {stat.trendDirection === 'up' && '↑'}
                    {stat.trendDirection === 'down' && '↓'}
                    {stat.trend}
                  </span>
                </div>
                <div className="stat-card-value">{stat.value}</div>
                <div className="stat-card-label">{stat.label}</div>
              </div>
            </Col>
          ))}
        </Row>

        <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
          <Col xs={24} lg={14}>
            <Card
              title={
                <div className="card-title">
                  <TrendingUp size={18} />
                  <span>最近备份</span>
                </div>
              }
              className="dashboard-card animate-slide-up"
              style={{ animationDelay: '0.4s' }}
              extra={<span className="text-xs text-tertiary">实时更新</span>}
            >
              <Table
                columns={columns}
                dataSource={recentBackups}
                rowKey="id"
                pagination={false}
                loading={loading}
                size="middle"
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title={
                <div className="card-title">
                  <Server size={18} />
                  <span>系统状态</span>
                </div>
              }
              className="dashboard-card animate-slide-up"
              style={{ animationDelay: '0.5s' }}
              extra={
                <div className="status-indicator">
                  <span className="status-dot online"></span>
                  <span className="text-xs text-success">全部正常</span>
                </div>
              }
            >
              <div className="system-status-list">
                <div className="system-status-item">
                  <div className="system-status-info">
                    <span className="status-dot online"></span>
                    <span className="system-status-name">PostgreSQL Primary</span>
                  </div>
                  <div className="system-status-metrics">
                    <span className="system-status-response">{stats?.active_backups || 0}</span>
                    <span className="text-xs text-tertiary">活跃任务</span>
                  </div>
                </div>
                <div className="system-status-item">
                  <div className="system-status-info">
                    <span className="status-dot online"></span>
                    <span className="system-status-name">MySQL Replica</span>
                  </div>
                  <div className="system-status-metrics">
                    <span className="system-status-response">{stats?.pending_backups || 0}</span>
                    <span className="text-xs text-tertiary">等待中</span>
                  </div>
                </div>
                <div className="system-status-item">
                  <div className="system-status-info">
                    <span className="status-dot warning"></span>
                    <span className="system-status-name">Backup Agent</span>
                  </div>
                  <div className="system-status-metrics">
                    <span className="system-status-response">{stats?.failed_backups || 0}</span>
                    <span className="text-xs text-tertiary">失败</span>
                  </div>
                </div>
                <div className="system-status-item">
                  <div className="system-status-info">
                    <span className="status-dot online"></span>
                    <span className="system-status-name">恢复任务</span>
                  </div>
                  <div className="system-status-metrics">
                    <span className="system-status-response">{stats?.total_restores || 0}</span>
                    <span className="text-xs text-tertiary">总数</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <div className="card-title">
              <Clock size={18} />
              <span>存储概览</span>
            </div>
          }
          className="dashboard-card animate-slide-up"
          style={{ marginTop: '24px', animationDelay: '0.6s' }}
        >
          <Row gutter={[32, 24]}>
            <Col xs={24} md={8}>
              <div className="storage-metric">
                <div className="storage-metric-header">
                  <span className="text-sm text-secondary">已用空间</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {(stats?.storage_used || 0).toFixed(2)} GB / {stats?.storage_total || 500} GB
                  </span>
                </div>
                <Progress
                  percent={Math.round(((stats?.storage_used || 0) / (stats?.storage_total || 500)) * 100)}
                  strokeColor={{
                    '0%': 'var(--color-primary)',
                    '100%': 'var(--color-info)'
                  }}
                  trailColor="var(--color-bg-hover)"
                  showInfo={false}
                />
                <div className="storage-metric-footer">
                  <span className="text-xs text-tertiary">0 GB</span>
                  <span className="text-xs text-tertiary">{stats?.storage_total || 500} GB</span>
                </div>
              </div>
            </Col>

            <Col xs={24} md={8}>
              <div className="storage-metric">
                <div className="storage-metric-header">
                  <span className="text-sm text-secondary">本周备份</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-info)' }}>
                    {stats?.recent_backups_count || 0}
                  </span>
                </div>
                <Progress
                  percent={Math.min(((stats?.recent_backups_count || 0) / 50) * 100, 100)}
                  strokeColor="var(--color-info)"
                  trailColor="var(--color-bg-hover)"
                  showInfo={false}
                />
                <div className="storage-metric-footer">
                  <span className="text-xs text-tertiary">本周目标: 50</span>
                </div>
              </div>
            </Col>

            <Col xs={24} md={8}>
              <div className="storage-metric">
                <div className="storage-metric-header">
                  <span className="text-sm text-secondary">恢复成功率</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                    {stats && stats.total_restores > 0
                      ? Math.round((stats.success_restores / stats.total_restores) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress
                  percent={stats && stats.total_restores > 0
                    ? Math.round((stats.success_restores / stats.total_restores) * 100)
                    : 0}
                  strokeColor="var(--color-warning)"
                  trailColor="var(--color-bg-hover)"
                  showInfo={false}
                />
                <div className="storage-metric-footer">
                  <span className="text-xs text-tertiary">成功: {stats?.success_restores || 0} / {stats?.total_restores || 0}</span>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      <style>{`
        .dashboard-grid {
          width: 100%;
        }

        .dashboard-card {
          height: 100%;
        }

        .stat-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .database-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: var(--color-primary-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }

        .backup-type-tag {
          background: var(--color-primary-bg);
          color: var(--color-primary);
          border: none;
          font-weight: 500;
        }

        .system-status-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .system-status-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
        }

        .system-status-item:hover {
          background: var(--color-bg-hover);
        }

        .system-status-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .system-status-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .system-status-metrics {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .system-status-response {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-success);
        }

        .storage-metric {
          padding: 16px;
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
        }

        .storage-metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .storage-metric-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }

        @media (max-width: 768px) {
          .stat-card {
            margin-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
};