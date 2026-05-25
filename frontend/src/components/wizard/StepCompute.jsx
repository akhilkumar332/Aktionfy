import { motion } from 'framer-motion';
import { Cpu, Terminal, GitBranch, Users, Link2, Plus, Trash2, Zap, Check, Shield } from 'lucide-react';

const StepCompute = ({ formData, updateFormData, showVariableSelector, setShowVariableSelector }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      className="space-y-8"
    >
      <div className="space-y-4">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Execution Architecture</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'mcp_sampling', icon: Cpu, label: 'LLM Node', textClass: 'text-indigo-500', borderClass: 'border-indigo-500/50', ringClass: 'ring-indigo-500/30' },
            { id: 'native_action', icon: Terminal, label: 'Sandbox', textClass: 'text-blue-500', borderClass: 'border-blue-500/50', ringClass: 'ring-blue-500/30' },
            { id: 'decision_router', icon: GitBranch, label: 'Router', textClass: 'text-emerald-500', borderClass: 'border-emerald-500/50', ringClass: 'ring-emerald-500/30' },
            { id: 'swarm_router', icon: Users, label: 'Swarm', textClass: 'text-purple-500', borderClass: 'border-purple-500/50', ringClass: 'ring-purple-500/30' }
          ].map((type) => (
            <button 
              key={type.id}
              type="button"
              onClick={() => updateFormData('task_type', type.id)}
              className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 text-center ${formData.task_type === type.id ? `bg-zinc-900 ${type.borderClass} ring-1 ${type.ringClass} shadow-lg` : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
            >
              <type.icon size={20} className={formData.task_type === type.id ? type.textClass : 'text-zinc-600'} />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between ml-1">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Logic Manifest</label>
          {formData.task_type !== 'swarm_router' && (
            <button 
              type="button"
              onClick={() => setShowVariableSelector(!showVariableSelector)}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 uppercase tracking-widest hover:text-white transition-all"
            >
              <Link2 size={12} className="text-indigo-400" /> Variables
            </button>
          )}
        </div>

        {formData.task_type === 'swarm_router' ? (
          <div className="space-y-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'voting', label: 'Democratic', icon: Check, textClass: 'text-emerald-500', borderClass: 'border-emerald-500/50', ringClass: 'ring-emerald-500/30' },
                { id: 'supervisor', label: 'Hierarchical', icon: Shield, textClass: 'text-indigo-500', borderClass: 'border-indigo-500/50', ringClass: 'ring-indigo-500/30' }
              ].map((mode) => (
                <button 
                  key={mode.id}
                  type="button"
                  onClick={() => updateFormData('swarm_config', { ...formData.swarm_config, consensus_mode: mode.id })}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.swarm_config.consensus_mode === mode.id ? `bg-zinc-900 ${mode.borderClass} ring-1 ${mode.ringClass}` : 'bg-zinc-900 border-zinc-800'}`}
                >
                  <mode.icon size={14} className={formData.swarm_config.consensus_mode === mode.id ? mode.textClass : 'text-zinc-600'} />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">{mode.label}</span>
                </button>
              ))}
            </div>

            {formData.swarm_config.consensus_mode === 'supervisor' && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Supervisor Persona</label>
                <textarea 
                  value={formData.swarm_config.supervisor_prompt}
                  onChange={(e) => updateFormData('swarm_config', { ...formData.swarm_config, supervisor_prompt: e.target.value })}
                  className="w-full pro-input !py-3 !text-[11px] h-24 font-mono shadow-inner resize-none"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Agent Council</span>
                <button 
                  type="button"
                  onClick={() => {
                    const newCouncil = [...formData.swarm_config.council, { name: `Agent ${formData.swarm_config.council.length + 1}`, prompt: '' }];
                    updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                  }}
                  className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus size={10} /> Enlist Actor
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {formData.swarm_config.council.map((agent, idx) => (
                  <div key={idx} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3 relative group">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-zinc-700">0{idx + 1}</span>
                      <input 
                        value={agent.name}
                        onChange={(e) => {
                          const newCouncil = [...formData.swarm_config.council];
                          newCouncil[idx].name = e.target.value.toUpperCase();
                          updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                        }}
                        className="bg-transparent text-[10px] font-bold text-white uppercase tracking-widest focus:outline-none flex-1"
                        placeholder="Designation..."
                      />
                      <button 
                        type="button"
                        onClick={() => {
                        const newCouncil = formData.swarm_config.council.filter((_, i) => i !== idx);
                        updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                      }} className="p-1 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <textarea 
                      value={agent.prompt}
                      onChange={(e) => {
                        const newCouncil = [...formData.swarm_config.council];
                        newCouncil[idx].prompt = e.target.value;
                        updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                      }}
                      placeholder="Logic definition..."
                      className="w-full bg-zinc-950 border border-zinc-800/50 rounded-lg p-3 text-[10px] text-zinc-300 focus:outline-none focus:border-indigo-500/30 h-20 resize-none shadow-inner"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <textarea 
              value={formData.task_type === 'native_action' ? formData.native_code : formData.agent_prompt}
              onChange={(e) => updateFormData(formData.task_type === 'native_action' ? 'native_code' : 'agent_prompt', e.target.value)}
              placeholder={formData.task_type === 'mcp_sampling' ? "Establish objectives..." : "// Logic kernel..."}
              className="w-full pro-input !py-5 h-64 font-mono !text-[11px] shadow-inner resize-none custom-scrollbar"
            />
            <div className="absolute top-4 right-4 opacity-5 pointer-events-none group-focus-within:opacity-20 transition-opacity">
               <Zap size={32} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-zinc-900">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Reliability & Resilience</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Max Retries</label>
              <span className="text-[10px] font-mono text-indigo-400 font-bold">{formData.max_retries} ATTEMPTS</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              value={formData.max_retries}
              onChange={(e) => updateFormData('max_retries', parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Backoff Strategy</label>
            <div className="flex gap-2">
              {['exponential', 'linear', 'fixed'].map(strategy => (
                <button
                  key={strategy}
                  type="button"
                  onClick={() => updateFormData('backoff_strategy', strategy)}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${formData.backoff_strategy === strategy ? 'bg-indigo-600/10 border-indigo-500/50 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {strategy}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StepCompute;
