import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Key, Trash2, Plus, ShieldCheck, Zap, Bell, Loader2, X, RefreshCw } from 'lucide-react';
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
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-500">
                <ShieldCheck size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Security Sector</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Secret Vault.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Encrypted Credential & Key Buffer</p>
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
            <Plus size={16} /> Store Identity
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
              className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-obsidian-900 border border-white/5 p-12 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">New Secret</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Protocol: SECURE_VAULT_DEPOSIT</p>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white transition-colors p-3 bg-white/5 rounded-2xl border border-white/10">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpsert} className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Secret Designation (Identity)</label>
                  <input 
                    type="text"
                    value={newSecret.name}
                    onChange={(e) => setNewSecret({...newSecret, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')})}
                    placeholder="e.g. INFRA_CORE_TOKEN"
                    className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                    required
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Encrypted Payload</label>
                  <textarea 
                    value={newSecret.value}
                    onChange={(e) => setNewSecret({...newSecret, value: e.target.value})}
                    placeholder="Sensitive data will undergo 256-bit encryption..."
                    rows={4}
                    className="w-full bg-black/40 border border-white/5 rounded-[2.5rem] p-8 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all resize-none shadow-inner custom-scrollbar"
                    required
                  />
                </div>
                <button 
                  disabled={submitting}
                  className="shimmer-button w-full bg-brand-primary text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Authorize Encryption
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl relative">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

        {loading && secrets.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-brand-primary" size={48} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Synchronizing Neural Vault...</p>
          </div>
        ) : secrets.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center text-center gap-8">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
              <Key size={48} className="text-slate-700" />
            </div>
            <div>
              <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">Vault Registry Empty</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">No encrypted identities identified. Deposit credentials to enable autonomous authentication.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-white/[0.02] text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
                <tr>
                  <th className="px-10 py-8">Secret Designation</th>
                  <th className="px-8 py-8 text-center">Status</th>
                  <th className="px-8 py-8 text-center">Initialized</th>
                  <th className="px-10 py-8 text-right">System Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {secrets.map((secret, i) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={secret.name} 
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-6">
                        <div className="bg-obsidian-950 p-4 rounded-[1.5rem] text-brand-primary border border-white/5 group-hover:border-brand-primary/30 transition-all">
                          <Key size={20} />
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-base font-black text-white tracking-widest font-mono uppercase">{secret.name}</span>
                           <div className="flex items-center gap-2">
                              <ShieldCheck size={10} className="text-emerald-500" />
                              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">AES-256 Bit Buffer</span>
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-center">
                       <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                          Locked
                       </div>
                    </td>
                    <td className="px-8 py-8 text-center">
                      <span className="text-[11px] text-slate-500 font-black tabular-nums">{new Date(secret.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button 
                        onClick={() => handleDelete(secret.name)}
                        className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all active:scale-95"
                        title="Terminate Linkage"
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

export default Vault;