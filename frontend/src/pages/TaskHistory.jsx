import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { History, ArrowLeft, RefreshCw, Clock, CheckCircle2, AlertCircle, Command, GitBranch, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

const TaskHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/tasks/${id}/versions`);
      if (res.data.success) {
        setHistory(res.data.data || []);
      }
    } catch {
      console.error('Failed to fetch task history');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      await fetchHistory();
    };
    init();
  }, [fetchHistory]);

  const handleRestore = async (versionId) => {
    if (!confirm('Authorize neural rollback? Current configuration will be archived as a new state.')) return;
    
    setRestoring(versionId);
    try {
      await axios.post(`/api/v1/tasks/${id}/restore/${versionId}`);
      fetchHistory();
    } catch {
      console.error('Failed to restore task');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <button 
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] mb-6 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Schedules
          </button>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                <History size={20} />
             </div>
             <div>
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-black text-white tracking-tighter"
                >
                  Neural Timeline.
                </motion.h1>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1">Version State Archive</p>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Node ID</span>
              <span className="text-xs font-black text-white font-mono uppercase tracking-widest opacity-80">{id?.substring(0, 13)}</span>
           </div>
        </div>
      </header>

      <div className="space-y-6">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Querying Timeline Buffer...</p>
          </div>
        ) : history.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-40 flex flex-col items-center justify-center text-center gap-8 bg-white/[0.01] border border-dashed border-white/10 rounded-[4rem]"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5 text-slate-700">
              <AlertCircle size={48} />
            </div>
            <div>
              <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">No State Changes Detected</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">This orchestration node is operating on its baseline configuration.</p>
            </div>
          </motion.div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[31px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500 via-white/10 to-transparent opacity-30"></div>
            
            <div className="space-y-12">
              {history.map((version, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={version.id}
                  className="relative pl-20"
                >
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 w-16 h-16 flex items-center justify-center rounded-[1.5rem] border backdrop-blur-3xl z-10 transition-all duration-500 ${
                    index === 0 ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'bg-obsidian-900 border-white/10 text-slate-600'
                  }`}>
                    {index === 0 ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                  </div>

                  <div className={`bg-obsidian-900 border rounded-[3rem] p-10 hover:bg-white/[0.02] transition-all duration-500 group relative overflow-hidden shadow-2xl ${index === 0 ? 'border-blue-500/30 ring-1 ring-blue-500/10' : 'border-white/5'}`}>
                    {index === 0 && <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>}

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
                      <div className="flex-1 space-y-8">
                        <div className="flex items-center gap-4">
                          <span className="text-white font-black text-2xl tracking-tighter uppercase">
                            {index === 0 ? 'Active Deployment' : `State Archive Alpha-${history.length - index}`}
                          </span>
                          <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/5 shadow-inner flex items-center gap-2">
                             <Command size={10} className="text-slate-600" />
                             <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest tabular-nums">
                               {version.id.substring(0, 13)}
                             </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">
                               <Terminal size={10} /> Logic Snapshot
                            </div>
                            <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 font-mono text-xs text-slate-400 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar shadow-inner group-hover:text-slate-200 transition-colors">
                              {version.agent_prompt || version.native_code || "// Baseline configuration identified."}
                            </div>
                          </div>
                          
                          <div className="flex flex-col justify-center gap-8">
                             <div className="flex items-center gap-8">
                                <div>
                                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Synchronization</p>
                                  <p className="text-xs font-bold text-slate-300 tabular-nums uppercase">{new Date(version.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Vector Type</p>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <GitBranch size={10} /> {version.trigger_type}
                                  </div>
                                </div>
                             </div>

                             {index !== 0 && (
                               <button 
                                 onClick={() => handleRestore(version.id)}
                                 disabled={restoring === version.id}
                                 className="w-fit shimmer-button bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(59,130,246,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                               >
                                 {restoring === version.id ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                 {restoring === version.id ? 'ROLLING BACK...' : 'Authorize Rollback'}
                               </button>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TaskHistory;