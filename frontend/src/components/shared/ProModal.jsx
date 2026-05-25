import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const ProModal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md', className = '' }) => {
  
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
          className={`relative w-full ${maxWidth} glass-surface rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
            <h2 id="modal-title" className="text-lg font-bold text-white tracking-tight">
              {title}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  // Use portal to render outside the DOM hierarchy
  return createPortal(modalContent, document.body);
};

export default ProModal;
