import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Tag, Progress } from 'antd';
import { Activity, Database, HardDrive, Clock, TrendingUp, Shield, Server } from 'lucide-react';

interface StatsData {
  totalDatabases: number;
  totalBackups: number;
  successRate: number;
  storageUsed: number;
  storageTotal: number;
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
  const [stats, setStats] = useState<StatsData>({
    totalDatabases: 12,
    totalBackups: 156,
    successRate: 98.5,
    storageUsed: 245,
    storageTotal: 500
  });

  const recentBackups: RecentBackup[] = [
    { id: 1, database: 'MySQL-Production', type: '物理备份', status: 'success', size: '2.4 GB', time: '2小时前' },
    { id: 2, database: 'PostgreSQL-Main', type: '物理备份', status: 'success', size: '1.8 GB', time: '5小时前' },
    { id: 3, database: 'MySQL-Staging', type: '逻辑备份', status: 'running', size: '-', time: '进行中' },
    { id: 4, database: 'PostgreSQL-Dev', type: '物理备份', status: 'failed', size: '-', time: '8小时前' },
    { id: 5, database: 'MySQL-Analytics', type: '物理备份', status: 'success', size: '3.2 GB', time: '12小时前' },
  ];

  const systemStatus = [
    { name: 'MySQL Primary', status: 'online', icon: '◆', color: 'var(--color-success)' },
    { name: 'MySQL Replica', status: 'online', icon: '◆', color: 'var(--color-success)' },
    { name: 'PostgreSQL Main', status: 'online', icon: '◆', color: 'var(--color-success)' },
    { name: 'Backup Agent', status: 'online', icon: '◆', color: 'var(--color-success)' },
    { name: 'Scheduler', status: 'online', icon: '◆', color: 'var(--color-success)' },
  ];

  const statCards = [
    {
      label: '数据库总数',
      value: stats.totalDatabases,
      icon: Database,
      color: 'var(--color-primary)',
      trend: '+2'
    },
    {
      label: '备份任务',
      value: stats.totalBackups,
      icon: HardDrive,
      color: 'var(--color-secondary)',
      trend: '+12'
    },
    {
      label: '成功率',
      value: `${stats.successRate}%`,
      icon: TrendingUp,
      color: 'var(--color-success)',
      trend: '+0.5%'
    },
    {
      label: '存储使用',
      value: `${stats.storageUsed}GB`,
      icon: Server,
      color: 'var(--color-warning)',
      trend: `${Math.round(stats.storageUsed / stats.storageTotal * 100)}%`
    },
  ];

  const columns = [
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
      render: (text: string) => (
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>{text}</span>
      )
    },
    {
      title: '备份类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <Tag style={{
          background: 'rgba(0, 240, 255, 0.1)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          color: 'var(--color-primary)'
        }}>
          {text}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'var(--color-success)', text: '成功' },
          failed: { color: 'var(--color-error)', text: '失败' },
          running: { color: 'var(--color-primary)', text: '进行中' }
        };
        const config = statusMap[status] || { color: 'var(--color-text-muted)', text: status };
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: config.color
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: config.color,
              boxShadow: status === 'running' ? `0 0 10px ${config.color}` : 'none',
              animation: status === 'running' ? 'pulse-glow 1.5s ease-in-out infinite' : 'none'
            }} />
            {config.text}
          </span>
        );
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (text: string) => <span style={{ color: 'var(--color-text-muted)' }}>{text}</span>
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (text: string) => <span style={{ color: 'var(--color-text-muted)' }}>{text}</span>
    },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--color-text)',
          marginBottom: '8px',
          letterSpacing: '2px'
        }}>
          控制台
        </h1>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '14px'
        }}>
          实时监控系统状态和数据备份情况
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="cyber-stat-card animate-slide-in-up"
            style={{
              animationDelay: `${index * 0.1}s`,
              animationFillMode: 'both'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${stat.color}20 0%, ${stat.color}10 100%)`,
                border: `1px solid ${stat.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <stat.icon size={24} style={{ color: stat.color }} />
              </div>
              <span style={{
                fontSize: '12px',
                color: 'var(--color-success)',
                background: 'rgba(0, 255, 136, 0.1)',
                padding: '4px 8px',
                borderRadius: '12px',
                fontFamily: 'var(--font-display)'
              }}>
                {stat.trend}
              </span>
            </div>
            <div className="cyber-stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="cyber-stat-label">{stat.label}</div>

            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'rgba(0, 240, 255, 0.1)',
              borderRadius: '0 0 16px 16px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.random() * 40 + 60}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${stat.color}80, ${stat.color})`,
                animation: 'gradient-shift 2s ease infinite',
                backgroundSize: '200% 100%'
              }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        <div
          className="cyber-card animate-slide-in-up"
          style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                最近备份
              </h3>
            </div>
            <span style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)'
            }}>
              实时更新
            </span>
          </div>

          <Table
            columns={columns}
            dataSource={recentBackups}
            rowKey="id"
            pagination={false}
            size="small"
            style={{
              background: 'transparent'
            }}
          />
        </div>

        <div
          className="cyber-card animate-slide-in-up"
          style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={20} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '1px'
              }}>
                系统状态
              </h3>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--color-success)',
              fontSize: '12px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                boxShadow: '0 0 10px var(--color-success)',
                animation: 'pulse-glow 2s ease-in-out infinite'
              }} />
              全部正常
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {systemStatus.map((system, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0, 240, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 240, 255, 0.05)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 240, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: system.color, fontSize: '14px' }}>{system.icon}</span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-text)'
                  }}>
                    {system.name}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: system.color,
                    boxShadow: `0 0 8px ${system.color}`
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: system.color,
                    fontFamily: 'var(--font-display)'
                  }}>
                    在线
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="cyber-card animate-slide-in-up"
        style={{
          marginTop: '24px',
          animationDelay: '0.6s',
          animationFillMode: 'both'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} style={{ color: 'var(--color-warning)' }} />
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--color-text)',
              margin: 0,
              letterSpacing: '1px'
            }}>
              存储概览
            </h3>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px'
        }}>
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>已用空间</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                color: 'var(--color-primary)'
              }}>
                {stats.storageUsed} GB
              </span>
            </div>
            <Progress
              percent={Math.round(stats.storageUsed / stats.storageTotal * 100)}
              strokeColor={{
                '0%': 'var(--color-primary)',
                '100%': 'var(--color-secondary)'
              }}
              trailColor="rgba(0, 240, 255, 0.1)"
              showInfo={false}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>0 GB</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{stats.storageTotal} GB</span>
            </div>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>备份文件数</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                color: 'var(--color-secondary)'
              }}>
                156
              </span>
            </div>
            <Progress
              percent={78}
              strokeColor="var(--color-secondary)"
              trailColor="rgba(0, 255, 136, 0.1)"
              showInfo={false}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>0</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>200</span>
            </div>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>本周备份</span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                color: 'var(--color-warning)'
              }}>
                42
              </span>
            </div>
            <Progress
              percent={84}
              strokeColor="var(--color-warning)"
              trailColor="rgba(255, 170, 0, 0.1)"
              showInfo={false}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px'
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>本周目标: 50</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};