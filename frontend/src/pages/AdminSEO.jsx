import { useEffect, useState, useCallback } from 'react';

import axios from 'axios';
import { Search, Globe, RefreshCw, AlertCircle, CheckCircle2, Layout, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';

const AdminSEO = () => {
  const { notify } = useNotify();
  const [data, setData] = useState({ title: '', description: '', keywords: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchSEO = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/admin/seo');
      if (res.data.success) {
        setData(res.data.data || { title: 'Aktionfy', description: '', keywords: '' });
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch SEO data', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const init = async () => {
      await fetchSEO();
    };
    init();
  }, [fetchSEO]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/v1/admin/seo', data);
      setMessage({ type: 'success', text: 'Neural identity manifest updated and broadcasted.' });
    } catch (err) {
      notify('ERROR', 'Failed to save SEO', err.response?.data?.error || err.message);
      setMessage({ type: 'error', text: 'Failed to broadcast manifest updates.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Globe size={16} />
             </div>
             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Identity Broadcast</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Neural SEO.
          </motion.h1>
          <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Meta-Data Configuration & Global Search Presence</p>
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
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Syncing Broadcast Manifest...</p>
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
                  className={`p-6 rounded-xl border flex items-center gap-4 ${
                    message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
                </motion.div>
              )}

              <form onSubmit={handleSave} className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-12 shadow-lg relative overflow-hidden backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-12 relative z-10">
                   <div className="p-3 bg-zinc-100/5 rounded-xl border border-zinc-800/50 text-zinc-400">
                      <Layout size={20} />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter">Manifest Logic</h2>
                      <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest mt-0.5">Neural Metadata Calibration</p>
                   </div>
                </div>

                <div className="space-y-10 relative z-10">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Neural Title (Meta Title)</label>
                    <input 
                      type="text"
                      value={data.title}
                      onChange={(e) => setData({ ...data, title: e.target.value })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                      placeholder="Aktionfy | Autonomous Task Orchestration"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Broadcast Description (Meta Description)</label>
                    <textarea 
                      value={data.description}
                      onChange={(e) => setData({ ...data, description: e.target.value })}
                      rows={4}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-8 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner resize-none custom-scrollbar"
                      placeholder="Establish a high-performance state machine for your AI workflows..."
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Signal Keywords (Separated by comma)</label>
                    <input 
                      type="text"
                      value={data.keywords}
                      onChange={(e) => setData({ ...data, keywords: e.target.value })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                      placeholder="ai, mcp, automation, orchestration"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={saving}
                    className=" bg-brand-primary text-white px-12 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                    Broadcast Manifest
                  </button>
                </div>
              </form>

              <div className="bg-zinc-100/[0.01] border border-dashed border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-6">
                 <div className="w-16 h-16 bg-zinc-100/5 rounded-full flex items-center justify-center border border-zinc-800/50 text-zinc-700">
                    <Search size={32} />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-zinc-300 uppercase tracking-widest">Signal Preview</h3>
                    <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest mt-2 max-w-sm">Changes will propagate to global search indexes within 24-48 neural cycles.</p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default AdminSEO;