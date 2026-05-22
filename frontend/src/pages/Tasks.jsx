import { useEffect, useState, useCallback } from 'react';

import TaskWizard from '../components/TaskWizard';
import ExecutionTracesModal from '../components/ExecutionTracesModal';
import axios from 'axios';
import { 
  Play, Pause, Trash2,
  Cpu, Link as LinkIcon, History, Plus, 
  Activity, Command, RefreshCw, X, Check, Settings, Terminal
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../context/NotificationContext';

const Tasks = () => {
  const navigate = useNavigate();
  const { notify } = useNotify();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [traceTask, setTraceTask] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchTasks = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/v1/tasks');
      if (res.data.success) {
        setTasks(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch tasks', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    const init = async () => {
      await fetchTasks();
    };
    init();
  }, [fetchTasks]);

  const handleEdit = (task) => {
    setSelectedTask(task);
    setIsWizardOpen(true);
  };

  const handleAction = async (taskId, action) => {
    try {
      if (action === 'delete') {
        await axios.delete(`/api/v1/tasks/${taskId}`);
        notify('SUCCESS', 'Neural node terminated');
      } else {
        await axios.post(`/api/v1/tasks/${taskId}/${action}`);
        notify('SUCCESS', `Node ${action}d successfully`);
      }
      fetchTasks();
    } catch (err) {
      notify('ERROR', `Failed to ${action} node`, err.response?.data?.error || err.message);
    } finally {
      if (action === 'delete') setConfirmDelete(null);
    }
  };

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Neural Streams</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Distributed task scheduling and autonomous dependency hub.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={fetchTasks}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
             aria-label="Refresh streams"
           >
             <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => setIsWizardOpen(true)}
            className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
          >
            <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Deploy Node</span>
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isWizardOpen && (
          <TaskWizard 
            isOpen={isWizardOpen} 
            onClose={() => {
              setIsWizardOpen(false);
              setSelectedTask(null);
            }} 
            onTaskCreated={() => fetchTasks()} 
            initialData={selectedTask}
          />
        )}
      </AnimatePresence>

      <div className="pro-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="pro-table-header">
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Vector</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Next Run</th>
                <th className="px-6 py-4 text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Querying Registry...</span>
                     </div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-30">
                        <Activity size={32} className="text-zinc-300" />
                        <span className="text-xs font-medium text-zinc-400 italic">No active orchestration streams identified. Initialize your first node to begin.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="pro-table-row group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/50 transition-all">
                           <Cpu size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                             <span className="text-sm font-semibold text-zinc-100 truncate">{task.name}</span>
                             {task.version_count > 1 && (
                               <span className="text-[9px] font-bold text-zinc-300">v{task.version_count}</span>
                             )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono tracking-tighter opacity-60">
                             <Command size={10} /> {task.id.substring(0, 13)}
                             {task.depends_on_task_id && <LinkIcon size={10} className="ml-1 text-brand-primary/50" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{task.trigger_type}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {task.status === 'active' ? (
                          <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">active</span>
                        ) : task.status === 'paused' ? (
                          <span className="pro-badge bg-amber-500/10 border-amber-500/20 text-amber-400">paused</span>
                        ) : (
                          <span className="pro-badge bg-red-500/10 border-red-500/20 text-red-400">{task.status}</span>
                        )}
                        {task.status === 'error' && task.last_error && (
                          <span className="text-[8px] text-red-400/60 font-mono max-w-[120px] truncate hover:whitespace-normal hover:overflow-visible hover:max-w-none hover:bg-zinc-900 hover:p-2 hover:rounded-md hover:z-10 transition-all cursor-help" title={task.last_error}>
                            {task.last_error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-xs font-semibold text-zinc-300 tabular-nums">{new Date(task.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-tighter">{new Date(task.next_run).toLocaleDateString()}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                           onClick={() => handleAction(task.id, 'trigger')}
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-emerald-400 transition-all shadow-sm"
                           title="Execute Immediately"
                        >
                           <Activity size={14} />
                        </button>
                        <button 
                           onClick={() => setTraceTask(task)}
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-brand-primary transition-all shadow-sm"
                           title="Execution Traces"
                        >
                           <Terminal size={14} />
                        </button>
                        <button 
                           onClick={() => handleEdit(task)}
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all shadow-sm"
                           title="Calibrate Node"
                        >
                           <Settings size={14} />
                        </button>
                        <button 
                          onClick={() => navigate(`/tasks/${task.id}/history`)} 
                          className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all shadow-sm" 
                          title="Neural Archive"
                        >
                          <History size={14} />
                        </button>
                        {task.status === 'active' ? (
                          <button onClick={() => handleAction(task.id, 'pause')} className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-amber-500 transition-all shadow-sm" title="Freeze Node"><Pause size={14} /></button>
                        ) : (
                          <button onClick={() => handleAction(task.id, 'resume')} className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-emerald-500 transition-all shadow-sm" title="Thaw Node"><Play size={14} /></button>
                        )}
                        
                        {confirmDelete === task.id ? (
                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-md p-0.5">
                            <button 
                              onClick={() => handleAction(task.id, 'delete')}
                              className="p-1 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                              title="Confirm Terminate"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(task.id)} className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-red-500 transition-all shadow-sm" title="Purge Node"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ExecutionTracesModal 
        isOpen={!!traceTask} 
        onClose={() => setTraceTask(null)} 
        taskId={traceTask?.id} 
        taskName={traceTask?.name} 
      />
    </>
  );
};

export default Tasks;