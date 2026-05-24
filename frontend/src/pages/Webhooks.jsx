import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Webhook, Trash2, Plus, ShieldCheck, Zap, Loader2, X, Activity, RefreshCw, Command, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const Webhooks = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ endpoint_url: '', event_types: ['task_executed'] });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [createdSecret, setCreatedSecret] = useState(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/webhooks');
      if (res.data.success && isMounted.current) {
        setWebhooks(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch webhooks', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchData();
    };
    addListener('webhook_updated', handleUpdate);
    return () => removeListener('webhook_updated', handleUpdate);
  }, [addListener, removeListener, fetchData]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/v1/webhooks/${id}`);
      notify('SUCCESS', 'Webhook decoupled successfully');
      fetchData();
    } catch (err) {
      notify('ERROR', 'Failed to decouple webhook', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setConfirmDelete(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWebhook.endpoint_url) {
      notify('ERROR', 'Endpoint URL is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/api/v1/webhooks', newWebhook);
      notify('SUCCESS', 'Webhook link established successfully');
      if (isMounted.current) {
        setCreatedSecret(res.data.data.signing_secret);
        setNewWebhook({ endpoint_url: '', event_types: ['task_executed'] });
        setShowAddForm(false);
      }
      fetchData();
    } catch (err) {
      notify('ERROR', 'Failed to establish link', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Outbound Hooks</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Industrial event-driven synchronization with external neural clients.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={fetchData}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
             aria-label="Refresh hooks"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => setShowAddForm(true)}
            className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
          >
            <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Enlist Hook</span>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-zinc-950 border border-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Initialize Hook</h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">WEBHOOK_LINK_ESTABLISH</p>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-zinc-400 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Neural Endpoint (URL)</label>
                  <input 
                    type="url"
                    value={newWebhook.endpoint_url}
                    onChange={(e) => setNewWebhook({...newWebhook, endpoint_url: e.target.value})}
                    placeholder="https://api.neural-sync.io/receive"
                    className="pro-input w-full font-mono !text-xs"
                    required
                    autoFocus
                  />
                </div>
                <button 
                  disabled={submitting}
                  className="pro-button-primary w-full !py-3 !text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Authorize Integration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pro-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="pro-table-header">
                <th className="px-6 py-4">Neural Endpoint</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Synchronized</th>
                <th className="px-6 py-4 text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && webhooks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Querying Integrations...</span>
                     </div>
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-30">
                        <Webhook size={32} className="text-zinc-300" />
                        <span className="text-xs font-medium text-zinc-400 italic">No active outbound hooks identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                webhooks.map((webhook) => (
                  <tr key={webhook.id} className="pro-table-row group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/50 transition-all">
                           <Activity size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-sm font-semibold text-zinc-100 truncate font-mono tracking-tight">{webhook.endpoint_url}</span>
                           <div className="flex items-center gap-2 text-[9px] text-zinc-300 font-mono tracking-tighter uppercase opacity-60">
                              <Command size={10} /> {webhook.id.substring(0, 13)}
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {webhook.is_active ? (
                        <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit mx-auto">
                           <Zap size={8} className="animate-pulse" /> active
                        </span>
                      ) : (
                        <span className="pro-badge bg-zinc-800 border-zinc-700 text-zinc-400 w-fit mx-auto">inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[11px] text-zinc-400 font-semibold tabular-nums uppercase">{new Date(webhook.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDelete === webhook.id ? (
                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-md p-0.5">
                            <button 
                              onClick={() => handleDelete(webhook.id)}
                              className="p-1 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                              title="Confirm Terminate"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDelete(webhook.id)}
                            className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-red-500 transition-all shadow-sm"
                            title="Terminate Linkage"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Secret Display Modal */}
      <AnimatePresence>
        {createdSecret && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreatedSecret(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-emerald-500/30 p-10 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                 <ShieldCheck size={120} className="text-emerald-500" />
              </div>
              
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                    <ShieldCheck size={24} />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Signing Secret Generated</h2>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">PROTOCOL: AUTH_INTEGRITY_HANDSHAKE</p>
                 </div>
              </div>

              <div className="space-y-6">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  The following secret is used to sign outbound payloads. Store it securely; it will not be displayed again.
                </p>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between group shadow-inner">
                   <code className="text-sm font-mono text-emerald-500 tracking-wider truncate mr-4">{createdSecret}</code>
                   <button 
                     onClick={() => {
                        navigator.clipboard.writeText(createdSecret);
                        notify('SUCCESS', 'Secret copied to clipboard');
                     }}
                     className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all shadow-xl"
                   >
                      <Copy size={18} />
                   </button>
                </div>

                <button 
                  onClick={() => setCreatedSecret(null)}
                  className="pro-button-primary w-full !py-3 !text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                  <Check size={16} /> I have saved the secret
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Webhooks;