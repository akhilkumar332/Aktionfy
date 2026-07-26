import { useEffect, useState, useCallback, useRef } from 'react';
import TaskWizard from '../components/TaskWizard';
import ExecutionTracesModal from '../components/ExecutionTracesModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import axios from 'axios';
import { 
  Play, Pause, Trash2,
  Cpu, Link as LinkIcon, History, Plus, 
  Activity, Command, RefreshCw, X, Check, Settings, Terminal,
  Copy, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles, Globe
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';
import { SkeletonRow } from '../components/SkeletonLoader';
import { Download } from 'lucide-react';

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

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (isMountedRef.current && res.data.success) {
        setTasks(res.data.data || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        notify('ERROR', 'Failed to fetch tasks', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
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
    Promise.resolve().then(() => {
      fetchTasks();
    });
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
        notify('SUCCESS', 'Task node terminated');
      } else {
        await axios.post(`/api/v1/tasks/${taskId}/${action}`);
        notify('SUCCESS', `Node ${action}d successfully`);
      }
      fetchTasks();
    } catch (err) {
      notify('ERROR', `Failed to ${action} node`, err.response?.data?.error || err.message);
    } finally {
      if (isMountedRef.current && action === 'delete') {
        setConfirmDelete(null);
      }
    }
  };

  const handleBulkAction = async (action) => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;

    setRefreshing(true);
    try {
      const batchSize = 5;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        if (action === 'delete') {
          await Promise.all(batch.map(id => axios.delete(`/api/v1/tasks/${id}`)));
        } else {
          await Promise.all(batch.map(id => axios.post(`/api/v1/tasks/${id}/${action}`)));
        }
      }
      if (action === 'delete') {
        notify('SUCCESS', `Terminated ${ids.length} task nodes`);
      } else {
        notify('SUCCESS', `Successfully ${action}d ${ids.length} nodes`);
      }
      setSelectedTasks(new Set());
      fetchTasks();
    } catch (err) {
      notify('ERROR', `Bulk ${action} failed`, err.response?.data?.error || err.message);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
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

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Type', 'Status', 'Next Run', 'Created At'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + filteredTasks.map(t => `${t.id},"${t.name || ''}",${t.trigger_type},${t.status},${t.next_run || ''},${t.created_at || ''}`).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aktionfy_tasks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('task-search-input')?.focus();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setSelectedTask(null);
        setIsWizardOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter and Sort Logic
  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = (task.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (task.id || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'created_at') {
        comparison = (new Date(a.created_at || 0) - new Date(b.created_at || 0));
      } else if (sortBy === 'next_run') {
        const dateA = a.next_run ? new Date(a.next_run).getTime() : 0;
        const dateB = b.next_run ? new Date(b.next_run).getTime() : 0;
        comparison = dateA - dateB;
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

  const [viewMode, setViewMode] = useState('list');

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight"
          >
            Task Streams
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
          >
            Distributed task scheduling and autonomous dependency hub
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button 
            onClick={fetchTasks}
            className="p-3 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg hover:bg-zinc-800 active:scale-95"
            title="Refresh streams"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
          </button>
          
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-1.5 rounded-xl shadow-lg">
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-zinc-800/50 shadow-inner"
            >
              <Download size={14} className="text-zinc-500" /> Export CSV
            </button>
            <button 
              onClick={() => {
                setSelectedTask(null);
                setIsWizardOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              <Plus size={14} /> Initialize Node
            </button>
          </div>
        </motion.div>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-4 rounded-3xl shadow-xl">
        <div className="flex-1 flex items-center gap-3 bg-zinc-950 border border-zinc-800/80 px-5 py-3 rounded-2xl group shadow-inner transition-all hover:border-zinc-700 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
          <Search size={16} className="text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
                id="task-search-input"
                type="text"
                placeholder="Search designation or UID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-white text-sm font-medium focus:outline-none w-full placeholder:text-zinc-600 placeholder:font-normal"
              />
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono border border-zinc-800/80 px-2 py-1 rounded-md bg-zinc-900 shadow-sm">
                 <kbd>/</kbd>
              </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-zinc-950/50 border border-zinc-800/50 px-2 py-1 rounded-2xl">
             <div className="flex items-center gap-2 pl-3">
               <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Status:</span>
               <select
                 value={statusFilter}
                 onChange={(e) => {
                   setStatusFilter(e.target.value);
                   setCurrentPage(1);
                 }}
                 className="bg-transparent text-zinc-300 font-bold text-[11px] uppercase tracking-wider py-2 pr-6 rounded-lg outline-none cursor-pointer appearance-none"
               >
                 <option value="all" className="bg-zinc-950">ALL SECTORS</option>
                 <option value="active" className="bg-zinc-950">ACTIVE</option>
                 <option value="paused" className="bg-zinc-950">PAUSED</option>
                 <option value="error" className="bg-zinc-950">ERROR</option>
               </select>
             </div>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950/50 border border-zinc-800/50 pl-4 p-1 rounded-2xl">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mr-2">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-zinc-300 font-bold text-[11px] uppercase tracking-wider py-2 pr-6 outline-none cursor-pointer appearance-none"
            >
              <option value="created_at" className="bg-zinc-950">INDEX TIME</option>
              <option value="name" className="bg-zinc-950">DESIGNATION</option>
              <option value="next_run" className="bg-zinc-950">NEXT EMISSION</option>
              <option value="version_count" className="bg-zinc-950">ARCHIVES</option>
            </select>
            <button
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-white rounded-xl transition-colors shadow-inner"
            >
              <SlidersHorizontal size={14} className={sortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>

          <div className="h-8 w-px bg-zinc-800 mx-1"></div>

          <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-1 shadow-inner">
             <button 
               onClick={() => setViewMode('list')}
               className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
             </button>
             <button 
               onClick={() => setViewMode('grid')}
               className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
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
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/95 border border-indigo-500/40 backdrop-blur-3xl px-8 py-5 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex items-center gap-8 ring-1 ring-white/5 pointer-events-auto"
          >
            <span className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.2em] whitespace-nowrap">
              {selectedTasks.size} Nodes Linked
            </span>
            <div className="h-8 w-px bg-zinc-800/80"></div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleBulkAction('resume')}
                className="px-6 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-xl text-[10px] uppercase font-black tracking-widest transition-all whitespace-nowrap"
              >
                Thaw Nodes
              </button>
              <button 
                onClick={() => handleBulkAction('pause')}
                className="px-6 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] rounded-xl text-[10px] uppercase font-black tracking-widest transition-all whitespace-nowrap"
              >
                Freeze Nodes
              </button>
              <button 
                onClick={() => handleBulkAction('delete')}
                className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] rounded-xl text-[10px] uppercase font-black tracking-widest transition-all whitespace-nowrap"
              >
                Terminate
              </button>
              <div className="w-px h-6 bg-zinc-800/80 mx-2"></div>
              <button 
                onClick={() => setSelectedTasks(new Set())}
                className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-inner"
                title="Deselect all"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-3xl overflow-hidden shadow-xl">
        {viewMode === 'list' ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800/60 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                  <th className="px-8 py-5 w-12">
                    <input
                      type="checkbox"
                      checked={paginatedTasks.length > 0 && selectedTasks.size === paginatedTasks.length}
                      onChange={toggleSelectAll}
                      className="accent-indigo-600 rounded bg-zinc-900 border-zinc-700 cursor-pointer w-4 h-4 shadow-inner"
                    />
                  </th>
                  <th className="px-6 py-5">Designation</th>
                  <th className="px-6 py-5">Vector</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-center">Next Emission</th>
                  <th className="px-8 py-5 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30 bg-zinc-950/20">
                {loading ? (
                  <>
                    <SkeletonRow columns={6} />
                    <SkeletonRow columns={6} />
                    <SkeletonRow columns={6} />
                  </>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-32 text-center">
                       <div className="flex flex-col items-center gap-5 opacity-40">
                          <Activity size={40} className="text-zinc-400 animate-pulse" />
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">No active orchestration streams identified.<br/>Initialize your first node to begin.</span>
                       </div>
                    </td>
                  </tr>
                ) : paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-24 text-center">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">No streams matches search filters.</span>
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task) => (
                    <tr key={task.id} className={`group transition-colors duration-300 hover:bg-zinc-800/40 ${selectedTasks.has(task.id) ? 'bg-indigo-500/[0.05]' : ''}`}>
                      <td className="px-8 py-5">
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={() => toggleSelectTask(task.id)}
                          className="accent-indigo-600 rounded bg-zinc-900 border-zinc-700 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-5">
                          <div className={`w-10 h-10 rounded-xl bg-zinc-950 border flex items-center justify-center transition-all shadow-inner ${selectedTasks.has(task.id) ? 'border-indigo-500/50 text-indigo-400' : 'border-zinc-800/80 text-zinc-400 group-hover:border-indigo-500/30'}`}>
                             <Cpu size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                             <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-white tracking-wide truncate">{task.name}</span>
                                {task.version_count > 1 && (
                                  <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md uppercase tracking-widest">v{task.version_count}</span>
                                )}
                             </div>
                             <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-widest mt-1">
                                <Command size={10} className="opacity-70" /> {task.id?.substring(0, 13)}
                                {task.depends_on_task_id && <LinkIcon size={10} className="ml-2 text-indigo-400/50" />}
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <span className="text-[10px] font-black text-zinc-400 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-lg uppercase tracking-[0.2em]">{task.trigger_type}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {task.status === 'active' ? (
                            <button onClick={() => handleAction(task.id, 'pause')} className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" title="Click to Pause">
                              <Pause size={10} /> ACTIVE
                            </button>
                          ) : task.status === 'paused' ? (
                            <button onClick={() => handleAction(task.id, 'resume')} className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" title="Click to Resume">
                              <Play size={10} /> PAUSED
                            </button>
                          ) : (
                            <span className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest">{task.status}</span>
                          )}
                          {task.status === 'error' && task.last_error && (
                            <div className="text-[9px] font-bold text-red-400 truncate max-w-[120px] group/tooltip relative">
                              {task.last_error.substring(0, 25)}...
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block bg-zinc-950 border border-red-900/50 text-zinc-300 p-3 rounded-xl shadow-2xl z-50 whitespace-normal w-64 break-words">
                                {task.last_error}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-zinc-200 tabular-nums">
                              {task.next_run ? new Date(task.next_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                              {task.next_run ? new Date(task.next_run).toLocaleDateString() : ''}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <button 
                             onClick={() => handleAction(task.id, 'trigger')}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all shadow-lg"
                             title="Execute Immediately"
                          >
                             <Activity size={16} />
                          </button>
                          <button 
                             onClick={() => setTraceTask(task)}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all shadow-lg"
                             title="Execution Traces"
                          >
                             <Terminal size={16} />
                          </button>
                          <button 
                             onClick={() => handleClone(task)}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
                             title="Clone Node"
                          >
                             <Copy size={16} />
                          </button>
                          <button 
                             onClick={() => setSaveTemplateTask(task)}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 transition-all shadow-lg"
                             title="Save as Blueprint"
                          >
                             <Sparkles size={16} />
                          </button>
                          <button 
                             onClick={() => window.open(`/app/${task.id}`, '_blank')}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all shadow-lg"
                             title="Launch Mini-App"
                          >
                             <Globe size={16} />
                          </button>
                          <button 
                             onClick={() => handleEdit(task)}
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
                             title="Calibrate Node"
                          >
                             <Settings size={16} />
                          </button>
                          <button 
                             onClick={() => navigate(`/tasks/${task.id}/history`)} 
                             className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg" 
                             title="Task Archive"
                          >
                             <History size={16} />
                          </button>
                          <div className="w-px h-8 bg-zinc-800/80 mx-1"></div>
                          {task.status === 'active' ? (
                            <button onClick={() => handleAction(task.id, 'pause')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-all shadow-lg" title="Freeze Node"><Pause size={16} /></button>
                          ) : (
                            <button onClick={() => handleAction(task.id, 'resume')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all shadow-lg" title="Thaw Node"><Play size={16} /></button>
                          )}
                          
                          {confirmDelete === task.id ? (
                            <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/50 rounded-xl p-1 shadow-lg">
                              <button 
                                onClick={() => handleAction(task.id, 'delete')}
                                className="p-1.5 bg-red-600 text-white hover:bg-red-500 rounded-lg transition-all"
                                title="Confirm Terminate"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete(null)}
                                className="p-1.5 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg transition-all border border-zinc-800"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(task.id)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 hover:border-red-500/50 transition-all shadow-lg" title="Purge Node"><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 bg-zinc-950/20">
            {loading && tasks.length === 0 ? (
              <div className="col-span-full py-32 flex flex-col items-center gap-4">
                 <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                 <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Querying Data...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="col-span-full py-32 flex flex-col items-center gap-5 opacity-40">
                 <Activity size={40} className="text-zinc-400 animate-pulse" />
                 <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center">No active orchestration streams identified.<br/>Initialize your first node to begin.</span>
              </div>
            ) : paginatedTasks.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600">No streams matches search filters.</span>
              </div>
            ) : (
              paginatedTasks.map((task) => (
                <div key={task.id} className={`bg-zinc-950/80 backdrop-blur-xl border p-6 flex flex-col gap-5 rounded-3xl relative group hover:-translate-y-1 transition-all shadow-xl ${selectedTasks.has(task.id) ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.1)]' : 'border-zinc-800/80 hover:border-zinc-700 hover:shadow-2xl'}`}>
                  <div className="absolute top-6 right-6 z-10">
                    <input
                      type="checkbox"
                      checked={selectedTasks.has(task.id)}
                      onChange={() => toggleSelectTask(task.id)}
                      className="accent-indigo-600 rounded bg-zinc-900 border-zinc-700 cursor-pointer w-4 h-4 shadow-inner"
                    />
                  </div>
                  <div className="flex items-start gap-4 pr-8">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all shadow-inner shrink-0">
                       <Cpu size={24} />
                    </div>
                    <div className="flex flex-col min-w-0 pt-1">
                       <h3 className="text-white font-black text-lg tracking-tight truncate leading-tight">{task.name}</h3>
                       <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-mono mt-2 tracking-widest">
                         <Command size={10} className="opacity-70" /> <span>{task.id?.substring(0, 13)}</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between bg-zinc-900/50 px-4 py-3 rounded-xl border border-zinc-800/50 shadow-inner">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Vector</span>
                      <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{task.trigger_type}</span>
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900/50 px-4 py-3 rounded-xl border border-zinc-800/50 shadow-inner">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Next Run</span>
                      <span className="text-xs font-bold text-zinc-200 tabular-nums">
                        {task.next_run ? new Date(task.next_run).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'Not Scheduled'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-5 border-t border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      {task.status === 'active' ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">ACTIVE</span>
                      ) : task.status === 'paused' ? (
                        <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest">PAUSED</span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest">{task.status}</span>
                      )}
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button onClick={() => window.open(`/app/${task.id}`, '_blank')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all shadow-md" title="Launch Mini-App"><Globe size={14} /></button>
                      <button onClick={() => setTraceTask(task)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all shadow-md" title="Traces"><Terminal size={14} /></button>
                      <button onClick={() => handleEdit(task)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-md" title="Settings"><Settings size={14} /></button>
                      {task.status === 'active' ? (
                        <button onClick={() => handleAction(task.id, 'pause')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all shadow-md" title="Freeze"><Pause size={14} /></button>
                      ) : (
                        <button onClick={() => handleAction(task.id, 'resume')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all shadow-md" title="Thaw"><Play size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination Footer Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-8 py-5 border-t border-zinc-800/60 bg-zinc-950/40">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">
              Showing {Math.min(filteredTasks.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredTasks.length, currentPage * pageSize)} of {filteredTasks.length} nodes
            </span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em]">Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer focus:border-indigo-500 shadow-inner"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(c => Math.max(c - 1, 1))}
                  className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-black text-zinc-300 tabular-nums px-3">
                  {currentPage} <span className="text-zinc-600 px-1">/</span> {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(c => Math.min(c + 1, totalPages))}
                  className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight size={16} />
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
    </div>
  );
};

export default Tasks;