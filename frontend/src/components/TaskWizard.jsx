import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Check, Cpu, Globe, 
  Terminal, Calendar, Zap, Shield, Loader2,
  Link2, GitBranch, Users, Plus, Trash2, Command, Sparkles, Activity
} from 'lucide-react';
import axios from 'axios';

import { createPortal } from 'react-dom';

const TaskWizard = ({ isOpen, onClose, onTaskCreated, initialData, isInline = false }) => {
  // ... rest of state stays the same ...

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
    
    // Try Base64 (common for Go []byte fields)
    try {
      const decoded = decodeBase64(strField);
      if (decoded.startsWith('{') || decoded.startsWith('[')) {
        return JSON.parse(decoded);
      }
    } catch {
      // Not Base64 or not JSON decoded
    }

    // Try raw JSON string
    try {
      return JSON.parse(strField);
    } catch {
      return defaultValue;
    }
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    workspace_id: '',
    task_type: 'mcp_sampling', // 'mcp_sampling', 'native_action', 'decision_router', 'swarm_router'
    agent_prompt: '',
    native_code: '',
    trigger_type: 'cron', // 'cron', 'interval', 'webhook'
    trigger_config: { cron: '0 * * * *' }, // Default to hourly
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
        // Filter out the current task if we're editing
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
      // Prepare payload
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
    { id: 2, name: 'Architecture', icon: Cpu },
    { id: 3, name: 'Workflow', icon: GitBranch },
    { id: 4, name: 'Trigger', icon: Zap },
    { id: 5, name: 'Launch', icon: Sparkles }
  ];

  if (!isOpen) return null;

  const content = (
    <motion.div 
      initial={isInline ? { opacity: 0, x: 20 } : { opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={isInline ? { opacity: 0, x: 20 } : { opacity: 0, scale: 0.95, y: 20 }}
      className={`${isInline ? 'h-full w-full flex flex-col' : 'bg-zinc-950 border border-zinc-800/50 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]'}`}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] pointer-events-none -z-0"></div>

      {/* Header */}
      {!isInline && (
        <div className="p-10 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">
              {initialData?.id ? 'Edit Orchestration' : 'Orchestration Wizard'}
            </h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-2">Design Neural Task Flow</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <X size={24} />
          </button>
        </div>
      )}

      {/* Progress Stepper - Horizontal */}
      <div className={`flex ${isInline ? 'px-10 py-6' : 'px-10 py-8'} bg-black/40 gap-4 relative z-10`}>
        {steps.map((s) => (
          <div key={s.id} className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-500 ${step >= s.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.3)]' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600'}`}>
                  <s.icon size={16} />
               </div>
               <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-white' : 'text-zinc-600'} hidden md:inline`}>
                 {s.name}
               </span>
            </div>
            <div className={`h-1 rounded-full transition-all duration-700 ${step >= s.id ? 'bg-indigo-600' : 'bg-zinc-900/50'}`} />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto ${isInline ? 'p-10' : 'p-10'} custom-scrollbar relative z-10`}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Neural Identity (Name)</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="e.g. CORE_LOG_ANALYZER_v1"
                  className="w-full bg-black/40 border border-zinc-800/50 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                  autoFocus
                />
              </div>

              <div className="space-y-6">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Operational Workspace</label>
                {loadingWorkspaces ? (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-brand-primary rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest animate-pulse">Syncing Workspaces...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workspaces.map(w => (
                      <div 
                        key={w.id}
                        onClick={() => updateFormData('workspace_id', w.id)}
                        className={`p-6 rounded-[2rem] border transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden ${formData.workspace_id === w.id ? 'bg-indigo-600/10 border-indigo-500/40 shadow-2xl' : 'bg-zinc-900/50 border-zinc-800 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-4 relative z-10">
                          <div className={`p-3 rounded-2xl ${formData.workspace_id === w.id ? 'bg-indigo-600 text-white' : 'bg-zinc-900/50 text-zinc-500 group-hover:text-white'} transition-colors`}>
                            <Globe size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-white tracking-tight">{w.name}</div>
                            <div className="text-[9px] text-zinc-500 font-mono tracking-tighter opacity-60">REF: {w.id?.substring(0, 13)}</div>
                          </div>
                        </div>
                        {formData.workspace_id === w.id && <Check size={20} className="text-indigo-400 relative z-10" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <div className="space-y-6">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Compute Architecture</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: 'mcp_sampling', icon: Cpu, label: 'LLM Node', desc: 'AI Reasoning', color: 'brand-primary' },
                    { id: 'native_action', icon: Terminal, label: 'Sandbox', desc: 'JS Execution', color: 'blue-500' },
                    { id: 'decision_router', icon: GitBranch, label: 'Router', desc: 'Branching', color: 'indigo-500' },
                    { id: 'swarm_router', icon: Users, label: 'Swarm', desc: 'Agent Council', color: 'purple-500' }
                  ].map((type) => (
                    <button 
                      key={type.id}
                      onClick={() => updateFormData('task_type', type.id)}
                      className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-4 text-center group relative overflow-hidden ${formData.task_type === type.id ? `bg-${type.color}/10 border-${type.color}/50 shadow-2xl` : 'bg-zinc-900/50 border-zinc-800 hover:border-white/20'}`}
                    >
                      <type.icon size={28} className={formData.task_type === type.id ? `text-${type.color}` : 'text-zinc-600 group-hover:text-slate-400'} />
                      <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{type.label}</div>
                        <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter opacity-60 leading-tight">{type.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between ml-2">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                    {formData.task_type === 'swarm_router' ? 'Consensus Protocol' : 'Logic definition'}
                  </label>
                  
                  {formData.task_type !== 'swarm_router' && (
                    <div className="relative">
                      <button 
                        onClick={() => setShowVariableSelector(!showVariableSelector)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-zinc-100/10 hover:text-white transition-all"
                      >
                        <Link2 size={14} className="text-indigo-400" />
                        Variables
                      </button>
                      
                      <AnimatePresence>
                        {showVariableSelector && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-3 w-72 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-30 overflow-hidden"
                          >
                            <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50">
                              <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Neural Link Registry</div>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              {userTasks.length > 0 ? (
                                userTasks.map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => {
                                      const variable = `{{task.${t.id}.output}}`;
                                      const field = formData.task_type === 'mcp_sampling' || formData.task_type === 'decision_router' ? 'agent_prompt' : 'native_code';
                                      updateFormData(field, formData[field] + variable);
                                      setShowVariableSelector(false);
                                    }}
                                    className="w-full px-5 py-4 text-left hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/50 last:border-0 group"
                                  >
                                    <div className="text-[11px] font-black text-white group-hover:text-indigo-400 transition-colors">{t.name}</div>
                                    <div className="text-[8px] font-mono text-zinc-600 mt-1 uppercase tracking-tighter opacity-60">ID: {t.id.substring(0, 13)}</div>
                                  </button>
                                ))
                              ) : (
                                <div className="p-8 text-[10px] text-zinc-600 text-center font-bold uppercase tracking-widest opacity-50">Empty Registry</div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {formData.task_type === 'swarm_router' ? (
                  <div className="space-y-8 bg-black/40 border border-zinc-800/50 p-8 rounded-[2.5rem]">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'voting', label: 'Democratic', sub: 'Majority Wins', icon: Check, color: 'purple-500' },
                        { id: 'supervisor', label: 'Hierarchical', sub: 'Supervisor Arbiter', icon: Shield, color: 'indigo-500' }
                      ].map((mode) => (
                        <button 
                          key={mode.id}
                          onClick={() => updateFormData('swarm_config', { ...formData.swarm_config, consensus_mode: mode.id })}
                          className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-3 text-center ${formData.swarm_config.consensus_mode === mode.id ? `bg-${mode.color}/10 border-${mode.color}/50 shadow-2xl` : 'bg-zinc-900/50 border-zinc-800 hover:border-white/20'}`}
                        >
                          <mode.icon size={24} className={formData.swarm_config.consensus_mode === mode.id ? `text-${mode.color}` : 'text-zinc-600'} />
                          <div>
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">{mode.label}</div>
                            <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">{mode.sub}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {formData.swarm_config.consensus_mode === 'supervisor' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-2">Supervisor Persona</label>
                        <textarea 
                          value={formData.swarm_config.supervisor_prompt}
                          onChange={(e) => updateFormData('swarm_config', { ...formData.swarm_config, supervisor_prompt: e.target.value })}
                          className="w-full bg-black/60 border border-zinc-800/50 rounded-[1.5rem] p-5 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-all h-28 resize-none shadow-inner"
                        />
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className="flex items-center justify-between ml-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Agent Council</label>
                        <button 
                          onClick={() => {
                            const newCouncil = [...formData.swarm_config.council, { name: `Agent ${formData.swarm_config.council.length + 1}`, prompt: '' }];
                            updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[9px] font-black text-purple-400 uppercase tracking-widest hover:bg-purple-500/20 transition-all"
                        >
                          <Plus size={14} />
                          Enlist Agent
                        </button>
                      </div>

                      <div className="space-y-4 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                        {formData.swarm_config.council.map((agent, idx) => (
                          <motion.div 
                            key={idx} 
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-6 bg-zinc-100/[0.02] border border-zinc-800/50 rounded-[2rem] space-y-4 relative group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 text-[10px] font-black font-mono">
                                0{idx + 1}
                              </div>
                              <input 
                                value={agent.name}
                                onChange={(e) => {
                                  const newCouncil = [...formData.swarm_config.council];
                                  newCouncil[idx].name = e.target.value;
                                  updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                                }}
                                className="bg-transparent text-[11px] font-black text-white uppercase tracking-widest focus:outline-none w-full"
                                placeholder="Neural Designation..."
                              />
                              <button 
                                onClick={() => {
                                  const newCouncil = formData.swarm_config.council.filter((_, i) => i !== idx);
                                  updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                                }}
                                className="p-2 text-zinc-600 hover:text-red-400 transition-colors bg-zinc-900/50 rounded-lg opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <textarea 
                              value={agent.prompt}
                              onChange={(e) => {
                                const newCouncil = [...formData.swarm_config.council];
                                newCouncil[idx].prompt = e.target.value;
                                updateFormData('swarm_config', { ...formData.swarm_config, council: newCouncil });
                              }}
                              placeholder="Define specialized intelligence..."
                              className="w-full bg-black/40 border border-zinc-800/50 rounded-[1.5rem] p-4 text-xs text-slate-300 focus:outline-none focus:border-purple-500/30 transition-all h-24 resize-none"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 relative group">
                    <div className="absolute top-4 right-4 text-indigo-400 opacity-20 group-focus-within:opacity-100 transition-opacity">
                       <Zap size={24} className="animate-pulse" />
                    </div>
                    <textarea 
                      value={formData.task_type === 'native_action' ? formData.native_code : formData.agent_prompt}
                      onChange={(e) => updateFormData(formData.task_type === 'native_action' ? 'native_code' : 'agent_prompt', e.target.value)}
                      placeholder={
                        formData.task_type === 'mcp_sampling' ? "Establish AI Mission Objectives..." : 
                        formData.task_type === 'decision_router' ? "Define Neural Routing Criteria..." : 
                        "// Initialize Custom Subroutine..."
                      }
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-[2.5rem] p-8 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all h-64 resize-none shadow-inner custom-scrollbar"
                    />
                    <div className="flex items-center gap-3 text-zinc-500 ml-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 opacity-50"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        {formData.task_type === 'mcp_sampling' ? 'Continuous Intelligence Feedback enabled.' : 
                         formData.task_type === 'decision_router' ? 'Multi-path high-availability routing.' : 
                         'Sandboxed kernel execution.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <div className="space-y-6">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Neural Linkage (Dependency)</label>
                <div className="relative group">
                   <div className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 z-10 opacity-50 group-focus-within:opacity-100 transition-opacity">
                      <Link2 size={20} />
                   </div>
                   <select 
                    value={formData.depends_on_task_id || ''}
                    onChange={(e) => updateFormData('depends_on_task_id', e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800/50 rounded-[2rem] pl-16 pr-8 py-6 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer shadow-inner"
                  >
                    <option value="" className="bg-zinc-950">Standalone (No Neural Link)</option>
                    {userTasks.map(t => (
                      <option key={t.id} value={t.id} className="bg-zinc-950">{t.name} (REF: {t.id.substring(0, 8)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <AnimatePresence>
                {formData.depends_on_task_id && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between p-8 bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 group hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl transition-all duration-500 ${formData.trigger_on_completion ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-zinc-900/50 text-zinc-600'}`}>
                          <Zap size={24} className={formData.trigger_on_completion ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white uppercase tracking-widest">Sequential Cascade</div>
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight opacity-60 mt-1">Automatic execution post-parent lifecycle</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => updateFormData('trigger_on_completion', !formData.trigger_on_completion)}
                        className={`w-14 h-8 rounded-full transition-all duration-500 relative ${formData.trigger_on_completion ? 'bg-indigo-600 shadow-[0_0_20px_rgba(217,119,6,0.4)]' : 'bg-zinc-900/50 border border-zinc-800'}`}
                      >
                        <motion.div 
                          layout
                          animate={{ x: formData.trigger_on_completion ? 28 : 4 }}
                          className="absolute top-1 w-6 h-6 bg-zinc-100 rounded-full shadow-lg"
                        />
                      </button>
                    </div>

                    <div className="p-8 bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 space-y-8 group hover:border-brand-secondary/20 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-zinc-900/50 rounded-2xl text-slate-400 group-hover:text-brand-secondary transition-colors">
                          <GitBranch size={24} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white uppercase tracking-widest">Logic Filtering</div>
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight opacity-60 mt-1">Conditional evaluation of upstream payload</div>
                        </div>
                      </div>
                      
                      <div className="ml-16 space-y-4">
                        {(() => {
                          const parent = userTasks.find(t => t.id === formData.depends_on_task_id);
                          const isRouter = parent?.task_type === 'decision_router' || parent?.task_type === 'swarm_router';
                          
                          return (
                            <div className="space-y-4">
                              <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                {isRouter ? 'Protocol Route Key' : 'Payload Contents Pattern'}
                              </label>
                              
                              <input 
                                type="text"
                                value={isRouter ? (formData.branch_condition.key || '') : (formData.branch_condition.value || '')}
                                onChange={(e) => {
                                  const newCond = { ...formData.branch_condition };
                                  if (isRouter) newCond.key = e.target.value;
                                  else newCond.value = e.target.value;
                                  updateFormData('branch_condition', newCond);
                                }}
                                placeholder={isRouter ? "MATCH: 'path_alpha', 'error_red'..." : "CONTAINS: 'urgent', 'sync_fail'..."}
                                className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-5 text-white font-mono text-xs focus:outline-none focus:border-brand-secondary/50 transition-all shadow-inner"
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <div className="space-y-6">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Initiation Vector (Trigger)</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'cron', label: 'Temporal', sub: 'Cron Stream', icon: Calendar },
                    { id: 'interval', label: 'Frequency', sub: 'Pulse Mode', icon: Activity },
                    { id: 'webhook', label: 'Event', sub: 'Neural Hook', icon: Zap }
                  ].map(type => (
                    <button 
                      key={type.id}
                      onClick={() => {
                        const defaultConfig = type.id === 'cron' ? { cron: '0 * * * *' } : type.id === 'interval' ? { minutes: 10 } : { manual: true };
                        setFormData(prev => ({ ...prev, trigger_type: type.id, trigger_config: defaultConfig }));
                      }}
                      className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-3 text-center ${formData.trigger_type === type.id ? 'bg-zinc-900/50 border-indigo-500 shadow-2xl text-white' : 'bg-zinc-900/30 border-zinc-800/50 text-zinc-600 hover:border-white/20'}`}
                    >
                      <type.icon size={24} className={formData.trigger_type === type.id ? 'text-indigo-400 animate-pulse' : 'opacity-40'} />
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest">{type.label}</div>
                        <div className="text-[8px] font-bold uppercase tracking-tighter opacity-50">{type.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-10">
                {formData.trigger_type === 'cron' && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Temporal Coordinates (Cron)</label>
                    <input 
                      type="text"
                      value={formData.trigger_config.cron}
                      onChange={(e) => updateFormData('trigger_config', { cron: e.target.value })}
                      placeholder="* * * * *"
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                    />
                    <div className="p-5 bg-brand-secondary/5 border border-brand-secondary/10 rounded-[1.5rem] ml-2">
                      <p className="text-[9px] text-brand-secondary/80 font-black uppercase tracking-[0.1em]">Protocol: Standard 5-field UNIX expression supported.</p>
                    </div>
                  </div>
                )}

                {formData.trigger_type === 'interval' && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Neural Pulse Frequency (Minutes)</label>
                    <input 
                      type="number"
                      value={formData.trigger_config.minutes}
                      onChange={(e) => updateFormData('trigger_config', { minutes: parseInt(e.target.value) })}
                      placeholder="10"
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                    />
                  </div>
                )}

                {formData.trigger_type === 'webhook' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-10 border border-dashed border-zinc-800 rounded-[3rem] text-center space-y-6 bg-zinc-900/30"
                  >
                    <div className="relative w-fit mx-auto">
                       <Zap size={48} className="text-indigo-400" />
                       <div className="absolute inset-0 bg-indigo-600 blur-2xl opacity-20 animate-pulse"></div>
                    </div>
                    <div>
                      <p className="text-sm text-white font-black uppercase tracking-widest">Listener Protocol Initialized</p>
                      <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest font-bold max-w-xs mx-auto leading-relaxed">Unique endpoint signature will be generated upon orchestration launch.</p>
                    </div>
                  </motion.div>
                )}

                <div className="pt-10 border-t border-zinc-800/50 space-y-8">
                  <div className="flex items-center justify-between p-8 bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800/50 group hover:border-amber-500/20 transition-all">
                    <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-2xl transition-all duration-500 ${formData.requires_approval ? 'bg-amber-500 text-white shadow-2xl' : 'bg-zinc-900/50 text-zinc-600'}`}>
                        <Shield size={24} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-white uppercase tracking-widest">Supervised Launch</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight opacity-60 mt-1">Manual node authorization required before firing</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => updateFormData('requires_approval', !formData.requires_approval)}
                      className={`w-14 h-8 rounded-full transition-all duration-500 relative ${formData.requires_approval ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-zinc-900/50 border border-zinc-800'}`}
                    >
                      <motion.div 
                        layout
                        animate={{ x: formData.requires_approval ? 28 : 4 }}
                        className="absolute top-1 w-6 h-6 bg-zinc-100 rounded-full shadow-lg"
                      />
                    </button>
                  </div>

                  <div className="space-y-6">
                     <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Failure Mitigation (Missed Policy)</label>
                     <div className="flex gap-4">
                        {[
                          { id: 'skip', label: 'Bypass', desc: 'Silence Missed' },
                          { id: 'run_immediately', label: 'Recovery', desc: 'Auto-Catchup' }
                        ].map(policy => (
                          <button 
                            key={policy.id}
                            onClick={() => updateFormData('missed_task_policy', policy.id)}
                            className={`flex-1 p-6 rounded-[2rem] border transition-all text-center group ${formData.missed_task_policy === policy.id ? 'bg-zinc-900/50 border-white/40 text-white shadow-2xl' : 'bg-zinc-900/30 border-zinc-800/50 text-zinc-600 hover:border-white/20'}`}
                          >
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1">{policy.label}</div>
                            <div className="text-[8px] font-bold uppercase tracking-tighter opacity-50">{policy.desc}</div>
                          </button>
                        ))}
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <div className="bg-black/40 border border-zinc-800 rounded-[3rem] p-10 space-y-10 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 blur-[80px] pointer-events-none"></div>

                 <div className="grid grid-cols-2 md:grid-cols-3 gap-10 relative z-10">
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Orchestration ID</div>
                      <div className="text-white font-black text-lg tracking-tight truncate">{formData.name || 'UNNAMED_CORE'}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Compute Core</div>
                      <div className="text-indigo-400 font-black text-lg tracking-tight flex items-center gap-2">
                         {formData.task_type === 'mcp_sampling' ? 'LLM_SAMPLER' : 
                          formData.task_type === 'decision_router' ? 'NEURAL_ROUTER' : 
                          formData.task_type === 'swarm_router' ? 'AGENT_SWARM' : 'SANDBOX_KERNEL'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Vector</div>
                      <div className="text-white font-black text-lg tracking-tight uppercase">{formData.trigger_type}</div>
                    </div>
                 </div>

                 <div className="pt-10 border-t border-zinc-800/50 relative z-10">
                    <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-6">Payload Manifest</div>
                    <div className="bg-zinc-950/80 rounded-3xl p-8 font-mono text-[11px] text-emerald-500/80 border border-zinc-800/50 shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
                       {formData.task_type === 'swarm_router' ? 
                         `SWARM_INIT (MODE: ${formData.swarm_config.consensus_mode.toUpperCase()}) :: MEMBERS: [${formData.swarm_config.council.map(a => a.name.toUpperCase()).join(', ')}]` : 
                         (formData.task_type === 'native_action' ? formData.native_code : formData.agent_prompt)}
                    </div>
                 </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center gap-4 text-red-400"
                >
                  <Shield size={20} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em]">{error}</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controller Footer */}
      <div className={`${isInline ? 'p-10' : 'p-10'} border-t border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10`}>
        <button 
          onClick={handleBack}
          disabled={step === 1 || submitting}
          className="flex items-center gap-3 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] hover:text-white transition-all disabled:opacity-0 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        
        <div className="flex gap-4">
           {step < 5 ? (
             <button 
               onClick={handleNext}
               disabled={!formData.name || (step === 1 && !formData.workspace_id)}
               className="bg-zinc-100 text-zinc-950 px-12 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all disabled:opacity-20 flex items-center gap-3 group"
             >
               {isInline ? 'Next Phase' : 'Continue'} <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
             </button>
           ) : (
             <button 
               onClick={handleSubmit}
               disabled={submitting}
               className=" bg-indigo-600 text-white px-14 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(217,119,6,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
             >
               {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
               {initialData?.id ? 'Synchronize' : 'Fire Orchestration'}
             </button>
           )}
        </div>
      </div>
    </motion.div>
  );

  if (isInline) return content;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
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