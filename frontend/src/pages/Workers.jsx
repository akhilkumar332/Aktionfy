import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Activity, Loader2, ArrowLeft, RefreshCw, Server, Cpu, Database, Zap, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Workers = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchWorkers = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/v1/admin/workers');
      if (res.data.success) {
        setWorkers(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch workers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) await fetchWorkers();
    };
    loadData();
    const interval = setInterval(fetchWorkers, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchWorkers]);

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] mb-6 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Terminal
          </button>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
                <Zap size={20} />
             </div>
             <div>
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-black text-white tracking-tighter"
                >
                  Reaper Registry.
                </motion.h1>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1">Active Distributed Execution Nodes</p>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
           
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cluster Nodes</span>
              <span className="text-xl font-black text-white tabular-nums">{workers.length}</span>
           </div>
           <div className="h-10 w-px bg-white/5"></div>
           <button 
             onClick={fetchWorkers}
             className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:rotate-180 duration-500"
           >
             <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-40 flex flex-col items-center gap-6"
            >
              <div className="relative">
                 <Loader2 className="animate-spin text-brand-primary" size={48} />
                 <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 animate-pulse"></div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Scanning Neural Cluster Topology...</p>
            </motion.div>
          ) : workers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-40 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem]"
            >
               <Server size={48} className="text-slate-800 mx-auto mb-6" />
               <h3 className="text-lg font-black text-slate-600 uppercase tracking-widest">Infrastructure Offline</h3>
               <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mt-2">No active reaper nodes detected in the registry.</p>
            </motion.div>
          ) : (
            workers.map((worker, i) => (
              <motion.div 
                key={worker.worker_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-obsidian-900 border border-white/5 rounded-[3rem] p-10 hover:bg-white/[0.02] hover:border-brand-primary/20 transition-all group relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:bg-brand-primary/10 transition-all duration-700"></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                       <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="bg-obsidian-950 p-6 rounded-[2rem] text-blue-400 border border-white/5 group-hover:border-blue-500/30 transition-all relative z-10">
                         <Server size={32} />
                       </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{worker.hostname}</h2>
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                          <Activity size={10} className="animate-pulse" /> {worker.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <Command size={12} className="text-slate-600" />
                         <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest opacity-60 tabular-nums">{worker.worker_id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-12">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                         <Cpu size={10} /> Load Factor
                      </div>
                      <p className="text-2xl font-black text-white tracking-tighter tabular-nums flex items-baseline gap-2">
                        {worker.task_count}
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">threads</span>
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                         <Database size={10} /> Memory Sync
                      </div>
                      <p className="text-sm font-black text-slate-300 uppercase tracking-tight tabular-nums bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        {new Date(worker.last_heartbeat).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="hidden sm:block space-y-2 lg:ml-4">
                       <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (worker.task_count / 10) * 100)}%` }}
                            className={`h-full rounded-full transition-all duration-1000 ${worker.task_count > 8 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-brand-primary shadow-[0_0_10px_#d97706]'}`}
                          />
                       </div>
                       <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-right">Throughput capacity</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Workers;