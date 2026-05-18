import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Check, Cpu, Globe, 
  Terminal, Calendar, Zap, Shield, Loader2,
  Link2, GitBranch, Users, Plus, Trash2, Command, Sparkles, Activity, ShieldAlert
} from 'lucide-react';
import axios from 'axios';
import { createPortal } from 'react-dom';

const TaskWizard = ({ isOpen, onClose, onTaskCreated, initialData, isInline = false }) => {
  const [step, setStep] = useState(1);
  const [workspaces, setWorkspaces] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showVariableSelector, setShowVariableSelector] = useState(false);
  const [error, setError] = useState(null);

  const decodeBase64 = (str) => {
    if (!str) return '';
    try {
      const binary = atob(str);
      try {
        return decodeURIComponent(binary.split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch {
        return binary;
      }
    } catch {
      return str;
    }
  };

  const parseJSONField = useCallback((field, defaultValue) => {
    if (!field) return defaultValue;
    if (typeof field === 'object') return field;
    
    const strField = String(field);
    
    try {
      const decoded = decodeBase64(strField);
      if (decoded.startsWith('{') || decoded.startsWith('[')) {
        return JSON.parse(decoded);
      }
    } catch {
      // ignore
    }

    try {
      return JSON.parse(strField);
    } catch {
      return defaultValue;
    }
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    workspace_id: '',
    task_type: 'mcp_sampling', 
    agent_prompt: '',
    native_code: '',
    trigger_type: 'cron', 
    trigger_config: { cron: '0 * * * *' },
    requires_approval: false,
    missed_task_policy: 'skip',
    depends_on_task_id: '',
    trigger_on_completion: false,
    branch_condition: { if: 'contains', value: '', key: '' },
    swarm_config: {
      consensus_mode: 'voting',
      supervisor_prompt: 'You are the Executive Director. Read the council\'s debate and choose the best path.',
      council: [{ name: 'Agent 1', prompt: 'Analyze this data.' }]
    }
  });

  const resetForm = useCallback(() => {
    setStep(1);
    setFormData({
      name: '',
      workspace_id: '',
      task_type: 'mcp_sampling',
      agent_prompt: '',
      native_code: '',
      trigger_type: 'cron',
      trigger_config: { cron: '0 * * * *' },
      requires_approval: false,
      missed_task_policy: 'skip',
      depends_on_task_id: '',
      trigger_on_completion: false,
      branch_condition: { if: 'contains', value: '', key: '' },
      swarm_config: {
        consensus_mode: 'voting',
        supervisor_prompt: 'You are the Executive Director. Read the council\'s debate and choose the best path.',
        council: [{ name: 'Agent 1', prompt: 'Analyze this data.' }]
      }
    });
    setError(null);
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await axios.get('/api/v1/workspaces');
      if (res.data.success) {
        setWorkspaces(res.data.data || []);
        if (res.data.data?.length > 0) {
          setFormData(prev => ({ ...prev, workspace_id: prev.workspace_id || res.data.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  const fetchUserTasks = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/tasks');
      if (res.data.success) {
        const filteredTasks = initialData 
          ? (res.data.data || []).filter(t => t.id !== initialData.id)
          : (res.data.data || []);
        setUserTasks(filteredTasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  }, [initialData]);

  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        await fetchWorkspaces();
        await fetchUserTasks();
      };
      init();
    }
  }, [isOpen, fetchWorkspaces, fetchUserTasks]);

  useEffect(() => {
    if (isOpen) {
      const applyInitialData = async () => {
        if (initialData) {
          setFormData(prev => ({
            ...prev,
            ...initialData,
            trigger_config: parseJSONField(initialData.trigger_config, prev.trigger_config),
            branch_condition: parseJSONField(initialData.branch_condition, prev.branch_condition),
            swarm_config: parseJSONField(initialData.swarm_config, prev.swarm_config)
          }));
        } else {
          resetForm();
        }
      };
      applyInitialData();
    }
  }, [isOpen, initialData, resetForm, parseJSONField]);

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: formData.name,
        workspace_id: formData.workspace_id,
        task_type: formData.task_type,
        agent_prompt: (formData.task_type === 'mcp_sampling' || formData.task_type === 'decision_router') ? formData.agent_prompt : '',
        native_code: formData.task_type === 'native_action' ? formData.native_code : '',
        trigger_type: formData.trigger_type,
        trigger_config: formData.trigger_config,
        requires_approval: formData.requires_approval,
        missed_task_policy: formData.missed_task_policy,
        depends_on_task_id: formData.depends_on_task_id || null,
        trigger_on_completion: formData.trigger_on_completion,
        branch_condition: formData.branch_condition,
        swarm_config: formData.task_type === 'swarm_router' ? formData.swarm_config : null
      };

      let res;
      if (initialData?.id) {
        res = await axios.patch(`/api/v1/tasks/${initialData.id}`, payload);
      } else {
        res = await axios.post('/api/v1/tasks', payload);
      }

      if (res.data.success) {
        onTaskCreated(res.data.data);
        onClose();
      } else {
        setError(res.data.error || `Failed to ${initialData?.id ? 'update' : 'create'} task`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during submission');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { id: 1, name: 'Identity', icon: Command },
    { id: 2, name: 'Compute', icon: Cpu },
    { id: 3, name: 'Neural Link', icon: GitBranch },
    { id: 4, name: 'Vector', icon: Zap },
    { id: 5, name: 'Deploy', icon: Sparkles }
  ];

  if (!isOpen) return null;

  const content = (
    <motion.div 
      initial={isInline ? { opacity: 0, x: 10 } : { opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={isInline ? { opacity: 0, x: 10 } : { opacity: 0, scale: 0.98, y: 10 }}
      className={`${isInline ? 'h-full w-full flex flex-col' : 'bg-zinc-950 border border-zinc-800/50 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]'}`}
    >
      {!isInline && (
        <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight uppercase">
              {initialData?.id ? 'Calibrate Node' : 'Orchestration Wizard'}
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">PROTOCOL: TASK_INIT_V3</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all p-2 bg-zinc-900 border border-zinc-800 rounded-md">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Progress Stepper */}
      <div className={`flex ${isInline ? 'px-8 py-4' : 'px-8 py-6'} bg-zinc-950 gap-3 relative z-10`}>
        {steps.map((s) => (
          <div key={s.id} className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
               <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all duration-500 ${step >= s.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  <s.icon size={12} />
               </div>
               <span className={`text-[9px] font-black uppercase tracking-widest ${step >= s.id ? 'text-zinc-200' : 'text-zinc-600'} hidden md:inline`}>
                 {s.name}
               </span>
            </div>
            <div className={`h-0.5 rounded-full transition-all duration-700 ${step >= s.id ? 'bg-indigo-600' : 'bg-zinc-900'}`} />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Node Designation</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                  placeholder="e.g. ALPHA_SYNC_STREAM"
                  className="w-full pro-input !py-3 font-mono !text-xs"
                  autoFocus
                />
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
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Execution Architecture</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'mcp_sampling', icon: Cpu, label: 'LLM Node', color: 'indigo-500' },
                    { id: 'native_action', icon: Terminal, label: 'Sandbox', color: 'blue-500' },
                    { id: 'decision_router', icon: GitBranch, label: 'Router', color: 'emerald-500' },
                    { id: 'swarm_router', icon: Users, label: 'Swarm', color: 'purple-500' }
                  ].map((type) => (
                    <button 
                      key={type.id}
                      onClick={() => updateFormData('task_type', type.id)}
                      className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 text-center ${formData.task_type === type.id ? `bg-zinc-900 border-${type.color}/50 ring-1 ring-${type.color}/30 shadow-lg` : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                    >
                      <type.icon size={20} className={formData.task_type === type.id ? `text-${type.color}` : 'text-zinc-600'} />
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
                        { id: 'voting', label: 'Democratic', icon: Check, color: 'emerald-500' },
                        { id: 'supervisor', label: 'Hierarchical', icon: Shield, color: 'indigo-500' }
                      ].map((mode) => (
                        <button 
                          key={mode.id}
                          onClick={() => updateFormData('swarm_config', { ...formData.swarm_config, consensus_mode: mode.id })}
                          className={`p-4 rounded-xl border transition-all flex items-center justify-center gap-2 ${formData.swarm_config.consensus_mode === mode.id ? `bg-zinc-900 border-${mode.color}/50 ring-1 ring-${mode.color}/30` : 'bg-zinc-900 border-zinc-800'}`}
                        >
                          <mode.icon size={14} className={formData.swarm_config.consensus_mode === mode.id ? `text-${mode.color}` : 'text-zinc-600'} />
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
                              <button onClick={() => {
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
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-8">
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
                    <input 
                      type="text"
                      value={formData.branch_condition.key || formData.branch_condition.value || ''}
                      onChange={(e) => {
                        const parent = userTasks.find(t => t.id === formData.depends_on_task_id);
                        const isRouter = parent?.task_type === 'decision_router' || parent?.task_type === 'swarm_router';
                        const newCond = { ...formData.branch_condition };
                        if (isRouter) newCond.key = e.target.value;
                        else newCond.value = e.target.value;
                        updateFormData('branch_condition', newCond);
                      }}
                      placeholder="e.g. ALPHA_SUCCESS, ERR_RETRY"
                      className="w-full pro-input !py-3 font-mono !text-[11px] !bg-zinc-950"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-8">
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
                      onClick={() => updateFormData('requires_approval', !formData.requires_approval)}
                      className={`w-12 h-6 rounded-full transition-all relative ${formData.requires_approval ? 'bg-amber-500' : 'bg-zinc-950 border border-zinc-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.requires_approval ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-8">
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
          )}
        </AnimatePresence>
      </div>

      {/* Controller Footer */}
      <div className="p-8 border-t border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10">
        <button 
          onClick={handleBack}
          disabled={step === 1 || submitting}
          className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-all disabled:opacity-0 group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>
        
        <div className="flex gap-3">
           {step < 5 ? (
             <button 
               onClick={handleNext}
               disabled={!formData.name || (step === 1 && !formData.workspace_id)}
               className="bg-zinc-100 text-zinc-950 px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-white transition-all disabled:opacity-20 flex items-center gap-2"
             >
               Continue <ChevronRight size={14} />
             </button>
           ) : (
             <button 
               onClick={handleSubmit}
               disabled={submitting}
               className=" bg-indigo-600 text-white px-10 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
               {initialData?.id ? 'Synchronize' : 'Authorize Deploy'}
             </button>
           )}
        </div>
      </div>
    </motion.div>
  );

  if (isInline) return content;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      {content}
    </div>,
    document.body
  );
};

export default TaskWizard;