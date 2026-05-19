import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Activity, RefreshCw, Server, Clock, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';

const Workers = () => {
  const { notify } = useNotify();
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

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reaper Registry</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Operational status of distributed execution nodes.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={fetchWorkers}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
             aria-label="Refresh registry"
           >
             <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
           </button>
           <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-3">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-white tabular-nums leading-none">{workers.length}</span>
                 <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-0.5">ACTIVE_NODES</span>
              </div>
           </div>
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
              className="py-32 text-center pro-card border-dashed bg-zinc-900/10"
            >
               <Server size={32} className="text-zinc-800 mx-auto mb-4" />
               <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No Active Reapers Identified</h3>
               <p className="text-[10px] text-zinc-300 font-medium mt-1 uppercase tracking-tighter">Check cluster deployment status.</p>
            </motion.div>
          ) : (
            workers.map((worker) => (
              <motion.div 
                key={worker.worker_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pro-card p-6 hover:bg-zinc-900/80 transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/40 transition-all">
                       <Server size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-bold text-zinc-100 tracking-tight uppercase">{worker.hostname}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          worker.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}>
                          {worker.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider opacity-60">
                         <Command size={10} /> {worker.worker_id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 ml-14 lg:ml-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                         <Activity size={10} className="text-zinc-300" /> Current Load
                      </div>
                      <p className="text-lg font-bold text-white tabular-nums flex items-baseline gap-1.5">
                        {worker.task_count}
                        <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">threads</span>
                      </p>
                    </div>
                    
                    <div className="h-8 w-px bg-zinc-800/50"></div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                         <Clock size={10} className="text-zinc-300" /> Heartbeat
                      </div>
                      <p className="text-xs font-semibold text-zinc-300 tabular-nums">
                        {new Date(worker.last_heartbeat).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="hidden md:block">
                       <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (worker.task_count / 10) * 100)}%` }}
                            className={`h-full transition-all duration-1000 ${worker.task_count > 8 ? 'bg-red-500' : 'bg-brand-primary'}`}
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
    </>
  );
};

export default Workers;