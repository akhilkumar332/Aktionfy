import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Search, Globe, RefreshCw, AlertCircle, CheckCircle2, Layout, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const AdminSEO = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [data, setData] = useState({ title: '', description: '', keywords: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchSEO = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/admin/seo');
      if (res.data.success && isMounted.current) {
        setData(res.data.data || { title: 'Aktionfy', description: '', keywords: '' });
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch SEO data', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      fetchSEO();
    };
    addListener('seo_updated', handleUpdate);
    return () => removeListener('seo_updated', handleUpdate);
  }, [addListener, removeListener, fetchSEO]);

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
      if (isMounted.current) {
        setMessage({ type: 'success', text: 'Neural identity manifest updated and broadcasted.' });
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to save SEO', err.response?.data?.error || err.message);
        setMessage({ type: 'error', text: 'Failed to broadcast manifest updates.' });
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
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

              <div className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-12 shadow-lg relative overflow-hidden backdrop-blur-xl space-y-8">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-zinc-100/5 rounded-xl border border-zinc-800/50 text-zinc-400">
                      <Search size={20} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">Global Index Preview</h3>
                      <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest mt-0.5">Real-time Search Engine Simulator</p>
                   </div>
                </div>

                {/* Google Search Result Simulator */}
                <div className="bg-black/30 border border-zinc-900 rounded-xl p-8 max-w-2xl font-sans relative z-10">
                  <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                    <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-200">A</div>
                    <span>https://aktionfy.com</span>
                  </div>
                  <h3 className="text-xl text-indigo-400 hover:underline cursor-pointer font-medium mb-1 truncate">
                    {data.title || 'Aktionfy | Autonomous Task Orchestration'}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-normal line-clamp-2">
                    {data.description || 'Define your autonomous task execution pipelines. Schedule jobs, configure triggers, and scale workers in a secure sandbox environment.'}
                  </p>
                </div>

                {/* Character Counter Progress Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-900 relative z-10">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
                      <span className="text-zinc-400">Title Length Check</span>
                      <span className={data.title.length > 60 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                        {data.title.length} / 60 Chars
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                        className={`h-full transition-all duration-300 ${data.title.length > 60 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (data.title.length / 60) * 100)}%` }}
                      />
                    </div>
                    {data.title.length > 60 && (
                      <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest animate-pulse">⚠️ Optimal Google search title limit exceeded (truncation risk)</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em]">
                      <span className="text-zinc-400">Description Length Check</span>
                      <span className={data.description.length > 160 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                        {data.description.length} / 160 Chars
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                        className={`h-full transition-all duration-300 ${data.description.length > 160 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (data.description.length / 160) * 100)}%` }}
                      />
                    </div>
                    {data.description.length > 160 && (
                      <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest animate-pulse">⚠️ Optimal Google search description limit exceeded (truncation risk)</p>
                    )}
                  </div>
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