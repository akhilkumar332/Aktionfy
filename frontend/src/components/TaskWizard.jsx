import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Loader2, Command, Cpu, GitBranch, Zap, Sparkles
} from 'lucide-react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { parseJSONField, validateStep } from '../utils/wizardUtils';

// Modular Step Components
import StepIdentity from './wizard/StepIdentity';
import StepCompute from './wizard/StepCompute';
import StepLink from './wizard/StepLink';
import StepVector from './wizard/StepVector';
import StepDeploy from './wizard/StepDeploy';

const TaskWizard = ({ isOpen, onClose, onTaskCreated, initialData, isInline = false }) => {
  const [step, setStep] = useState(1);
  const [workspaces, setWorkspaces] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showVariableSelector, setShowVariableSelector] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

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
      council: [{ name: 'AGENT_1', prompt: 'Analyze this data.' }]
    }
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
        council: [{ name: 'AGENT_1', prompt: 'Analyze this data.' }]
      }
    });
    setError(null);
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await axios.get('/api/v1/workspaces');
      if (res.data.success && isMounted.current) {
        setWorkspaces(res.data.data || []);
        if (res.data.data?.length > 0) {
          setFormData(prev => ({ ...prev, workspace_id: prev.workspace_id || res.data.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      if (isMounted.current) setLoadingWorkspaces(false);
    }
  }, []);

  const fetchUserTasks = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/tasks');
      if (res.data.success && isMounted.current) {
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
          if (isMounted.current) {
            setFormData(prev => ({
              ...prev,
              ...initialData,
              trigger_config: parseJSONField(initialData.trigger_config, prev.trigger_config),
              branch_condition: parseJSONField(initialData.branch_condition, prev.branch_condition),
              swarm_config: parseJSONField(initialData.swarm_config, prev.swarm_config)
            }));
          }
        } else {
          resetForm();
        }
      };
      applyInitialData();
    }
  }, [isOpen, initialData, resetForm]);

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
        if (isMounted.current) {
          onTaskCreated(res.data.data);
          onClose();
        }
      } else {
        if (isMounted.current) {
          setError(res.data.error || `Failed to ${initialData?.id ? 'update' : 'create'} task`);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.response?.data?.error || 'An error occurred during submission');
      }
    } finally {
      if (isMounted.current) setSubmitting(false);
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

  const isCurrentStepValid = validateStep(step, formData);

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
            <StepIdentity 
              formData={formData} 
              updateFormData={updateFormData} 
              workspaces={workspaces} 
              loadingWorkspaces={loadingWorkspaces} 
            />
          )}

          {step === 2 && (
            <StepCompute 
              formData={formData} 
              updateFormData={updateFormData} 
              showVariableSelector={showVariableSelector} 
              setShowVariableSelector={setShowVariableSelector} 
            />
          )}

          {step === 3 && (
            <StepLink 
              formData={formData} 
              updateFormData={updateFormData} 
              userTasks={userTasks} 
            />
          )}

          {step === 4 && (
            <StepVector 
              formData={formData} 
              updateFormData={updateFormData} 
              setFormData={setFormData} 
            />
          )}

          {step === 5 && (
            <StepDeploy 
              formData={formData} 
              error={error} 
            />
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
               disabled={!isCurrentStepValid}
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
