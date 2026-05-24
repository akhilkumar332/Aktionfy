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
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState(null);

  const fetchDeliveries = useCallback(async (webhookId) => {
    setLoadingDeliveries(true);
    try {
      const res = await axios.get(`/api/v1/webhooks/${webhookId}/deliveries`);
      if (res.data.success) {
        setDeliveries(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch deliveries', err.response?.data?.error || err.message);
    } finally {
      setLoadingDeliveries(false);
    }
  }, [notify]);

  const handleTestWebhook = async (webhookId) => {
    setTestingWebhookId(webhookId);
    try {
      const res = await axios.post(`/api/v1/webhooks/${webhookId}/test`);
      if (res.data.success) {
        notify('SUCCESS', 'Test payload delivered successfully!');
        if (selectedWebhook?.id === webhookId) {
          fetchDeliveries(webhookId);
        }
      } else {
        notify('ERROR', 'Webhook delivery test failed', res.data.error);
        if (selectedWebhook?.id === webhookId) {
          fetchDeliveries(webhookId);
        }
      }
    } catch (err) {
      notify('ERROR', 'Failed to trigger test payload', err.response?.data?.error || err.message);
    } finally {
      setTestingWebhookId(null);
    }
  };

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
                      <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
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
                          <>
                            <button
                              onClick={() => handleTestWebhook(webhook.id)}
                              disabled={testingWebhookId === webhook.id}
                              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-all shadow-sm disabled:opacity-50"
                              title="Test Webhook (Ping)"
                            >
                              {testingWebhookId === webhook.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Zap size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedWebhook(webhook);
                                fetchDeliveries(webhook.id);
                              }}
                              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-blue-400 hover:border-blue-500/30 transition-all shadow-sm"
                              title="View Delivery History"
                            >
                              <Activity size={14} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(webhook.id)}
                              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-red-500 hover:border-red-500/30 transition-all shadow-sm"
                              title="Terminate Linkage"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
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

      {/* Deliveries Drawer */}
      <AnimatePresence>
        {selectedWebhook && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWebhook(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-zinc-950 border-l border-zinc-800 w-full max-w-2xl h-full relative z-10 flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Delivery History</h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5 font-mono truncate max-w-md">
                    {selectedWebhook.endpoint_url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fetchDeliveries(selectedWebhook.id)}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
                  >
                    <RefreshCw size={16} className={loadingDeliveries ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setSelectedWebhook(null)} 
                    className="text-zinc-400 hover:text-white p-2"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                {loadingDeliveries ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Retrieving Logs...</span>
                  </div>
                ) : deliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <Activity size={32} className="text-zinc-700 animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">No Webhook Deliveries</p>
                      <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                        This webhook hasn't received any events yet. Click the "Test Connection" button to dispatch a mock ping.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTestWebhook(selectedWebhook.id)}
                      disabled={testingWebhookId === selectedWebhook.id}
                      className="pro-button-secondary !py-2 !px-4 flex items-center gap-2 mt-2"
                    >
                      <Zap size={14} />
                      <span className="text-[10px] uppercase tracking-widest">Test Linkage</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliveries.map((delivery) => (
                      <div key={delivery.id} className="pro-card p-5 space-y-4 border border-zinc-800 hover:border-zinc-700/50 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${delivery.success ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                              {delivery.event_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                              delivery.status_code && delivery.status_code >= 200 && delivery.status_code < 300 
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                : 'bg-red-500/10 border border-red-500/20 text-red-400'
                            }`}>
                              HTTP {delivery.status_code || 'ERR'}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
                              {new Date(delivery.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {delivery.response_body && (
                          <div className="space-y-2">
                            <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Response Body</div>
                            <pre className="p-4 bg-zinc-900 border border-zinc-850 rounded-lg text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                              {delivery.response_body}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Webhooks;