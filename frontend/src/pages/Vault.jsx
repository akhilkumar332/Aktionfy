import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Key, Trash2, Plus, ShieldCheck, Zap, Bell, Loader2, X, RefreshCw, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Vault = () => {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSecret, setNewSecret] = useState({ name: '', value: '' });
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
      const res = await axios.get('/api/v1/secrets');
      if (res.data.success) {
        setSecrets(res.data.data || []);
      }
    } catch {
      addToast('Failed to fetch secrets', 'error');
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

  const handleDelete = async (name) => {
    if (!confirm(`Terminate secret "${name}" linkage?`)) return;
    try {
      await axios.delete(`/api/v1/secrets/${name}`);
      addToast(`Secret "${name}" decoupled`);
      fetchData();
    } catch {
      addToast(`Failed to decouple secret`, 'error');
    }
  };

  const handleUpsert = async (e) => {
    e.preventDefault();
    if (!newSecret.name || !newSecret.value) {
      addToast('Identity and value required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/v1/secrets', newSecret);
      addToast(`Secret "${newSecret.name}" encrypted and stored`);
      setNewSecret({ name: '', value: '' });
      setShowAddForm(false);
      fetchData();
    } catch {
      addToast('Failed to store secret', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Secret Vault</h1>
          <p className="text-zinc-500 text-xs font-medium mt-1">Encrypted credential and private key persistence buffer.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={fetchData}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-500 hover:text-white transition-all"
             aria-label="Refresh secrets"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => setShowAddForm(true)}
            className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
          >
            <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Store Secret</span>
          </button>
        </div>
      </header>

      {/* Add Secret Form Modal */}
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
              className="bg-zinc-950 border border-zinc-800 p-8 rounded-lg shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Deposit Identity</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">PROTOCOL: SECURE_VAULT_DEPOSIT</p>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-zinc-500 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpsert} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Secret Identity (Key)</label>
                  <input 
                    type="text"
                    value={newSecret.name}
                    onChange={(e) => setNewSecret({...newSecret, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')})}
                    placeholder="INFRA_API_TOKEN"
                    className="pro-input w-full font-mono !text-xs"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Sensitive Payload</label>
                  <textarea 
                    value={newSecret.value}
                    onChange={(e) => setNewSecret({...newSecret, value: e.target.value})}
                    placeholder="Enter raw value for 256-bit encryption..."
                    rows={4}
                    className="pro-input w-full font-mono !text-xs resize-none"
                    required
                  />
                </div>
                <button 
                  disabled={submitting}
                  className="pro-button-primary w-full !py-3 !text-[11px] uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Authorize Encryption
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
                <th className="px-6 py-4">Secret Identity</th>
                <th className="px-6 py-4 text-center">Encryption</th>
                <th className="px-6 py-4 text-center">Initialized</th>
                <th className="px-6 py-4 text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Synchronizing Vault...</span>
                     </div>
                  </td>
                </tr>
              ) : secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-30">
                        <Key size={32} className="text-zinc-600" />
                        <span className="text-xs font-medium text-zinc-500 italic">Vault registry void. No encrypted identities identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <tr key={secret.name} className="pro-table-row group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:border-brand-primary/50 transition-all">
                           <Key size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-sm font-semibold text-zinc-100 truncate font-mono uppercase tracking-widest">{secret.name}</span>
                           <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter opacity-60">AES_256_GCM_BUFFER</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="pro-badge bg-zinc-950 border-zinc-800 text-zinc-500 w-fit mx-auto flex items-center gap-1.5 ring-1 ring-zinc-800/50">
                          <Shield size={10} className="text-emerald-500/50" /> Locked
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[11px] text-zinc-500 font-semibold tabular-nums uppercase">{new Date(secret.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDelete(secret.name)}
                          className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-red-500 transition-all"
                          title="Terminate Linkage"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Toast Stream */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className={`pointer-events-auto px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 min-w-[320px] backdrop-blur-md bg-zinc-900/90 ${
                toast.type === 'success' ? 'border-emerald-500/20' : 'border-red-500/20'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {toast.type === 'success' ? <Zap size={14} /> : <Bell size={14} />}
              </div>
              <span className="text-xs font-semibold tracking-tight text-zinc-100 truncate">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Vault;