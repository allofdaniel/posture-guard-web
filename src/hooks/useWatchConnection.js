import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Manage WebSocket connection between the PWA and Wear OS watch relay.
 */
const DEFAULT_PORT = 8080;

const safeInt = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(parsed));
  }

  return fallback;
};

const getDefaultUrl = () => {
  if (typeof window === 'undefined') return '';
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.hostname || 'localhost'}:${DEFAULT_PORT}`;
};

const parseMessage = (raw) => {
  try {
    const message = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return null;
    }

    if (typeof message.type !== 'string') {
      return null;
    }

    return message;
  } catch (error) {
    console.warn('Failed to parse relay message:', error.message);
    return null;
  }
};

const normalizeWatchCount = (message) => {
  if (!message || typeof message !== 'object') return 0;
  if (Number.isFinite(message.watchClients)) {
    return safeInt(message.watchClients);
  }
  if (Number.isFinite(message.count)) {
    return safeInt(message.count);
  }
  return 0;
};

export const useWatchConnection = (serverUrl = null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isManualCloseRef = useRef(false);

  const url = serverUrl || getDefaultUrl();

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    if (!wsRef.current) return;

    try {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'manual');
      }
    } catch (error) {
      console.warn('Failed to close relay socket:', error.message);
    }

    wsRef.current = null;
  }, []);

  const connect = useCallback(function connect() {
    if (!url) {
      setError('Relay URL is unavailable');
      return;
    }

    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearReconnectTimeout();
    isManualCloseRef.current = false;

    if (wsRef.current) {
      closeSocket();
    }

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        setWatchCount(0);

        wsRef.current.send(JSON.stringify({
          type: 'register',
          device: 'web',
        }));
      };

      wsRef.current.onmessage = (event) => {
        const message = parseMessage(event.data);
        if (!message) return;

        if (message.type === 'watchConnected' || message.type === 'watchDisconnected') {
          setWatchCount(normalizeWatchCount(message));
          return;
        }

        if (message.type === 'status' || message.type === 'registered') {
          setWatchCount(normalizeWatchCount(message));
          return;
        }

        if (message.type === 'error' && typeof message.message === 'string') {
          setError(message.message);
          return;
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setWatchCount(0);
        wsRef.current = null;

        if (!isManualCloseRef.current && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = () => {
        setError('WebSocket connection error');
      };
    } catch (error) {
      console.warn('WebSocket initialization failed:', error.message);
      setError('WebSocket initialization failed');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [url, closeSocket, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    isManualCloseRef.current = true;
    closeSocket();
    setIsConnected(false);
    setWatchCount(0);
  }, [clearReconnectTimeout, closeSocket]);

  const sendVibration = useCallback((options = {}) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'vibrate',
      intensity: options.intensity || 255,
      pattern: options.pattern || 'medium',
    }));
    return true;
  }, []);

  const updateConfig = useCallback((config) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'config',
      ...config,
    }));
    return true;
  }, []);

  const requestStatus = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify({ type: 'status' }));
    return true;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    watchCount,
    error,
    connect,
    disconnect,
    sendVibration,
    updateConfig,
    requestStatus,
  };
};
