import { useEffect } from 'react';
import { useNotify } from '../context/NotificationContext';

/**
 * useSSE - A hook to consume Server-Sent Events with auto-reconnect and visibility awareness
 * @param {Function} onEvent - Callback function called with parsed event data
 */
export const useSSE = (onEvent) => {
  const { notify } = useNotify();

  useEffect(() => {
    let eventSource;
    let reconnectTimeout;

    const connect = () => {
      // Don't connect if page is not visible
      if (document.visibilityState !== 'visible') return;

      // Close existing if any
      if (eventSource) eventSource.close();

      eventSource = new EventSource('/api/v1/events', { withCredentials: true });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (err) {
          notify('ERROR', 'Failed to parse SSE event', err.message);
        }
      };

      eventSource.onerror = () => {
        notify('ERROR', 'SSE connection error', 'The link to the neural hub was interrupted. Reconnecting...');
        eventSource.close();
        
        // Simple reconnect with 3 second delay if still visible
        if (document.visibilityState === 'visible') {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      eventSource.onopen = () => {
        // SSE connection established
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
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [onEvent, notify]);
};
