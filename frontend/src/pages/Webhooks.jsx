import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Webhook, Trash2, Plus, ShieldCheck, Zap, Bell, Loader2, X, Activity, RefreshCw, Command, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Webhooks = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ endpoint_url: '', event_types: ['task_executed'] });
  const [submitting, setSubmitting] = useState(false);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/webhooks');
      if (res.data.success) {
        setWebhooks(res.data.data || []);
      }
    } catch {
      addToast('Failed to fetch webhooks', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  const handleDelete = async (id) => {
    if (!confirm(`Terminate integration linkage?`)) return;
    try {
      await axios.delete(`/api/v1/webhooks/${id}`);
      addToast(`Webhook decoupled`);
      fetchData();
    } catch {
      addToast(`Failed to decouple webhook`, 'error');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWebhook.endpoint_url) {
      addToast('Endpoint URL is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/v1/webhooks', newWebhook);
      addToast(`Webhook link established`);
      setNewWebhook({ endpoint_url: '', event_types: ['task_executed'] });
      setShowAddForm(false);
      fetchData();
    } catch {
      addToast('Failed to establish link', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Link2 size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Connectivity Sector</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Outbound Neural Hooks.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Event-Driven External Integrations</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={fetchData}
             className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
           >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => setShowAddForm(true)}
            className="shimmer-button bg-brand-primary text-white px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3"
          >
            <Plus size={16} /> Enlist Hook
          </button>
        </div>
      </header>

      {/* Add Webhook Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-obsidian-900 border border-white/5 p-12 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Initialize Hook</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Protocol: WEBHOOK_LINK_ESTABLISH</p>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white transition-colors p-3 bg-white/5 rounded-2xl border border-white/10">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Neural Endpoint (URL)</label>
                  <input 
                    type="url"
                    value={newWebhook.endpoint_url}
                    onChange={(e) => setNewWebhook({...newWebhook, endpoint_url: e.target.value})}
                    placeholder="https://api.neural-network.io/receive"
                    className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                    required
                  />
                </div>
                <button 
                  disabled={submitting}
                  className="shimmer-button w-full bg-brand-primary text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Authorize Integration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        {loading && webhooks.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-brand-primary" size={48} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Integration Registry...</p>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center text-center gap-8">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
              <Webhook size={48} className="text-slate-700" />
            </div>
            <div>
              <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">Neural Registry Void</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">No active outbound hooks identified. Enlist a new integration to begin event cascading.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-white/[0.02] text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
                <tr>
                  <th className="px-10 py-8">Neural Endpoint</th>
                  <th className="px-8 py-8 text-center">Status</th>
                  <th className="px-8 py-8 text-center">Initialized</th>
                  <th className="px-10 py-8 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {webhooks.map((webhook, i) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={webhook.id} 
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-6">
                        <div className="bg-obsidian-950 p-4 rounded-[1.5rem] text-brand-primary border border-white/5 group-hover:border-brand-primary/30 transition-all">
                          <Activity size={20} />
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-base font-black text-white tracking-tight font-mono">{webhook.endpoint_url}</span>
                           <div className="flex items-center gap-2">
                              <Command size={10} className="text-slate-600" />
                              <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase opacity-60">REF: {webhook.id.substring(0, 13)}</span>
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-center">
                      {webhook.is_active ? (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                           <Zap size={10} className="animate-pulse" /> Active
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/5 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full">
                           Inactive
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-8 text-center">
                      <span className="text-[11px] text-slate-500 font-black tabular-nums">{new Date(webhook.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button 
                        onClick={() => handleDelete(webhook.id)}
                        className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all active:scale-95"
                        title="Decouple Integration"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 20, scale: 0.9, filter: 'blur(10px)' }}
              className={`pointer-events-auto px-8 py-5 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border flex items-center gap-5 backdrop-blur-3xl min-w-[350px] ${
                toast.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {toast.type === 'success' ? <Zap size={18} /> : <Bell size={18} />}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest leading-tight">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Webhooks;