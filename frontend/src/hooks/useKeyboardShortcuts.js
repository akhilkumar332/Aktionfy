import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook for global keyboard shortcuts.
 * @param {Object} shortcuts - Map of shortcuts. Key is the shortcut string, value is the action.
 * Shortcut string formats supported: 
 * - Single keys: 'r', 's', 'Enter'
 * - Two-key sequences: 'g d' (case insensitive, space separated)
 */
export const useKeyboardShortcuts = (shortcuts) => {
  const navigate = useNavigate();

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;
    const SEQUENCE_TIMEOUT = 1000; // ms to wait for second key in sequence

    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input, textarea, or contentEditable
      const activeElement = document.activeElement;
      const isInput = activeElement.tagName === 'INPUT' || 
                      activeElement.tagName === 'TEXTAREA' || 
                      activeElement.isContentEditable;
      
      if (isInput) return;

      const key = e.key.toLowerCase();
      const currentTime = Date.now();
      
      // Check for sequence (e.g., 'g' then 'd')
      if (lastKey && (currentTime - lastKeyTime < SEQUENCE_TIMEOUT)) {
        const sequence = `${lastKey} ${key}`;
        if (shortcuts[sequence]) {
          e.preventDefault();
          if (typeof shortcuts[sequence] === 'string') {
            navigate(shortcuts[sequence]);
          } else {
            shortcuts[sequence]();
          }
          lastKey = '';
          return;
        }
      }

      // Check for single key
      if (shortcuts[key]) {
        // If it's a prefix for a sequence, wait and see
        const isPrefix = Object.keys(shortcuts).some(s => s.startsWith(key + ' '));
        if (isPrefix) {
          lastKey = key;
          lastKeyTime = currentTime;
        } else {
          e.preventDefault();
          if (typeof shortcuts[key] === 'string') {
            navigate(shortcuts[key]);
          } else {
            shortcuts[key]();
          }
          lastKey = '';
        }
      } else {
        // Not a shortcut or prefix, reset sequence state
        lastKey = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, navigate]);
};
