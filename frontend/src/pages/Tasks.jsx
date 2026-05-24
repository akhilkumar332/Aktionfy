import { useEffect, useState, useCallback } from 'react';
import TaskWizard from '../components/TaskWizard';
import ExecutionTracesModal from '../components/ExecutionTracesModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import axios from 'axios';
import { 
  Play, Pause, Trash2,
  Cpu, Link as LinkIcon, History, Plus, 
  Activity, Command, RefreshCw, X, Check, Settings, Terminal,
  Copy, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const Tasks = () => {
  const navigate = useNavigate();
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [traceTask, setTraceTask] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saveTemplateTask, setSaveTemplateTask] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Bulk Selection States
  const [selectedTasks, setSelectedTasks] = useState(new Set());

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
    const handleUpdate = () => {
      fetchTasks();
    };
    addListener('task_updated', handleUpdate);
    addListener('task_executed', handleUpdate);
    return () => {
      removeListener('task_updated', handleUpdate);
      removeListener('task_executed', handleUpdate);
    };
  }, [addListener, removeListener, fetchTasks]);

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

  const handleClone = (task) => {
    // Clone properties but clear id/coordinates and rename
    setSelectedTask({
      ...task,
      id: undefined,
      name: `${task.name} (Copy)`
    });
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

  const handleBulkAction = async (action) => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;

    setRefreshing(true);
    try {
      if (action === 'delete') {
        await Promise.all(ids.map(id => axios.delete(`/api/v1/tasks/${id}`)));
        notify('SUCCESS', `Terminated ${ids.length} neural nodes`);
      } else {
        await Promise.all(ids.map(id => axios.post(`/api/v1/tasks/${id}/${action}`)));
        notify('SUCCESS', `Successfully ${action}d ${ids.length} nodes`);
      }
      setSelectedTasks(new Set());
      fetchTasks();
    } catch (err) {
      notify('ERROR', `Bulk ${action} failed`, err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSelectTask = (id) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter and Sort Logic
  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'created_at') {
        comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      } else if (sortBy === 'next_run') {
        comparison = new Date(a.next_run || 0) - new Date(b.next_run || 0);
      } else if (sortBy === 'version_count') {
        comparison = (a.version_count || 0) - (b.version_count || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Paginated Slicing
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredTasks.length / pageSize);

  const toggleSelectAll = () => {
    setSelectedTasks(prev => {
      if (prev.size === paginatedTasks.length) {
        return new Set();
      }
      return new Set(paginatedTasks.map(t => t.id));
    });
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
            onClick={() => {
              setSelectedTask(null);
              setIsWizardOpen(true);
            }}
            className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
          >
            <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Deploy Node</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-zinc-900/30 border border-zinc-800/40 p-4 rounded-xl">
        <div className="flex-1 flex items-center gap-3 bg-zinc-950 border border-zinc-800/80 px-3.5 py-2 rounded-lg group">
          <Search size={16} className="text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text"
            placeholder="Search streams by designation name or address..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-transparent border-none outline-none text-xs text-zinc-200 w-full placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500"
            >
              <option value="all">ALL SECTORS</option>
              <option value="active">ACTIVE</option>
              <option value="paused">PAUSED</option>
              <option value="error">ERROR</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500"
            >
              <option value="created_at">INDEX TIME</option>
              <option value="name">DESIGNATION</option>
              <option value="next_run">NEXT EMISSION</option>
              <option value="version_count">ARCHIVES</option>
            </select>

            <button
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            >
              <SlidersHorizontal size={14} className={sortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </div>
      </div>

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

      {/* Bulk Selection Floating Action Bar */}
      <AnimatePresence>
        {selectedTasks.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 border border-indigo-500/30 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6"
          >
            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">
              {selectedTasks.size} Nodes Linked
            </span>
            <div className="h-6 w-px bg-zinc-800"></div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleBulkAction('resume')}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
              >
                Thaw Nodes
              </button>
              <button 
                onClick={() => handleBulkAction('pause')}
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
              >
                Freeze Nodes
              </button>
              <button 
                onClick={() => handleBulkAction('delete')}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
              >
                Terminate
              </button>
              <button 
                onClick={() => setSelectedTasks(new Set())}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
                title="Deselect all"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pro-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="pro-table-header">
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={paginatedTasks.length > 0 && selectedTasks.size === paginatedTasks.length}
                    onChange={toggleSelectAll}
                    className="accent-indigo-600 rounded bg-zinc-950 border-zinc-800 cursor-pointer"
                  />
                </th>
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
                  <td colSpan="6" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Querying Registry...</span>
                     </div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-30">
                        <Activity size={32} className="text-zinc-300" />
                        <span className="text-xs font-medium text-zinc-400 italic">No active orchestration streams identified. Initialize your first node to begin.</span>
                     </div>
                  </td>
                </tr>
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <span className="text-xs text-zinc-500 italic">No streams matches search filters.</span>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => (
                  <tr key={task.id} className={`pro-table-row group ${selectedTasks.has(task.id) ? 'bg-indigo-500/[0.02]' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={() => toggleSelectTask(task.id)}
                        className="accent-indigo-600 rounded bg-zinc-950 border-zinc-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:border-indigo-500/50 transition-all">
                           <Cpu size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-100 truncate">{task.name}</span>
                              {task.version_count > 1 && (
                                <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-md">v{task.version_count}</span>
                              )}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-tighter opacity-60">
                              <Command size={10} /> {task.id.substring(0, 13)}
                              {task.depends_on_task_id && <LinkIcon size={10} className="ml-1 text-indigo-400/50" />}
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
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{new Date(task.next_run).toLocaleDateString()}</span>
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
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-indigo-400 transition-all shadow-sm"
                           title="Execution Traces"
                        >
                           <Terminal size={14} />
                        </button>
                        <button 
                           onClick={() => handleClone(task)}
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all shadow-sm"
                           title="Clone Node"
                        >
                           <Copy size={14} />
                        </button>
                        <button 
                           onClick={() => setSaveTemplateTask(task)}
                           className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-indigo-400 transition-all shadow-sm"
                           title="Save as Blueprint"
                        >
                           <Sparkles size={14} />
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

        {/* Pagination Footer Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-zinc-800/40 bg-zinc-900/10">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Showing {Math.min(filteredTasks.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredTasks.length, currentPage * pageSize)} of {filteredTasks.length} nodes
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(c => Math.max(c - 1, 1))}
                  className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:text-zinc-400 transition-all"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-zinc-300 tabular-nums px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(c => Math.min(c + 1, totalPages))}
                  className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:text-zinc-400 transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <ExecutionTracesModal 
        isOpen={!!traceTask} 
        onClose={() => setTraceTask(null)} 
        taskId={traceTask?.id} 
        taskName={traceTask?.name} 
      />

      <SaveTemplateModal 
        isOpen={!!saveTemplateTask} 
        onClose={() => setSaveTemplateTask(null)} 
        task={saveTemplateTask} 
      />
    </>
  );
};

export default Tasks;