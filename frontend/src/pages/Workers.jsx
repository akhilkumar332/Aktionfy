import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Activity, RefreshCw, Server, Clock, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const Workers = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/v1/admin/workers');
      if (res.data.success && isMounted.current) {
        setWorkers(res.data.data || []);
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch workers', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchWorkers();
    };
    addListener('worker_updated', handleUpdate);
    return () => removeListener('worker_updated', handleUpdate);
  }, [addListener, removeListener, fetchWorkers]);

  useEffect(() => {
    isMounted.current = true;
    
    // Use setTimeout to avoid synchronous setState inside effect (cascading render)
    const initTimeout = setTimeout(() => {
      if (isMounted.current) fetchWorkers();
    }, 0);

    const interval = setInterval(() => {
      if (isMounted.current) fetchWorkers();
    }, 30000);

    return () => {
      isMounted.current = false;
      clearTimeout(initTimeout);
      clearInterval(interval);
    };
  }, [fetchWorkers]);

  const maxTasks = Math.max(10, ...workers.map(w => w.task_count || 0));

  return (
    <>
      <div className="space-y-8 pb-12">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-4"
            >
               <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 shadow-inner">
                  <Server size={16} />
               </div>
               <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Infrastructure</span>
            </motion.div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tighter uppercase">Worker Registry</h1>
            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mt-3 ml-1">Operational status of distributed execution nodes.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner">
             <div className="bg-zinc-950 border border-zinc-800/80 px-5 py-3 rounded-xl flex items-center gap-4 shadow-inner">
                <div className="flex flex-col">
                   <span className="text-xl font-black text-white tabular-nums leading-none drop-shadow-md">{workers.length}</span>
                   <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none mt-1">ACTIVE_NODES</span>
                </div>
             </div>
             <button 
               onClick={fetchWorkers}
               className="p-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700 cursor-pointer"
               aria-label="Refresh registry"
             >
               <RefreshCw size={18} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
             </button>
          </div>
        </header>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-40 flex flex-col items-center justify-center gap-4 opacity-50"
            >
              <RefreshCw className="animate-spin text-zinc-300" size={32} />
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Cluster...</p>
            </motion.div>
          ) : workers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-32 text-center bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 border-dashed rounded-[2rem] shadow-xl relative overflow-hidden group"
            >
               <div className="absolute top-0 right-1/4 w-96 h-96 bg-zinc-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-zinc-500/10 transition-colors duration-1000"></div>
               <Server size={40} className="text-zinc-600 mx-auto mb-6 drop-shadow-md group-hover:scale-110 transition-transform" />
               <h3 className="text-lg font-black text-zinc-400 uppercase tracking-tighter">No Active Workers Identified</h3>
               <p className="text-[11px] text-zinc-500 font-black mt-2 uppercase tracking-[0.2em]">Check cluster deployment status.</p>
            </motion.div>
          ) : (
            workers.map((worker) => (
              <motion.div 
                key={worker.worker_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 shadow-xl hover:bg-zinc-900/60 hover:border-zinc-700 transition-all group relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-64 h-64 ${worker.status === 'online' ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10' : 'bg-red-500/5 group-hover:bg-red-500/10'} blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none transition-colors duration-700`}></div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-zinc-950 border border-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:scale-110 group-hover:border-indigo-400/50 group-hover:text-indigo-400 transition-all shadow-inner">
                       <Server size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-black text-white tracking-tighter uppercase drop-shadow-md">{worker.hostname}</h2>
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner ${
                          worker.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {worker.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                         <Command size={12} className="text-zinc-600" /> {worker.worker_id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-10 ml-20 lg:ml-0 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 shadow-inner">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                         <Activity size={12} className="text-indigo-400" /> Current Load
                      </div>
                      <p className="text-2xl font-black text-white tabular-nums flex items-baseline gap-1.5 drop-shadow-md">
                        {worker.task_count}
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">threads</span>
                      </p>
                    </div>
                    
                    <div className="h-10 w-px bg-zinc-800/80 shadow-[1px_0_0_rgba(255,255,255,0.02)]"></div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                         <Clock size={12} className="text-purple-400" /> Heartbeat
                      </div>
                      <p className="text-sm font-black text-zinc-300 tabular-nums tracking-wider drop-shadow-sm">
                        {new Date(worker.last_heartbeat).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="hidden md:block pl-6">
                       <div className="h-2 w-32 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (worker.task_count / maxTasks) * 100)}%` }}
                            className={`h-full transition-all duration-1000 shadow-[0_0_10px_currentColor] ${(worker.task_count / maxTasks) > 0.8 ? 'bg-red-500 text-red-500' : 'bg-indigo-500 text-indigo-500'}`}
                          />
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
};

export default Workers;