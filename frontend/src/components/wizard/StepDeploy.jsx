import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

const StepDeploy = ({ formData, error }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      className="space-y-8"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-8 shadow-inner relative overflow-hidden">
         <div className="grid grid-cols-2 gap-8 relative z-10">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Node ID</span>
              <p className="text-sm font-bold text-white tracking-tight truncate uppercase">{formData.name || 'UNNAMED_STREAM'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Compute Core</span>
              <p className="text-sm font-bold text-brand-primary tracking-tight uppercase">{formData.task_type.replace(/_/g, ' ')}</p>
            </div>
         </div>
         <div className="pt-6 border-t border-zinc-800/50">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Logic Digest</span>
            <div className="mt-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 font-mono text-[10px] text-zinc-400 overflow-y-auto max-h-40 custom-scrollbar">
               {formData.task_type === 'swarm_router' ? 'SWARM_PROTOCOL_INIT' : (formData.task_type === 'native_action' ? formData.native_code : formData.agent_prompt) || 'NULL_BUFFER'}
            </div>
         </div>
      </div>
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 animate-shake">
           <ShieldAlert size={14} /> {error}
        </div>
      )}
    </motion.div>
  );
};

export default StepDeploy;
