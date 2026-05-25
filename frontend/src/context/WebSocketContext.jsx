import { createContext, useEffect, useRef, useState, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

/**
 * WebSocketProvider manages a global WebSocket connection that is gated by authentication.
 * It automatically connects when a user is logged in and disconnects when they log out.
 * Includes automatic reconnection logic with a fixed interval.
 */
export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const connectRef = useRef(null);
  const listenersRef = useRef({});

  const addListener = useCallback((type, callback) => {
    if (!listenersRef.current[type]) {
      listenersRef.current[type] = [];
    }
    listenersRef.current[type].push(callback);
  }, []);

  const removeListener = useCallback((type, callback) => {
    if (!listenersRef.current[type]) return;
    listenersRef.current[type] = listenersRef.current[type].filter(cb => cb !== callback);
  }, []);

  const connect = useCallback(() => {
    // Only connect if we have a user and aren't already connected/connecting
    if (!user || (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING))) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    socket.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type && listenersRef.current[msg.type]) {
          listenersRef.current[msg.type].forEach(cb => {
            try { cb(msg.payload); } catch (e) { console.error(e); }
          });
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };
    
    socket.onclose = () => {
      setIsConnected(false);
      // Only attempt reconnect if user is still logged in
      if (user) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectRef.current) connectRef.current();
        }, 5000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [user]);

  // Keep connectRef in sync for recursive calls in onclose
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (user) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false); // eslint-disable-line react-hooks/set-state-in-effect
    }
    
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [user, connect]);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, sendMessage, addListener, removeListener, wsRef }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = () => useContext(WebSocketContext);
