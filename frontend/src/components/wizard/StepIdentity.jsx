import { motion } from 'framer-motion';
import { Globe, Loader2, Check } from 'lucide-react';

const StepIdentity = ({ formData, updateFormData, workspaces, loadingWorkspaces }) => {
  const nameError = formData.name && /\s/.test(formData.name) ? "NAME_RESTRICTION: NO_SPACES_ALLOWED" : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      className="space-y-8"
    >
      <div className="space-y-3">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Node Designation</label>
        <input 
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData('name', e.target.value.toUpperCase())}
          placeholder="e.g. ALPHA_SYNC_STREAM"
          className={`w-full pro-input !py-3 font-mono !text-xs ${nameError ? 'border-red-500/50' : ''}`}
          autoFocus
        />
        {nameError && (
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-1">{nameError}</p>
        )}
      </div>

      <div className="space-y-4">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Sector Authorization</label>
        {loadingWorkspaces ? (
          <div className="py-12 flex flex-col items-center gap-2 opacity-50">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Syncing Sectors...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workspaces.map(w => (
              <button 
                key={w.id}
                type="button"
                onClick={() => updateFormData('workspace_id', w.id)}
                className={`p-4 rounded-xl border text-left transition-all group relative overflow-hidden ${formData.workspace_id === w.id ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`p-2 rounded-lg ${formData.workspace_id === w.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-zinc-950 text-zinc-600 group-hover:text-zinc-400'}`}>
                    <Globe size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-100 truncate">{w.name}</div>
                    <div className="text-[9px] text-zinc-500 font-mono tracking-tighter uppercase opacity-60">REF: {w.id?.substring(0, 13)}</div>
                  </div>
                  {formData.workspace_id === w.id && <Check size={16} className="ml-auto text-indigo-400" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StepIdentity;
