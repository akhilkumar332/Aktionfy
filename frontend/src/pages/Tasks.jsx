import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import TaskWizard from '../components/TaskWizard';
import axios from 'axios';
import { 
  Play, Pause, Trash2, CheckCircle2, ShieldAlert, 
  Cpu, Link as LinkIcon, History, Plus, 
  Activity, Command, RefreshCw, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Tasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/v1/tasks');
      if (res.data.success) {
        setTasks(res.data.data || []);
      }
    } catch {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchTasks();
    };
    init();
  }, [fetchTasks]);

  const handleAction = async (taskId, action) => {
    if (action === 'delete' && !confirm('Authorize neural termination? All state data will be purged.')) return;
    
    try {
      if (action === 'delete') {
        await axios.delete(`/api/v1/tasks/${taskId}`);
      } else {
        await axios.post(`/api/v1/tasks/${taskId}/${action}`);
      }
      fetchTasks();
    } catch {
      alert(`Failed to ${action} task`);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Layers size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Core Orchestration</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Neural Streams.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Distributed Task Scheduling & Dependency Hub</p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={fetchTasks}
             className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
           >
             <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => setIsWizardOpen(true)}
            className="shimmer-button bg-brand-primary text-white px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3"
          >
            <Plus size={16} /> Orchestrate Node
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isWizardOpen && (
          <TaskWizard 
            isOpen={isWizardOpen} 
            onClose={() => setIsWizardOpen(false)} 
            onTaskCreated={() => fetchTasks()} 
          />
        )}
      </AnimatePresence>

      <div className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-white/[0.02] text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
              <tr>
                <th className="px-10 py-8">Neural Designation</th>
                <th className="px-6 py-8">Activation Vector</th>
                <th className="px-6 py-8 text-center">Status</th>
                <th className="px-6 py-8 text-center">Temporal Target</th>
                <th className="px-10 py-8 text-right">System Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-40">
                     <div className="flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Syncing Neural Stream Registry...</span>
                     </div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-40 text-center">
                     <div className="flex flex-col items-center gap-8">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                           <Activity size={48} className="text-slate-800" />
                        </div>
                        <div>
                           <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">Neural Linkage Void</p>
                           <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed opacity-60">No active orchestration streams identifies. Initialize your first node to begin autonomous operations.</p>
                        </div>
                     </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {tasks.map((task, i) => (
                    <motion.tr 
                      key={task.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/[0.02] transition-colors group relative"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                          <div className="relative">
                             <div className="absolute inset-0 bg-brand-primary/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="bg-obsidian-950 p-4 rounded-[1.5rem] text-brand-primary border border-white/5 group-hover:border-brand-primary/30 transition-all relative z-10">
                               <Cpu className="w-6 h-6" />
                             </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                               <span className="font-black text-white tracking-tight text-lg">{task.name}</span>
                               {task.version_count > 0 && (
                                 <span className="text-[8px] font-black bg-brand-secondary/10 text-brand-secondary px-1.5 py-0.5 rounded-lg uppercase tracking-widest border border-brand-secondary/20">
                                   v{task.version_count}
                                 </span>
                               )}
                            </div>
                            <div className="flex items-center gap-3">
                               <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest opacity-60">
                                  <Command size={10} /> {task.id.substring(0, 13)}
                               </div>
                               {task.depends_on_task_id && (
                                 <div className="flex items-center gap-1.5 text-[9px] font-black text-brand-secondary uppercase tracking-widest bg-brand-secondary/5 px-2 py-0.5 rounded-lg border border-brand-secondary/10">
                                    <LinkIcon size={8} /> Linked
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-8">
                         <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{task.trigger_type}</span>
                            <span className="text-[10px] font-mono text-slate-600 tabular-nums opacity-60">FRQ_COORD_MATCH</span>
                         </div>
                      </td>
                      <td className="px-6 py-8 text-center">
                        {task.status === 'active' ? (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> active
                          </div>
                        ) : task.status === 'paused' ? (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Pause className="w-3.5 h-3.5" /> paused
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" /> {task.status}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-8 text-center">
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[11px] text-slate-400 font-black tabular-nums">{new Date(task.next_run).toLocaleDateString()}</span>
                           <span className="text-[10px] text-slate-600 font-mono tabular-nums opacity-60">{new Date(task.next_run).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => navigate(`/tasks/${task.id}/history`)} 
                            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-brand-secondary hover:border-brand-secondary/40 transition-all shadow-xl" 
                            title="Neural Archive"
                          >
                            <History size={18} />
                          </button>
                          {task.status === 'active' ? (
                            <button onClick={() => handleAction(task.id, 'pause')} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-amber-400 hover:border-amber-400/40 transition-all shadow-xl" title="Freeze Node"><Pause size={18} /></button>
                          ) : (
                            <button onClick={() => handleAction(task.id, 'resume')} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-emerald-400 hover:border-emerald-400/40 transition-all shadow-xl" title="Thaw Node"><Play size={18} /></button>
                          )}
                          <button onClick={() => handleAction(task.id, 'delete')} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-red-500 hover:border-red-500/40 transition-all shadow-xl" title=" Purge Node"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;