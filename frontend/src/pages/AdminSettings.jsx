import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Settings, Save, Trash2, RefreshCw, AlertCircle, CheckCircle2, Zap, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminSettings = () => {
  const [settings, setSettings] = useState({ worker_prune_days: 7 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/admin/settings');
      if (res.data.success) {
        setSettings(res.data.data || { worker_prune_days: 7 });
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
      setMessage({ type: 'error', text: 'Failed to load system settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchSettings();
    };
    init();
  }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/v1/admin/settings', settings);
      setMessage({ type: 'success', text: 'System configuration synchronized successfully.' });
    } catch (err) {
      console.error('Failed to save settings', err);
      setMessage({ type: 'error', text: 'Failed to synchronize configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrune = async () => {
    if (!confirm('Authorize mass node termination? All zombie workers will be purged from the registry.')) return;
    setPruning(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post('/api/v1/admin/workers/prune');
      if (res.data.success) {
        setMessage({ type: 'success', text: `Cleanup complete. ${res.data.data.pruned_count} zombie nodes terminated.` });
      }
    } catch (err) {
      console.error('Failed to prune workers', err);
      setMessage({ type: 'error', text: 'Failed to execute node termination protocol.' });
    } finally {
      setPruning(false);
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
                <Shield size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Plane</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Control Center.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">System-Wide Protocol & Node Governance</p>
        </div>
      </header>

      <div className="max-w-4xl">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-40 flex flex-col items-center justify-center gap-6"
            >
              <RefreshCw className="animate-spin text-brand-primary" size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Control Plane...</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {message.text && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-6 rounded-[2rem] border flex items-center gap-4 ${
                    message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
                </motion.div>
              )}

              <form onSubmit={handleSave} className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-12">
                   <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-slate-400">
                      <Settings size={20} />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter">Infrastructure Tuning</h2>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Core Performance Parameters</p>
                   </div>
                </div>

                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Node Termination Threshold (Days)</label>
                    <input 
                      type="number"
                      value={settings.worker_prune_days}
                      onChange={(e) => setSettings({ ...settings, worker_prune_days: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                    />
                    <p className="text-[10px] text-slate-600 font-medium ml-4 leading-relaxed max-w-lg">
                      Inactive reaper nodes will be automatically purged from the global registry after this period. Minimum 1 day recommended.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={saving}
                    className="shimmer-button bg-brand-primary text-white px-12 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Sync Configuration
                  </button>
                </div>
              </form>

              <div className="bg-red-500/5 border border-red-500/10 rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden backdrop-blur-3xl group hover:border-red-500/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                  <div className="flex items-center gap-6">
                    <div className="bg-red-500/10 p-5 rounded-[1.5rem] text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform">
                      <Trash2 size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-1 text-red-500/80">Manual Node Reaper</h2>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Execute instantaneous cluster cleanup</p>
                    </div>
                  </div>
                  <button 
                    onClick={handlePrune}
                    disabled={pruning}
                    className="bg-red-500 text-white px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(239,68,68,0.2)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 whitespace-nowrap"
                  >
                    {pruning ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                    Initialize Purge
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;