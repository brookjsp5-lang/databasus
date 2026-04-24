/**
 * ErrorBoundary - React错误边界组件
 * 
 * 用于捕获子组件树中的JavaScript错误，显示降级UI而不是崩溃整个应用。
 * 遵循React Error Boundaries规范实现。
 * 
 * @description 
 * - 使用React生命周期方法作为错误边界
 * - 记录错误信息到控制台
 * - 提供友好的错误提示界面
 * - 支持错误恢复机制
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';

/**
 * ErrorBoundary组件属性接口
 */
interface Props {
  /** 子组件 */
  children: ReactNode;
  /** 错误回调函数 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 自定义降级UI */
  fallback?: ReactNode;
  /** 是否显示详细错误信息 */
  showDetails?: boolean;
}

/**
 * ErrorBoundary组件状态接口
 */
interface State {
  /** 是否有错误 */
  hasError: boolean;
  /** 错误对象 */
  error: Error | null;
  /** 错误详情 */
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - 全局错误边界组件
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * 构造函数
   * 初始化错误状态
   */
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 静态生命周期方法
   * 当子组件抛出错误时调用，返回一个值来更新state
   * 
   * @param error - 抛出的错误对象
   * @returns 更新后的state对象
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * 组件错误捕获
   * 当子组件抛出错误时调用，可以记录错误日志
   * 
   * @param error - 抛出的错误对象
   * @param errorInfo - 包含组件堆栈信息的错误详情
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // 调用自定义错误回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // 记录错误到控制台（生产环境可发送到错误追踪服务）
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 可以在这里发送错误报告到服务器
    this.reportError(error, errorInfo);
  }

  /**
   * 上报错误到错误追踪服务
   * 
   * @param error - 错误对象
   * @param errorInfo - 错误详情
   */
  private reportError(error: Error, errorInfo: ErrorInfo): void {
    // 示例：发送到错误追踪服务（如Sentry、Bugsnag等）
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // 在生产环境中发送到服务器
    if (import.meta.env.PROD) {
      // fetch('/api/error-report', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport),
      // }).catch(() => {});
      console.log('Error report would be sent:', errorReport);
    }
  }

  /**
   * 重置错误状态，尝试恢复组件
   */
  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * 渲染降级UI
   * 当发生错误时显示错误提示界面
   */
  private renderFallbackUI(): ReactNode {
    const { error, errorInfo } = this.state;
    const { showDetails = false } = this.props;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          background: 'var(--color-bg-base)',
        }}
      >
        <Result
          status="error"
          icon={<WarningOutlined style={{ color: '#ff4d4f' }} />}
          title="抱歉，页面出现了一些问题"
          subTitle="应用程序遇到了一个意外错误，请尝试刷新页面或联系技术支持。"
          extra={[
            <Button
              key="retry"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleRetry}
              size="large"
            >
              重试
            </Button>,
            <Button
              key="reload"
              onClick={() => window.location.reload()}
              size="large"
            >
              刷新页面
            </Button>,
          ]}
        >
          {showDetails && error && (
            <div
              style={{
                textAlign: 'left',
                padding: '16px',
                background: 'var(--color-bg-elevated)',
                borderRadius: '8px',
                marginTop: '16px',
              }}
            >
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
                  错误详情（仅供开发人员查看）
                </summary>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <p><strong>错误信息:</strong> {error.message}</p>
                  <p><strong>错误类型:</strong> {error.name}</p>
                  {error.stack && (
                    <p><strong>堆栈跟踪:</strong></p>
                  )}
                  {error.stack && (
                    <pre style={{ 
                      overflow: 'auto', 
                      maxHeight: '200px',
                      fontSize: '11px',
                      background: 'var(--color-bg-card)',
                      padding: '8px',
                      borderRadius: '4px'
                    }}>
                      {error.stack}
                    </pre>
                  )}
                  {errorInfo?.componentStack && (
                    <>
                      <p style={{ marginTop: '12px' }}><strong>组件堆栈:</strong></p>
                      <pre style={{ 
                        overflow: 'auto', 
                        maxHeight: '200px',
                        fontSize: '11px',
                        background: 'var(--color-bg-card)',
                        padding: '8px',
                        borderRadius: '4px'
                      }}>
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            </div>
          )}
        </Result>
      </div>
    );
  }

  /**
   * 渲染方法
   * 如果有错误，渲染降级UI；否则渲染子组件
   */
  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      return fallback || this.renderFallbackUI();
    }

    return children;
  }
}

/**
 * 简单的错误边界Hook
 * 用于在函数组件中使用错误边界
 * 
 * @example
 * ```tsx
 * const [error, setError] = useState<Error | null>(null);
 * 
 * useErrorBoundary(error, setError);
 * ```
 */
export function useErrorBoundary(
  error: Error | null,
  setError: (error: Error | null) => void
): {
  /** 重试函数 */
  retry: () => void;
  /** 错误信息 */
  errorMessage: string | null;
} {
  return {
    retry: () => setError(null),
    errorMessage: error?.message || null,
  };
}

/**
 * 页面级错误边界组件
 * 专门用于包装页面组件，提供更好的用户体验
 */
interface PageErrorBoundaryProps {
  /** 页面标题 */
  pageTitle?: string;
  /** 子组件 */
  children: ReactNode;
  /** 错误回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({
  pageTitle,
  children,
  onError,
}) => {
  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        <div style={{ padding: '24px' }}>
          <Result
            status="error"
            icon={<WarningOutlined style={{ color: '#ff4d4f' }} />}
            title={`${pageTitle || '页面'}加载失败`}
            subTitle="请稍后重试，或刷新页面。"
            extra={[
              <Button
                key="retry"
                type="primary"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>,
            ]}
          />
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
