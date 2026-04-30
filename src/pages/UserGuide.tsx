import React from 'react';
import { Alert, Card, Col, Divider, Row, Space, Tag } from 'antd';
import {
  BookOpen,
  CheckCircle2,
  Database,
  HardDrive,
  BellRing,
  RotateCcw,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';

interface GuideStep {
  title: string;
  description: string;
  actions: string[];
  tips?: string[];
}

interface GuideSection {
  key: string;
  title: string;
  icon: React.ElementType;
  summary: string;
  tag: string;
  steps: GuideStep[];
}

const guideSections: GuideSection[] = [
  {
    key: 'workspace',
    title: '1. 初始化工作空间',
    icon: Users,
    summary: '创建工作空间并确认当前操作上下文，避免把数据库、备份和告警配置到错误环境。',
    tag: '基础配置',
    steps: [
      {
        title: '确认登录身份',
        description: '登录后先检查右上角账户信息与当前工作空间名称，确认是否拥有管理权限。',
        actions: [
          '使用右上角账户菜单确认用户名与邮箱信息正确。',
          '在顶部工作空间选择器里切换到目标业务环境。',
          '首次使用时建议只保留测试环境，验证流程后再接入生产环境。',
        ],
      },
      {
        title: '建立配置基线',
        description: '在开始录入数据库和存储前，先确定命名规范、归属团队和告警联系人。',
        actions: [
          '为工作空间定义统一命名规则，例如“环境-业务名-数据库类型”。',
          '记录负责人的联系方式，用于后续告警通知与审计追踪。',
          '整理现有数据库、备份周期、保留时间与恢复目标时间点。',
        ],
      },
    ],
  },
  {
    key: 'database',
    title: '2. 接入数据库',
    icon: Database,
    summary: '在备份中心添加数据库连接，确保系统能够识别数据库类型、连接信息与备份能力。',
    tag: '核心操作',
    steps: [
      {
        title: '新增数据库连接',
        description: '进入“备份中心”，点击“添加数据库”，逐项填写数据库实例信息。',
        actions: [
          '选择正确的数据库类型并填写主机、端口、用户名、密码。',
          '补充数据库名称、实例标识、业务说明等便于识别的信息。',
          '保存前确认网络连通、账户权限和磁盘空间满足备份要求。',
        ],
        tips: [
          '建议先接入测试库验证备份链路，再接入生产库。',
          '生产环境账号建议使用最小权限策略，仅开放备份与恢复必需能力。',
        ],
      },
      {
        title: '验证接入结果',
        description: '保存后回到数据库列表，确认连接信息展示正常并能触发后续备份动作。',
        actions: [
          '检查数据库卡片是否展示预期的状态、名称与类型。',
          '如系统提供测试连接或刷新功能，建议立即执行一次。',
          '若连接失败，优先排查网络、端口、凭据和数据库白名单设置。',
        ],
      },
    ],
  },
  {
    key: 'storage',
    title: '3. 配置备份存储',
    icon: HardDrive,
    summary: '在“存储管理”中配置备份归档位置，确保备份文件有可靠的落盘和保留策略。',
    tag: '核心操作',
    steps: [
      {
        title: '添加存储目的地',
        description: '根据实际方案配置本地盘、对象存储或其他归档位置。',
        actions: [
          '进入“存储管理”，点击“添加存储”。',
          '填写存储名称、类型、连接地址、认证信息和默认路径。',
          '区分测试与生产存储，避免混用导致文件覆盖或生命周期错误。',
        ],
      },
      {
        title: '制定保留与容量策略',
        description: '在启用定时备份前，确认保留天数、容量阈值和清理策略。',
        actions: [
          '结合业务恢复目标设置备份保留周期。',
          '确认对象存储桶权限、生命周期规则与访问控制。',
          '定期核查容量使用情况，避免因空间不足导致备份失败。',
        ],
      },
    ],
  },
  {
    key: 'backup',
    title: '4. 创建备份任务',
    icon: Wrench,
    summary: '在“备份中心”中创建并验证备份任务，确保全量备份、增量备份或定时任务按计划执行。',
    tag: '关键流程',
    steps: [
      {
        title: '创建或编辑备份任务',
        description: '选择目标数据库与存储位置，设置备份类型、时间计划和保留策略。',
        actions: [
          '在“备份中心”选择数据库后创建备份任务。',
          '指定执行频率、备份类型和目标存储。',
          '保存后手动触发一次备份，确认链路完整可用。',
        ],
        tips: [
          '定时任务上线前建议先手动执行一次，检查日志和产物。',
        ],
      },
      {
        title: '检查备份结果',
        description: '通过备份记录确认任务执行状态、文件大小和时间戳是否合理。',
        actions: [
          '观察任务状态是否为成功，失败时查看错误信息。',
          '确认产物大小和更新时间与预期一致。',
          '连续执行两次以上验证重复任务是否稳定。',
        ],
      },
    ],
  },
  {
    key: 'restore',
    title: '5. 演练恢复流程',
    icon: RotateCcw,
    summary: '恢复能力是备份体系的最终验证，必须在“恢复管理”中进行演练并记录结果。',
    tag: '高优先级',
    steps: [
      {
        title: '创建恢复任务',
        description: '从备份记录或 PITR 流程发起恢复任务，验证恢复点选择是否正确。',
        actions: [
          '进入“恢复管理”，点击“创建恢复任务”。',
          '选择目标备份、恢复时间点和恢复目标实例。',
          '在非生产环境完成恢复验证，确认数据可用性。',
        ],
      },
      {
        title: '验证恢复质量',
        description: '不仅要看任务成功，还要核对恢复出的数据是否完整、业务是否可访问。',
        actions: [
          '检查恢复后的表结构、关键数据和连接权限。',
          '记录恢复耗时、异常信息与操作步骤。',
          '把恢复演练周期纳入常规运维计划。',
        ],
      },
    ],
  },
  {
    key: 'alerts',
    title: '6. 设置告警通知',
    icon: BellRing,
    summary: '在“告警通知”和“系统设置”中配置告警渠道，确保备份异常、恢复失败和系统风险可被及时感知。',
    tag: '运维保障',
    steps: [
      {
        title: '配置通知渠道',
        description: '根据团队协作方式选择邮件、企业微信、Webhook 等通知方式。',
        actions: [
          '进入“告警通知”配置通知偏好与接收策略。',
          '在“系统设置”中补充 SMTP 或相关通知参数。',
          '保存后执行一次测试通知，确认链路可达。',
        ],
      },
      {
        title: '校验告警闭环',
        description: '告警不仅要能发出，还要能被识别、跟踪和处理。',
        actions: [
          '检查未读告警数量、告警列表和处理状态是否同步更新。',
          '确保关键告警有明确接收人和处理流程。',
          '对失败告警记录补充备注，便于后续审计。',
        ],
      },
    ],
  },
  {
    key: 'security',
    title: '7. 审计与系统设置',
    icon: ShieldCheck,
    summary: '通过“审计日志”和“系统设置”维护账号安全、配置一致性和变更可追溯性。',
    tag: '治理建议',
    steps: [
      {
        title: '维护账号与安全策略',
        description: '定期检查个人资料、密码和系统配置，确保管理入口安全可靠。',
        actions: [
          '在“系统设置”中更新管理员邮箱并定期修改密码。',
          '为关键账号启用更高强度的密码策略。',
          '涉及多人协作时，明确操作边界和最小权限原则。',
        ],
      },
      {
        title: '查看审计日志',
        description: '重要配置变更完成后，到“审计日志”核对操作记录与时间线。',
        actions: [
          '使用日期范围和操作类型筛选配置变更记录。',
          '核对操作者、资源对象、来源 IP 和执行时间。',
          '将异常操作纳入安全审查流程。',
        ],
      },
    ],
  },
];

const quickChecklist = [
  '确认工作空间与目标环境一致',
  '数据库连接测试通过并具备备份权限',
  '备份存储已配置且容量充足',
  '至少完成一次手动备份与一次恢复演练',
  '告警通知测试成功并能触达负责人',
  '审计日志能够记录关键配置动作',
];

export const UserGuide: React.FC = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">使用教程</h1>
        <p className="page-description">按照系统配置全流程指南完成工作空间、数据库、备份、恢复、告警与安全设置。</p>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<BookOpen size={16} />}
        message="建议首次使用时先在测试环境完整走通一次教程，再复制到生产环境。"
        description="教程按“准备 -> 接入 -> 备份 -> 恢复 -> 告警 -> 审计”顺序编排，可作为新成员上手和系统交付的标准操作参考。"
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={8}>
          <Card title="快速完成清单" bordered={false} className="cyber-card" style={{ height: '100%' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {quickChecklist.map((item) => (
                <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <CheckCircle2 size={18} color="var(--color-success)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ color: 'var(--color-text)', lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="推荐实施顺序" bordered={false} className="cyber-card" style={{ height: '100%' }}>
            <Row gutter={[12, 12]}>
              {guideSections.map((section) => {
                const Icon = section.icon;
                return (
                  <Col xs={24} sm={12} key={section.key}>
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-light)',
                        minHeight: 136,
                      }}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space align="center">
                          <Icon size={18} color="var(--color-primary)" />
                          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{section.tag}</Tag>
                        </Space>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{section.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                          {section.summary}
                        </div>
                      </Space>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {guideSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.key}
              bordered={false}
              className="cyber-card"
              title={
                <Space align="center">
                  <Icon size={18} color="var(--color-primary)" />
                  <span>{section.title}</span>
                  <Tag color="processing" style={{ marginInlineStart: 8 }}>{section.tag}</Tag>
                </Space>
              }
            >
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 20 }}>
                {section.summary}
              </p>
              {section.steps.map((step, index) => (
                <div key={`${section.key}-${index}`} style={{ marginBottom: index === section.steps.length - 1 ? 0 : 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                    {step.title}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: 12 }}>
                    {step.description}
                  </div>
                  <ul style={{ paddingLeft: 18, marginBottom: step.tips?.length ? 12 : 0, color: 'var(--color-text)' }}>
                    {step.actions.map((action) => (
                      <li key={action} style={{ marginBottom: 8, lineHeight: 1.8 }}>{action}</li>
                    ))}
                  </ul>
                  {step.tips?.length ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="实施提示"
                      description={
                        <ul style={{ paddingLeft: 18, margin: 0 }}>
                          {step.tips.map((tip) => (
                            <li key={tip} style={{ marginBottom: 6, lineHeight: 1.8 }}>{tip}</li>
                          ))}
                        </ul>
                      }
                      style={{ borderRadius: 12 }}
                    />
                  ) : null}
                  {index < section.steps.length - 1 ? <Divider style={{ margin: '20px 0' }} /> : null}
                </div>
              ))}
            </Card>
          );
        })}
      </Space>

      <Card
        bordered={false}
        className="cyber-card"
        style={{ marginTop: 24 }}
        title={
          <Space align="center">
            <Settings size={18} color="var(--color-primary)" />
            <span>交付建议</span>
          </Space>
        }
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            建议把本教程作为系统上线检查单的一部分，要求管理员在完成数据库接入、存储配置、备份验证、恢复演练和告警测试后，再正式开放给业务团队使用。
          </span>
          <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            如需更贴近你们内部流程，可以继续在本页补充组织内的审批要求、值班联系人、SLA 指标和常见故障处理手册。
          </span>
        </Space>
      </Card>
    </div>
  );
};
