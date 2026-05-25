import ProModal from './ProModal';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // warning, danger, info
  isPending = false
}) => {
  
  const getIcon = () => {
    switch(type) {
      case 'danger': return <AlertTriangle size={24} className="text-rose-500" />;
      case 'warning': return <AlertTriangle size={24} className="text-amber-500" />;
      case 'info': return <Info size={24} className="text-indigo-500" />;
      case 'success': return <CheckCircle size={24} className="text-emerald-500" />;
      default: return null;
    }
  };

  const getConfirmButtonClass = () => {
    if (isPending) return 'bg-zinc-700 text-zinc-400 cursor-not-allowed';
    
    switch(type) {
      case 'danger': return 'bg-rose-500 hover:bg-rose-600 text-white';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'info':
      case 'success':
      default: return 'pro-button-primary';
    }
  };

  return (
    <ProModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className={`p-4 rounded-full ${
          type === 'danger' ? 'bg-rose-500/10' : 
          type === 'warning' ? 'bg-amber-500/10' : 
          'bg-indigo-500/10'
        }`}>
          {getIcon()}
        </div>
        
        <p className="text-sm text-zinc-300">
          {message}
        </p>
        
        <div className="flex items-center gap-3 w-full pt-4 mt-4 border-t border-zinc-800/50">
          <button 
            onClick={onClose}
            disabled={isPending}
            className="flex-1 pro-button-secondary"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${getConfirmButtonClass()}`}
          >
            {isPending ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </ProModal>
  );
};

export default ConfirmDialog;
