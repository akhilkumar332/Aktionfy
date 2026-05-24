import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const SSEContext = createContext(null);

export const SSEProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [bridgeActive, setBridgeActive] = useState(false);
  const listenersRef = useRef({});

  // Fetch initial bridge status
  const fetchBridgeStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/v1/system/status');
      if (res.data.success) {
        setBridgeActive(res.data.data.bridge_active);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBridgeStatus();
    } else {
      setBridgeActive(false);
    }
  }, [user, fetchBridgeStatus]);

  // Listener management
  const addListener = useCallback((eventType, callback) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = [];
    }
    listenersRef.current[eventType].push(callback);
  }, []);

  const removeListener = useCallback((eventType, callback) => {
    if (!listenersRef.current[eventType]) return;
    listenersRef.current[eventType] = listenersRef.current[eventType].filter(
      cb => cb !== callback
    );
  }, []);

  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    let eventSource;
    let reconnectTimeout;

    const connect = () => {
      if (document.visibilityState !== 'visible') return;

      if (eventSource) eventSource.close();

      eventSource = new EventSource('/api/v1/events', { withCredentials: true });

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Trigger listeners
          const eventType = data.event_type;
          const payload = data.payload ? JSON.parse(data.payload) : {};
          
          if (listenersRef.current[eventType]) {
            listenersRef.current[eventType].forEach(cb => {
              try { cb(payload); } catch (e) { console.error(e); }
            });
          }
          
          // Also trigger general '*' listeners
          if (listenersRef.current['*']) {
            listenersRef.current['*'].forEach(cb => {
              try { cb(eventType, payload); } catch (e) { console.error(e); }
            });
          }

          // If bridge status is updated, we can also manage bridgeActive state
          if (eventType === 'bridge_status_changed' || eventType === 'system_status_changed') {
            setBridgeActive(!!payload.bridge_active);
          }
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        console.warn('Aktionfy SSE: Connection interrupted. Reconnecting in 3s...');
        eventSource.close();
        
        if (document.visibilityState === 'visible') {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        connect();
      } else {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        setIsConnected(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      setIsConnected(false);
    };
  }, [user]);

  // Periodic poll to double check system/bridge status as backup
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchBridgeStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, fetchBridgeStatus]);

  return (
    <SSEContext.Provider value={{ isConnected, bridgeActive, addListener, removeListener, setBridgeActive }}>
      {children}
    </SSEContext.Provider>
  );
};

export const useSSE = () => {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
};
