import { motion } from 'framer-motion';
import { Zap, GitBranch, RefreshCcw } from 'lucide-react';

const StepLink = ({ formData, updateFormData, userTasks }) => {
  const parent = userTasks.find(t => t.id === formData.depends_on_task_id);
  const isRouter = parent?.task_type === 'decision_router' || parent?.task_type === 'swarm_router';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      className="space-y-8"
    >
      <div className="space-y-3">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Dependency Link</label>
        <select 
          value={formData.depends_on_task_id || ''}
          onChange={(e) => updateFormData('depends_on_task_id', e.target.value)}
          className="w-full pro-input !py-4 font-mono !text-xs appearance-none cursor-pointer"
        >
          <option value="">Standalone Cluster</option>
          {userTasks.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.id.substring(0, 8)})</option>
          ))}
        </select>
      </div>

      {formData.depends_on_task_id && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-2xl group hover:border-indigo-500/30 transition-all shadow-sm">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-xl transition-all ${formData.trigger_on_completion ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-950 text-zinc-700'}`}>
                  <Zap size={18} />
               </div>
               <div>
                  <div className="text-xs font-bold text-zinc-100">Sequential Cascade</div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Fire automatically after parent</p>
               </div>
            </div>
            <button 
              type="button"
              onClick={() => updateFormData('trigger_on_completion', !formData.trigger_on_completion)}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.trigger_on_completion ? 'bg-indigo-600' : 'bg-zinc-950 border border-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.trigger_on_completion ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-700">
                  <GitBranch size={18} />
               </div>
               <div>
                  <div className="text-xs font-bold text-zinc-100">Logic Filter</div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Conditional routing expression</p>
               </div>
            </div>
            <div className="flex gap-2">
              {!isRouter && (
                <select 
                  value={formData.branch_condition.if || 'contains'}
                  onChange={(e) => updateFormData('branch_condition', { ...formData.branch_condition, if: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest focus:outline-none"
                >
                  <option value="contains">CONTAINS</option>
                  <option value="equals">EQUALS</option>
                </select>
              )}
              <input 
                type="text"
                value={isRouter ? (formData.branch_condition.key || '') : (formData.branch_condition.value || '')}
                onChange={(e) => {
                  const newCond = { ...formData.branch_condition };
                  if (isRouter) newCond.key = e.target.value;
                  else newCond.value = e.target.value;
                  updateFormData('branch_condition', newCond);
                }}
                placeholder={isRouter ? "e.g. ALPHA_SUCCESS" : "e.g. error, success"}
                className="w-full pro-input !py-3 font-mono !text-[11px] !bg-zinc-950"
              />
            </div>
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-zinc-800/50 space-y-4">
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-xl transition-all ${formData.loop_condition?.enabled ? 'bg-emerald-600 text-white shadow-lg' : 'bg-zinc-950 text-zinc-700'}`}>
                  <RefreshCcw size={18} />
               </div>
               <div>
                  <div className="text-xs font-bold text-zinc-100">Workflow Looping</div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">State-aware iterative re-runs</p>
               </div>
            </div>
            <button 
              type="button"
              onClick={() => updateFormData('loop_condition', { ...formData.loop_condition, enabled: !formData.loop_condition?.enabled })}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.loop_condition?.enabled ? 'bg-emerald-600' : 'bg-zinc-950 border border-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.loop_condition?.enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {formData.loop_condition?.enabled && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 overflow-hidden pt-2"
            >
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="text"
                  value={formData.loop_condition.variable || ''}
                  onChange={(e) => updateFormData('loop_condition', { ...formData.loop_condition, variable: e.target.value })}
                  placeholder="Variable (e.g. status)"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/30 shadow-inner"
                />
                <select 
                  value={formData.loop_condition.operator || 'equals'}
                  onChange={(e) => updateFormData('loop_condition', { ...formData.loop_condition, operator: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest focus:outline-none"
                >
                  <option value="equals">==</option>
                  <option value="not_equals">!=</option>
                  <option value="greater_than">&gt;</option>
                  <option value="less_than">&lt;</option>
                  <option value="contains">CONTAINS</option>
                </select>
                <input 
                  type="text"
                  value={formData.loop_condition.value || ''}
                  onChange={(e) => updateFormData('loop_condition', { ...formData.loop_condition, value: e.target.value })}
                  placeholder="Value"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/30 shadow-inner"
                />
              </div>
              <p className="text-[9px] text-zinc-500 italic ml-1">Task will re-run as long as this condition is met.</p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StepLink;
