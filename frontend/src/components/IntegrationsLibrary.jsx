import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Box, Globe, MessageSquare, Database, Github } from 'lucide-react';
import axios from 'axios';
import { useNotify } from '../context/NotificationContext';

const INTEGRATIONS = [
  { id: 'github_create_issue', name: 'GitHub Action', desc: 'Create issues, trigger workflows', icon: Github, color: 'text-white' },
  { id: 'slack_post_message', name: 'Slack Notify', desc: 'Post messages to channels', icon: MessageSquare, color: 'text-[#E01E5A]' },
  { id: 'http_request', name: 'HTTP Request', desc: 'Make external API calls', icon: Globe, color: 'text-emerald-400' },
  { id: 'native_sql', name: 'Database Query', desc: 'Execute native SQL', icon: Database, color: 'text-blue-400' },
];

export default function IntegrationsLibrary({ isOpen, onClose, onNodeAdded }) {
  const { notify } = useNotify();

  const handleAddNode = async (integration) => {
    try {
      await axios.post('/api/v1/tasks', {
        name: `New ${integration.name}`,
        task_type: 'integration_action',
        integration_id: integration.id,
        trigger_type: 'interval',
        trigger_config: JSON.stringify({ minutes: 5 }),
        agent_prompt: 'Execute integration',
        requires_approval: false,
        trigger_on_completion: true,
      });
      notify('SUCCESS', `Added ${integration.name} to canvas`);
      onNodeAdded();
      onClose();
    } catch (err) {
      notify('ERROR', 'Failed to add integration', err.response?.data?.error || err.message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 h-full w-96 pro-glass-panel border-l border-white/5 z-50 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Box className="text-brand-primary" size={24} />
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight uppercase">Integrations</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Native Plugins</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {INTEGRATIONS.map(int => (
                <div 
                  key={int.id}
                  onClick={() => handleAddNode(int)}
                  className="pro-card p-4 flex items-center gap-4 cursor-pointer hover:border-brand-primary/50 group"
                >
                  <div className={`p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${int.color}`}>
                    <int.icon size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{int.name}</h4>
                    <p className="text-xs text-zinc-400">{int.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
