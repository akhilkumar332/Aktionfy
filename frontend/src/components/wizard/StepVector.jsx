import { motion } from 'framer-motion';
import { Calendar, Activity, Zap, Shield } from 'lucide-react';

const StepVector = ({ formData, updateFormData, setFormData }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      className="space-y-8"
    >
      <div className="space-y-4">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Initiation Vector</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'cron', label: 'Temporal', icon: Calendar },
            { id: 'interval', label: 'Cycle', icon: Activity },
            { id: 'webhook', label: 'Endpoint', icon: Zap }
          ].map(type => (
            <button 
              key={type.id}
              type="button"
              onClick={() => {
                const defaultConfig = type.id === 'cron' ? { cron: '0 * * * *' } : type.id === 'interval' ? { minutes: 10 } : { manual: true };
                setFormData(prev => ({ ...prev, trigger_type: type.id, trigger_config: defaultConfig }));
              }}
              className={`p-5 rounded-xl border transition-all flex flex-col items-center gap-3 text-center ${formData.trigger_type === type.id ? 'bg-zinc-900 border-indigo-500/50 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
            >
              <type.icon size={18} className={formData.trigger_type === type.id ? 'text-brand-primary' : ''} />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {formData.trigger_type === 'cron' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Coordinate Expression</label>
            <input 
              type="text"
              value={formData.trigger_config.cron}
              onChange={(e) => updateFormData('trigger_config', { cron: e.target.value })}
              className="w-full pro-input !py-4 font-mono !text-sm !bg-zinc-950"
              placeholder="0 * * * *"
            />
          </div>
        )}
        {formData.trigger_type === 'interval' && (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Pulse Delay (Min)</label>
            <input 
              type="number"
              value={formData.trigger_config.minutes}
              onChange={(e) => updateFormData('trigger_config', { minutes: parseInt(e.target.value) })}
              className="w-full pro-input !py-4 font-mono !text-sm !bg-zinc-950"
            />
          </div>
        )}
        
        <div className="pt-6 border-t border-zinc-800/50 space-y-4">
          <div className="flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-xl transition-all ${formData.requires_approval ? 'bg-amber-500 text-white shadow-lg' : 'bg-zinc-950 text-zinc-700'}`}>
                  <Shield size={18} />
               </div>
               <div>
                  <div className="text-xs font-bold text-zinc-100">Supervised Initiation</div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Manual node authorization required</p>
               </div>
            </div>
            <button 
              type="button"
              onClick={() => updateFormData('requires_approval', !formData.requires_approval)}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.requires_approval ? 'bg-amber-500' : 'bg-zinc-950 border border-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.requires_approval ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StepVector;
