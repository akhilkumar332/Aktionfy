import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { X, ShieldAlert, CheckCircle, Info } from 'lucide-react';

const NotificationHub = () => {
  const { notifications, dismiss } = useNotify();

  return (
    <div className="fixed top-6 right-6 z-[300] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto"
          >
            <div className={`
              pro-card p-4 flex gap-4 relative overflow-hidden group
              ${n.type === 'ERROR' ? 'border-rose-500/50 bg-rose-500/10' : 
                n.type === 'SUCCESS' ? 'border-emerald-500/50 bg-emerald-500/10' : 
                'border-amber-500/50 bg-amber-500/10'}
            `}>
              <div className={`mt-0.5 ${
                n.type === 'ERROR' ? 'text-rose-500' : 
                n.type === 'SUCCESS' ? 'text-emerald-500' : 
                'text-amber-500'
              }`}>
                {n.type === 'ERROR' ? <ShieldAlert size={18} /> : 
                 n.type === 'SUCCESS' ? <CheckCircle size={18} /> : 
                 <Info size={18} />}
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                  {n.type === 'ERROR' ? 'CRITICAL_SIGNAL_LOSS' : 
                   n.type === 'SUCCESS' ? 'PROTOCOL_COMMITTED' : 
                   'NEURAL_INTERFERENCE'}
                </div>
                <div className="text-xs font-bold text-white">{n.message}</div>
                {n.details && <div className="text-[9px] text-zinc-400 mt-1 font-mono">{n.details}</div>}
              </div>
              <button 
                onClick={() => dismiss(n.id)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
              {/* Progress bar for auto-dismiss */}
              {n.type !== 'ERROR' && (
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: 5, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-0.5 ${
                    n.type === 'SUCCESS' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationHub;
