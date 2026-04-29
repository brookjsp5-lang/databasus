/**
 * ResponsiveTable - 响应式表格组件
 * 
 * 基于Ant Design Table扩展的自适应表格组件
 * - 小屏幕下自动转换为卡片视图
 * - 支持自定义列配置
 * - 保持原有Table的所有功能
 * 
 * @description 
 * - 响应式断点: 768px
 * - 移动端显示为卡片列表
 * - 支持拖拽列配置
 * - 支持列隐藏配置
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { Table, Card, Tag, Button, Empty } from 'antd';
import { Smartphone, Monitor } from 'lucide-react';
import type { ColumnsType, TableProps } from 'antd/es/table';

/**
 * 响应式表格列配置接口
 */
interface ResponsiveColumn<T> {
  key?: string | number;
  title?: ReactNode;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => ReactNode;
  hideOnMobile?: boolean;
  mobileLabel?: string;
  mobileRender?: (value: any, record: T, index: number) => ReactNode;
}

/**
 * 响应式表格属性接口
 */
interface ResponsiveTableProps<T> extends Omit<TableProps<T>, 'columns'> {
  /** 列配置 */
  columns: ResponsiveColumn<T>[];
  /** 数据源 */
  dataSource?: T[];
  /** 是否启用响应式 */
  responsive?: boolean;
  /** 移动端断点 */
  breakpoint?: number;
  /** 空状态描述 */
  emptyText?: string;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 响应式表格组件
 * 
 * @example
 * ```tsx
 * <ResponsiveTable
 *   columns={[
 *     { title: '名称', dataIndex: 'name', key: 'name' },
 *     { title: '状态', dataIndex: 'status', key: 'status', hideOnMobile: true },
 *   ]}
 *   dataSource={data}
 *   rowKey="id"
 * />
 * ```
 */
export function ResponsiveTable<T extends { id?: string | number }>({
  columns,
  dataSource = [],
  responsive = true,
  breakpoint = 768,
  emptyText = '暂无数据',
  loading = false,
  ...tableProps
}: ResponsiveTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // 初始检查
    checkMobile();

    // 添加监听器
    window.addEventListener('resize', checkMobile);

    // 清理
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  // 过滤出桌面端显示的列
  const desktopColumns = columns.filter(col => !col.hideOnMobile);

  // 移动端卡片视图
  if (isMobile && responsive) {
    return (
      <div className="responsive-table-mobile">
        {/* 移动端切换提示 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            background: 'var(--color-bg-hover)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Smartphone size={14} />
          <span>卡片视图 - {dataSource.length} 条记录</span>
        </div>

        {/* 加载状态 */}
        {loading ? (
          <div className="responsive-table-loading">
            {[1, 2, 3].map(i => (
              <Card
                key={i}
                size="small"
                loading
                style={{ marginBottom: '12px' }}
              />
            ))}
          </div>
        ) : dataSource.length === 0 ? (
          <Empty description={emptyText} />
        ) : (
          <div className="responsive-table-cards">
            {dataSource.map((record, index) => (
              <Card
                key={record.id || index}
                size="small"
                className="responsive-table-card"
                styles={{
                  body: { padding: '12px' }
                }}
              >
                {columns.map((column, colIndex) => {
                  if (column.hideOnMobile && isMobile) return null;

                  const value = column.dataIndex
                    ? record[column.dataIndex as keyof T]
                    : undefined;

                  const mobileLabel = column.mobileLabel || column.title as string;
                  const mobileContent = column.mobileRender
                    ? column.mobileRender(value, record, index)
                    : renderCellValue(value, column);

                  return (
                    <div
                      key={column.key as string || colIndex}
                      className="responsive-table-card-item"
                    >
                      <div className="responsive-table-card-label">
                        {mobileLabel}
                      </div>
                      <div className="responsive-table-card-value">
                        {mobileContent}
                      </div>
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 桌面端表格视图
  return (
    <div className="responsive-table-desktop">
      {/* 桌面端切换提示 */}
      {responsive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            background: 'var(--color-bg-hover)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Monitor size={14} />
          <span>表格视图</span>
        </div>
      )}

      <Table
        columns={desktopColumns as any}
        dataSource={dataSource}
        loading={loading}
        locale={{ emptyText }}
        scroll={{ x: 'max-content' }}
        {...tableProps}
      />
    </div>
  );
}

/**
 * 渲染单元格值
 */
function renderCellValue(
  value: any,
  column: ResponsiveColumn<any>
): ReactNode {
  // 自定义渲染器
  if (column.render) {
    return column.render(value, record => record, -1);
  }

  // 布尔值
  if (typeof value === 'boolean') {
    return (
      <Tag color={value ? 'green' : 'red'}>
        {value ? '是' : '否'}
      </Tag>
    );
  }

  // 数字格式化
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  // 字符串
  if (typeof value === 'string') {
    return value || '-';
  }

  // 其他
  return value ?? '-';
}

// 导出record类型
export type RecordType = { id?: string | number };

/**
 * 使用响应式列配置的Hook
 * 
 * @example
 * ```tsx
 * const columns = useResponsiveColumns([
 *   { title: '名称', dataIndex: 'name', key: 'name' },
 *   { title: '详情', dataIndex: 'details', key: 'details', hideOnMobile: true },
 * ]);
 * ```
 */
export function useResponsiveColumns<T>(
  columns: ResponsiveColumn<T>[]
): ResponsiveColumn<T>[] {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return columns.filter(col => !col.hideOnMobile || !isMobile);
}

/**
 * 响应式操作列组件
 * 用于在表格中渲染操作按钮
 * 
 * @example
 * ```tsx
 * const actionColumn: ResponsiveColumn<DataType> = {
 *   title: '操作',
 *   key: 'action',
 *   width: 200,
 *   render: (_, record) => (
 *     <ResponsiveActionColumn>
 *       <Button size="small">编辑</Button>
 *       <Button size="small" danger>删除</Button>
 *     </ResponsiveActionColumn>
 *   ),
 * };
 * ```
 */
export const ResponsiveActionColumn: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`responsive-action-column ${className}`}
    style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}
  >
    {children}
  </div>
);

/**
 * 响应式状态标签组件
 * 根据状态值自动显示不同颜色的标签
 */
export const ResponsiveStatusTag: React.FC<{
  status: string;
  mapping?: Record<string, { color: string; text: string }>;
}> = ({ status, mapping }) => {
  const defaultMapping: Record<string, { color: string; text: string }> = {
    success: { color: 'green', text: '成功' },
    failed: { color: 'red', text: '失败' },
    pending: { color: 'orange', text: '待处理' },
    running: { color: 'blue', text: '运行中' },
    completed: { color: 'green', text: '已完成' },
    error: { color: 'red', text: '错误' },
    warning: { color: 'orange', text: '警告' },
    inactive: { color: 'default', text: '未激活' },
    active: { color: 'green', text: '激活' },
  };

  const config = mapping?.[status] || defaultMapping[status] || {
    color: 'default',
    text: status,
  };

  return <Tag color={config.color}>{config.text}</Tag>;
};

/**
 * 响应式空状态组件
 */
export const ResponsiveEmpty: React.FC<{
  description?: string;
  image?: ReactNode;
}> = ({ description = '暂无数据', image }) => (
  <Empty
    description={description}
    image={image || Empty.PRESENTED_IMAGE_SIMPLE}
    style={{
      padding: '48px 24px',
    }}
  />
);

export default ResponsiveTable;
