import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import axios from 'axios';
import { History, ArrowLeft, RefreshCw, Clock, CheckCircle2, AlertCircle, Command, GitBranch, Terminal, X, Check, Play, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const TaskHistory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [confirmRollback, setConfirmRollback] = useState(null);
  const [triggering, setTriggering] = useState(false);

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffActive, setDiffActive] = useState(null);
  const [diffHistoric, setDiffHistoric] = useState(null);
  const [diffLabel, setDiffLabel] = useState('');

  const handleTriggerTask = async () => {
    setTriggering(true);
    try {
      const res = await axios.post(`/api/v1/tasks/${id}/trigger`);
      if (res.data.success) {
        notify('SUCCESS', 'Task trigger command broadcast successfully!');
      }
    } catch (err) {
      notify('ERROR', 'Failed to trigger task execution', err.response?.data?.error || err.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleOpenDiff = (version, index) => {
    setDiffActive(history[0]);
    setDiffHistoric(version);
    setDiffLabel(`Active vs Alpha-${history.length - index}`);
    setDiffModalOpen(true);
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [hourlyHeatmap, setHourlyHeatmap] = useState([]);

  const fetchHistory = useCallback(async () => {
    try {
      const [res, heatmapRes] = await Promise.all([
        axios.get(`/api/v1/tasks/${id}/versions`),
        axios.get(`/api/v1/tasks/${id}/analytics/hourly-heatmap`)
      ]);
      if (res.data.success && isMounted.current) {
        setHistory(res.data.data || []);
      }
      if (heatmapRes.data.success && isMounted.current) {
        setHourlyHeatmap(heatmapRes.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch task history', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchHistory();
    });
  }, [fetchHistory]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchHistory();
    };
    addListener('task_updated', handleUpdate);
    addListener('task_executed', handleUpdate);
    return () => {
      removeListener('task_updated', handleUpdate);
      removeListener('task_executed', handleUpdate);
    };
  }, [addListener, removeListener, fetchHistory]);

  const handleRestore = async (versionId) => {
    setRestoring(versionId);
    try {
      await axios.post(`/api/v1/tasks/${id}/restore/${versionId}`);
      notify('SUCCESS', 'Neural rollback executed successfully');
      fetchHistory();
    } catch (err) {
      notify('ERROR', 'Failed to restore task state', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) {
        setRestoring(null);
        setConfirmRollback(null);
      }
    }
  };

  return (
    <>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <button 
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em] mb-6 group"
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
                <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-1">Version State Archive</p>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleTriggerTask}
            disabled={triggering}
            className="pro-button-primary !py-4 !px-6 flex items-center gap-3 disabled:opacity-50"
          >
            {triggering ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Execute Node Now</span>
          </button>
          
          <div className="flex items-center gap-6 bg-zinc-100/[0.02] border border-zinc-800/50 px-8 py-5 rounded-xl backdrop-blur-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Node ID</span>
                <span className="text-xs font-black text-white font-mono uppercase tracking-widest opacity-80">{id?.substring(0, 13)}</span>
             </div>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {!loading && history.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-10 shadow-lg backdrop-blur-xl relative overflow-hidden mb-12"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-100/5 rounded-xl border border-zinc-800/50 text-zinc-400">
                  <Zap size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Hourly Node Chrono-Flux</h2>
                  <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest mt-0.5">Execution load for this node over the last 24 hours</p>
                </div>
              </div>
            </div>

            <div className="h-48 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyHeatmap}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis dataKey="label" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1rem' }}
                    itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '12px' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '10px' }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24}>
                    {hourlyHeatmap.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#6366f1' : 'rgba(255, 255, 255, 0.05)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Querying Timeline Buffer...</p>
          </div>
        ) : history.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-40 flex flex-col items-center justify-center text-center gap-8 bg-zinc-100/[0.01] border border-dashed border-zinc-800 rounded-3xl"
          >
            <div className="w-24 h-24 bg-zinc-100/5 rounded-full flex items-center justify-center border border-zinc-800/50 text-zinc-700">
              <AlertCircle size={48} />
            </div>
            <div>
              <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">No State Changes Detected</p>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">This orchestration node is operating on its baseline configuration.</p>
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
                  <div className={`absolute left-0 w-16 h-16 flex items-center justify-center rounded-xl border backdrop-blur-xl z-10 transition-all duration-500 ${
                    index === 0 ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}>
                    {index === 0 ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                  </div>

                  <div className={`bg-zinc-950 border rounded-2xl p-10 hover:bg-zinc-100/[0.02] transition-all duration-500 group relative overflow-hidden shadow-lg ${index === 0 ? 'border-blue-500/30 ring-1 ring-blue-500/10' : 'border-zinc-800/50'}`}>
                    {index === 0 && <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>}

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
                      <div className="flex-1 space-y-8">
                        <div className="flex items-center gap-4">
                          <span className="text-white font-black text-2xl tracking-tighter uppercase">
                            {index === 0 ? 'Active Deployment' : `State Archive Alpha-${history.length - index}`}
                          </span>
                          <div className="bg-black/40 px-3 py-1 rounded-lg border border-zinc-800/50 shadow-inner flex items-center gap-2">
                             <Command size={10} className="text-zinc-300" />
                             <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest tabular-nums">
                               {version.id.substring(0, 13)}
                             </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-2">
                               <Terminal size={10} /> Logic Snapshot
                            </div>
                            <div className="bg-black/40 p-6 rounded-xl border border-zinc-800/50 font-mono text-xs text-zinc-400 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar shadow-inner group-hover:text-zinc-200 transition-colors">
                              {version.agent_prompt || version.native_code || "// Baseline configuration identified."}
                            </div>
                          </div>
                          
                          <div className="flex flex-col justify-center gap-8">
                             <div className="flex items-center gap-8">
                                <div>
                                  <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-1">Synchronization</p>
                                  <p className="text-xs font-bold text-zinc-300 tabular-nums uppercase">{new Date(version.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-1">Vector Type</p>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100/5 rounded-lg border border-zinc-800/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                     <GitBranch size={10} /> {version.trigger_type}
                                  </div>
                                </div>
                             </div>

                             {index !== 0 && (
                                <div className="flex items-center gap-3">
                                  {confirmRollback === version.id ? (
                                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-2">
                                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2">Authorize?</span>
                                      <button 
                                        onClick={() => handleRestore(version.id)}
                                        disabled={restoring === version.id}
                                        className="p-3 bg-blue-500 text-white rounded-lg hover:brightness-110 transition-all"
                                      >
                                        <Check size={18} />
                                      </button>
                                      <button 
                                        onClick={() => setConfirmRollback(null)}
                                        className="p-3 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-all"
                                      >
                                        <X size={18} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleOpenDiff(version, index)}
                                        className="w-fit bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700/50 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all cursor-pointer"
                                      >
                                        Compare with Active
                                      </button>
                                      <button 
                                        onClick={() => setConfirmRollback(version.id)}
                                        disabled={restoring === version.id}
                                        className="w-fit  bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(59,130,246,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                                      >
                                        {restoring === version.id ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        {restoring === version.id ? 'ROLLING BACK...' : 'Authorize Rollback'}
                                      </button>
                                    </>
                                  )}
                                </div>
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

      {/* Version Diff Modal */}
      <AnimatePresence>
        {diffModalOpen && diffActive && diffHistoric && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDiffModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] z-10 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
                <div className="flex items-center gap-3">
                  <GitBranch size={20} className="text-indigo-400" />
                  <div>
                    <h3 className="text-md font-bold text-white leading-tight uppercase">Version Comparison</h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">{diffLabel}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDiffModalOpen(false)} 
                  className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Side-by-Side Panels */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                {/* Column 1: Active Configuration */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">Active Configuration</h4>
                  
                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${diffActive.trigger_type !== diffHistoric.trigger_type ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Trigger Type</span>
                      {diffActive.trigger_type !== diffHistoric.trigger_type && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <div className="text-xs text-white font-bold">{diffActive.trigger_type}</div>
                  </div>

                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${JSON.stringify(diffActive.trigger_config) !== JSON.stringify(diffHistoric.trigger_config) ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Trigger Configuration</span>
                      {JSON.stringify(diffActive.trigger_config) !== JSON.stringify(diffHistoric.trigger_config) && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-400 max-h-32 overflow-y-auto custom-scrollbar p-3 bg-black/45 rounded-lg border border-zinc-900">
                      {JSON.stringify(diffActive.trigger_config, null, 2) || '{}'}
                    </pre>
                  </div>

                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${(diffActive.agent_prompt || diffActive.native_code) !== (diffHistoric.agent_prompt || diffHistoric.native_code) ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Prompt / Execution Logic</span>
                      {(diffActive.agent_prompt || diffActive.native_code) !== (diffHistoric.agent_prompt || diffHistoric.native_code) && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-400 max-h-48 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap p-3 bg-black/45 rounded-lg border border-zinc-900">
                      {diffActive.agent_prompt || diffActive.native_code || '// Baseline configuration'}
                    </pre>
                  </div>
                </div>

                {/* Column 2: Historical Configuration */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">Historical Archive</h4>

                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${diffActive.trigger_type !== diffHistoric.trigger_type ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Trigger Type</span>
                      {diffActive.trigger_type !== diffHistoric.trigger_type && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <div className="text-xs text-white font-bold">{diffHistoric.trigger_type}</div>
                  </div>

                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${JSON.stringify(diffActive.trigger_config) !== JSON.stringify(diffHistoric.trigger_config) ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Trigger Configuration</span>
                      {JSON.stringify(diffActive.trigger_config) !== JSON.stringify(diffHistoric.trigger_config) && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-400 max-h-32 overflow-y-auto custom-scrollbar p-3 bg-black/45 rounded-lg border border-zinc-900">
                      {JSON.stringify(diffHistoric.trigger_config, null, 2) || '{}'}
                    </pre>
                  </div>

                  <div className={`p-4 bg-zinc-950/45 border rounded-xl space-y-2 ${(diffActive.agent_prompt || diffActive.native_code) !== (diffHistoric.agent_prompt || diffHistoric.native_code) ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-zinc-800/80'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Prompt / Execution Logic</span>
                      {(diffActive.agent_prompt || diffActive.native_code) !== (diffHistoric.agent_prompt || diffHistoric.native_code) && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase font-black">Changed</span>
                      )}
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-400 max-h-48 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap p-3 bg-black/45 rounded-lg border border-zinc-900">
                      {diffHistoric.agent_prompt || diffHistoric.native_code || '// Baseline configuration'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/10 flex items-center gap-3">
                <button
                  onClick={() => setDiffModalOpen(false)}
                  className="flex-1 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus cursor-pointer"
                >
                  Dismiss Comparison
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TaskHistory;