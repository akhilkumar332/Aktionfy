import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useNotify } from '../context/NotificationContext';

const SaveTemplateModal = ({ isOpen, onClose, task }) => {
  const { notify } = useNotify();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setName(task.name ? `${task.name} Template` : '');
      setDescription(task.description || '');
    }
  }, [task]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      notify('ERROR', 'Template name is required');
      return;
    }

    setSubmitting(true);
    try {
      // Structure the template config matching blueprintTask type in Go server
      const config = {
        name: task.name,
        task_type: task.task_type || 'mcp_sampling',
        agent_prompt: task.agent_prompt || '',
        native_code: task.native_code || '',
        trigger_type: task.trigger_type || 'cron',
        trigger_config: task.trigger_config || { cron: '0 * * * *' },
        requires_approval: task.requires_approval || false,
        missed_task_policy: task.missed_task_policy || 'skip',
        depends_on: task.depends_on_task_id ? String(task.depends_on_task_id) : '',
        trigger_on_completion: task.trigger_on_completion || false,
        branch_condition: task.branch_condition || { if: 'contains', value: '', key: '' },
        swarm_config: task.swarm_config || {
          consensus_mode: 'voting',
          supervisor_prompt: "You are the Executive Director. Read the council's debate and choose the best path.",
          council: [{ name: 'AGENT_1', prompt: 'Analyze this data.' }]
        },
        is_bundle_root: task.is_bundle_root || false
      };

      const res = await axios.post('/api/v1/templates', {
        name: name.trim(),
        description: description.trim(),
        config: config,
        is_public: isPublic,
        workspace_id: task.workspace_id || ''
      });

      if (res.status === 201 || res.data) {
        notify('SUCCESS', 'Successfully registered custom blueprint template');
        onClose();
      }
    } catch (err) {
      notify('ERROR', 'Failed to save template', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-400" size={18} />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight uppercase">Save As Blueprint</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Register workflow template in marketplace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Template Name</label>
            <input 
              type="text" 
              placeholder="e.g. AI Analyst Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Description</label>
            <textarea 
              placeholder="Provide context regarding inputs, MCP integrations, or agentic intents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-200">Public Access</span>
              <span className="text-[9px] text-zinc-500 font-semibold uppercase mt-0.5">Allow listing in the Intelligence Marketplace</span>
            </div>
            <input 
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/40">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Publish Template
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default SaveTemplateModal;
