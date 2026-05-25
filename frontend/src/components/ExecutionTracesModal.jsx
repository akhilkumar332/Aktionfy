import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { X, Activity, Clock, AlertCircle, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSSE } from '../context/SSEContext';

const ExecutionTracesModal = ({ isOpen, onClose, taskId, taskName }) => {
  const [executions, setExecutions] = useState([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState(null);
  const [traces, setTraces] = useState([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const isMounted = useRef(true);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new traces arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traces]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchExecutions = useCallback(async () => {
    if (!taskId) return;
    setLoadingExecutions(true);
    try {
      const res = await axios.get(`/api/v1/tasks/${taskId}/executions`);
      if (res.data.success && isMounted.current) {
        const data = res.data.data || [];
        setExecutions(data);
        if (data.length > 0 && !selectedExecutionId) {
          setSelectedExecutionId(data[0].execution_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch executions:', err);
    } finally {
      if (isMounted.current) setLoadingExecutions(false);
    }
  }, [taskId, selectedExecutionId]);

  const fetchTraces = useCallback(async (execId) => {
    if (!taskId || !execId) return;
    setLoadingTraces(true);
    try {
      const res = await axios.get(`/api/v1/tasks/${taskId}/traces/${execId}`);
      if (res.data.success && isMounted.current) {
        setTraces(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch traces:', err);
    } finally {
      if (isMounted.current) setLoadingTraces(false);
    }
  }, [taskId]);

  const normalizeUUID = (uuid) => {
    if (!uuid) return '';
    if (typeof uuid === 'string') {
      return uuid.replace(/-/g, '').toLowerCase();
    }
    if (uuid.Bytes && Array.isArray(uuid.Bytes)) {
      return uuid.Bytes.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    }
    if (uuid.bytes && Array.isArray(uuid.bytes)) {
      return uuid.bytes.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    }
    return String(uuid).replace(/-/g, '').toLowerCase();
  };

  // Handle live trace events
  const onLiveEvent = useCallback((event) => {
    if (event.event_type === 'trace_created') {
      try {
        const trace = JSON.parse(event.payload);
        const traceTaskId = normalizeUUID(trace.task_id);
        const currentTaskId = normalizeUUID(taskId);
        const traceExecId = normalizeUUID(trace.execution_id);
        const currentExecId = normalizeUUID(selectedExecutionId);

        // Only append if it belongs to the currently viewed execution
        if (traceTaskId === currentTaskId && traceExecId === currentExecId) {
          setTraces(prev => {
            // Check for duplicates
            if (prev.find(t => normalizeUUID(t.id) === normalizeUUID(trace.id))) return prev;
            return [...prev, trace];
          });
        }
        
        // Also refresh executions list if it's a new execution ID we haven't seen
        if (traceTaskId === currentTaskId) {
           setExecutions(prev => {
              const matched = prev.find(e => normalizeUUID(e.execution_id) === traceExecId);
              if (matched) {
                 // Update error status if needed
                 return prev.map(e => normalizeUUID(e.execution_id) === traceExecId ? { ...e, is_error: e.is_error || trace.is_error } : e);
              }
              // New execution detected, trigger refresh
              fetchExecutions();
              return prev;
           });
        }
      } catch (err) {
        console.error('Failed to parse live trace:', err);
      }
    }
  }, [taskId, selectedExecutionId, fetchExecutions]);

  const { addListener, removeListener } = useSSE();

  useEffect(() => {
    addListener(onLiveEvent);
    return () => {
      removeListener(onLiveEvent);
    };
  }, [addListener, removeListener, onLiveEvent]);

  useEffect(() => {
    if (isOpen && taskId) {
      // Use microtask to avoid synchronous state updates in effect
      Promise.resolve().then(() => fetchExecutions());
    }
  }, [isOpen, taskId, fetchExecutions]);

  useEffect(() => {
    if (selectedExecutionId) {
      // Use microtask to avoid synchronous state updates in effect
      Promise.resolve().then(() => fetchTraces(selectedExecutionId));
    }
  }, [selectedExecutionId, fetchTraces]);


  const getShortId = (id) => {
    if (!id) return 'UNKNOWN';
    const parts = String(id).split('-');
    return parts.length > 1 ? parts.pop().substring(0, 8) : String(id).substring(0, 8);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-8 py-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
                    <Activity size={20} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-white tracking-tight uppercase">Execution Traces</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{taskName || 'NODE_' + taskId?.substring(0, 8)}</p>
                 </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Executions Sidebar */}
              <div className="w-64 border-r border-zinc-800 flex flex-col bg-black/20">
                 <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Recent Cycles</span>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {loadingExecutions ? (
                      <div className="p-4 text-center animate-pulse text-[9px] text-zinc-500 uppercase font-bold">Syncing...</div>
                    ) : executions.length === 0 ? (
                      <div className="p-4 text-center text-[9px] text-zinc-600 uppercase font-bold italic">No traces found</div>
                    ) : (
                      executions.map((exec, idx) => (
                        <button
                          key={exec?.execution_id || `cycle-${idx}`}
                          onClick={() => {
                            setSelectedExecutionId(exec?.execution_id);
                            setTraces([]); // Clear current to show loading state
                          }}
                          className={`w-full text-left p-3 rounded-xl transition-all group ${selectedExecutionId === exec?.execution_id ? 'bg-zinc-800 border border-zinc-700 shadow-md' : 'hover:bg-zinc-900/50 border border-transparent'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                             <span className={`text-[10px] font-mono ${selectedExecutionId === exec?.execution_id ? 'text-brand-primary' : 'text-zinc-400'}`}>
                               {getShortId(exec?.execution_id)}
                             </span>
                             {exec?.is_error ? <AlertCircle size={10} className="text-red-500" /> : <CheckCircle2 size={10} className="text-emerald-500" />}
                          </div>
                          <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">
                             {exec?.start_time ? new Date(exec.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'UNKNOWN'}
                          </div>
                        </button>
                      ))
                    )}
                 </div>
              </div>

              {/* Trace Details */}
              <div className="flex-1 flex flex-col bg-zinc-950 relative">
                 {loadingTraces && (
                   <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                   </div>
                 )}
                 
                 <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {(!traces || traces.length === 0) && !loadingTraces ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-20">
                         <Database size={64} />
                         <p className="text-xs font-bold uppercase tracking-[0.3em] mt-4">Buffer Empty</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {traces.map((trace, idx) => (
                          <div key={trace?.id || idx} className="relative pl-8 pb-6 border-l border-zinc-800 last:pb-0 last:border-transparent">
                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-zinc-950 ${trace?.is_error ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-zinc-800'}`}></div>
                            
                            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700 transition-colors shadow-sm">
                               <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                     <span className="text-xs font-black text-white uppercase tracking-tight">{trace?.step_name || 'UNNAMED_STEP'}</span>
                                     <span className="text-[9px] font-mono text-zinc-500 bg-black/40 px-2 py-0.5 rounded border border-zinc-800/50 uppercase tracking-widest">{(trace?.worker_id || 'UNKNOWN').substring(0, 8)}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-1.5 text-zinc-500">
                                        <Clock size={10} />
                                        <span className="text-[9px] font-bold tabular-nums">{trace?.duration_ms || 0}ms</span>
                                     </div>
                                  </div>
                               </div>

                               {trace?.input_data && (
                                 <div className="mb-4">
                                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block ml-1">Input Signal</span>
                                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-3 font-mono text-[10px] text-zinc-400 break-all shadow-inner max-h-32 overflow-y-auto custom-scrollbar">
                                       {trace.input_data}
                                    </div>
                                 </div>
                               )}

                               {trace?.output_data && (
                                 <div className="mb-4">
                                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block ml-1">Output Result</span>
                                    <div className={`bg-zinc-950 border rounded-lg p-3 font-mono text-[10px] break-all shadow-inner max-h-48 overflow-y-auto custom-scrollbar ${trace.is_error ? 'border-red-900/30 text-red-400' : 'border-emerald-900/30 text-emerald-400'}`}>
                                       {trace.output_data}
                                    </div>
                                 </div>
                               )}

                               {trace?.is_error && trace?.error_message && (
                                 <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                       <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Protocol Fault</span>
                                       <p className="text-[10px] text-red-400 font-mono leading-relaxed">{trace.error_message}</p>
                                    </div>
                                 </div>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            </div>
            
            <div className="px-8 py-5 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
               <button onClick={onClose} className="pro-button-secondary">Close Terminal</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExecutionTracesModal;
