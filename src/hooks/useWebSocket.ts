import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  payload?: any;
}

interface UseWebSocketOptions {
  onMessage?: (data: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  shouldReconnect?: boolean;
  maxRetries?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 5000,
    shouldReconnect = true,
    maxRetries = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isConnected, setIsConnected] = useState(false);
  const pendingMessagesRef = useRef<WebSocketMessage[]>([]);
  const retryCountRef = useRef(0);
  const currentIntervalRef = useRef(reconnectInterval);
  const callbacksRef = useRef({
    onMessage,
    onOpen,
    onClose,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onOpen,
      onClose,
      onError,
    };
  }, [onMessage, onOpen, onClose, onError]);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  const flushPendingMessages = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pendingMessagesRef.current.length > 0) {
      const msg = pendingMessagesRef.current.shift();
      if (msg) {
        wsRef.current.send(JSON.stringify(msg));
      }
    }
  }, []);

  const resetRetryState = useCallback(() => {
    retryCountRef.current = 0;
    currentIntervalRef.current = reconnectInterval;
  }, [reconnectInterval]);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    if (retryCountRef.current >= maxRetries && shouldReconnect) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    const wsUrl = getWebSocketUrl();

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        resetRetryState();
        setIsConnected(true);
        callbacksRef.current.onOpen?.();

        const token = localStorage.getItem('token');
        if (token && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'auth', token }));
        }

        flushPendingMessages();
      };

      wsRef.current.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        callbacksRef.current.onClose?.();

        if (shouldReconnect && retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          const delay = currentIntervalRef.current;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
            currentIntervalRef.current = Math.min(currentIntervalRef.current * 2, 30000);
          }, delay);
        } else if (retryCountRef.current >= maxRetries) {
          console.warn(`WebSocket reached max retries (${maxRetries}), stopping reconnection`);
        }
      };

      wsRef.current.onerror = (error: Event) => {
        callbacksRef.current.onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [getWebSocketUrl, shouldReconnect, maxRetries, flushPendingMessages, resetRetryState]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    pendingMessagesRef.current = [];
    resetRetryState();
  }, [resetRetryState]);

  const sendMessage = useCallback((data: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      pendingMessagesRef.current.push(data);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}

export type { WebSocketMessage };
