import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { 
  Terminal, CheckCircle2, Clock, Activity, Users, 
  AlertTriangle, Database, Zap, RefreshCw, ShieldAlert, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Shimmer } from '../components/shared/AdvancedSkeleton';

const MetricsGrid = ({ usage }) => {
  if (!usage) return null;
  
  const metrics = [
    { label: 'Cluster Capacity', value: usage.users, icon: Users, color: 'text-blue-400', glow: 'bg-blue-500/10' },
    { label: 'Active Streams', value: usage.tasks, icon: Activity, color: 'text-indigo-400', glow: 'bg-indigo-500/10' },
    { label: 'Node Success', value: usage.task_successes, icon: CheckCircle2, color: 'text-emerald-400', glow: 'bg-emerald-500/10' },
    { label: 'System Errors', value: usage.task_failures, icon: AlertTriangle, color: 'text-red-400', glow: 'bg-red-500/10' },
    { label: 'Bypassed Cycles', value: usage.task_missed, icon: Clock, color: 'text-amber-400', glow: 'bg-amber-500/10' },
    { label: 'Audit Volume', value: usage.audit_log_events, icon: Database, color: 'text-purple-400', glow: 'bg-purple-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
      {metrics.map((m) => (
        <div key={m.label} className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-6 rounded-3xl space-y-4 relative overflow-hidden group shadow-lg hover:bg-zinc-900/60 hover:border-zinc-700 transition-all">
          <div className={`absolute top-0 right-0 w-24 h-24 ${m.glow} blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-1000`}></div>
          <div className="flex items-center justify-between relative z-10">
            <div className={`p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-inner group-hover:scale-110 transition-transform ${m.color}`}>
              <m.icon size={16} />
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">{m.value}</p>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-none mt-2 group-hover:text-zinc-400 transition-colors">{m.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const LogsView = ({ logs, logSearch, setLogSearch, fetchData, refreshing, logLimit, setLogLimit }) => {
  const scrollRef = useRef(null);
  
  const filteredLogs = logs.filter(log => 
    (log.action || '').toLowerCase().includes(logSearch.toLowerCase()) ||
    (log.user_id || '').toLowerCase().includes(logSearch.toLowerCase()) ||
    (log.resource_type || '').toLowerCase().includes(logSearch.toLowerCase())
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping absolute"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] relative z-10"></div>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">Audit Stream</h3>
         </div>
         
         <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="grep telemetry..." 
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 w-56 transition-all font-mono font-bold placeholder:text-zinc-700 shadow-inner"
              />
            </div>
            
            <select
              value={logLimit}
              onChange={(e) => {
                setLogLimit(Number(e.target.value));
                fetchData(true, Number(e.target.value));
              }}
              className="bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-zinc-400 px-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500/50 transition-all font-mono appearance-none shadow-inner"
            >
              <option value={50}>Limit: 50</option>
              <option value={100}>Limit: 100</option>
              <option value={250}>Limit: 250</option>
              <option value={500}>Limit: 500</option>
            </select>

            <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 px-4 py-2.5 rounded-xl shadow-inner">
              <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] animate-pulse">TERMINAL_ACTIVE</span>
              <div className="w-1.5 h-3.5 bg-emerald-500/40 animate-pulse"></div>
            </div>
            <button 
              onClick={() => fetchData(true, logLimit)}
              disabled={refreshing}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700 cursor-pointer"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
            </button>
         </div>
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 shadow-2xl rounded-[2rem] flex flex-col h-[650px] overflow-hidden relative group">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/60 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50 shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50 shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50 shadow-inner"></div>
            <span className="ml-3 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">aktionfy-security-kernel — auditd</span>
          </div>
          <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] tabular-nums">
             {logs.length} EVENTS LOADED
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 font-mono text-[12px] selection:bg-indigo-500/30 bg-[#0A0A0B]/80">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
               <ShieldAlert size={40} className="text-zinc-400" />
               <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] animate-pulse">Awaiting telemetry signal...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex gap-4 group hover:bg-zinc-800/30 -mx-2 px-3 py-1 rounded-md transition-colors items-start">
                  <span className="text-zinc-600 shrink-0 tabular-nums">
                    [{new Date(log.created_at).toLocaleTimeString()}]
                  </span>
                  <span className="text-indigo-400 font-bold shrink-0">
                    {log.user_id ? log.user_id.substring(0, 8) : 'SYSTEM'}
                  </span>
                  <span className="text-white font-black uppercase tracking-tight shrink-0 px-2 py-0.5 bg-zinc-900 border border-zinc-700/80 shadow-inner rounded text-[10px]">
                    {log.action}
                  </span>
                  <span className="text-zinc-500 shrink-0 italic font-medium">
                    {log.resource_type}
                  </span>
                  <span className="text-zinc-400 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-zinc-200 transition-colors">
                    {JSON.stringify(log.metadata)}
                  </span>
                </div>
              ))}
              <div ref={scrollRef} className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Monitor = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const { addListener, removeListener } = useSSE();
  const { wsRef } = useWebSocket();
  const [usage, setUsage] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [logLimit, setLogLimit] = useState(100);
  const [systemStatus, setSystemStatus] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uptime, setUptime] = useState(0);
  const isMounted = useRef(true);
  const { notify } = useNotify();

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'audit_log') {
          setAuditLogs(prev => {
            const newLogs = [...prev, data.payload];
            return newLogs.slice(-logLimit);
          });
        }
      } catch {
        // Silently handle non-JSON or unrelated messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [wsRef, logLimit]);

  const formatUptime = (sec) => {
    if (!sec) return '00d 00h 00m 00s';
    const d = Math.floor(sec / (3600 * 24));
    const h = Math.floor((sec % (3600 * 24)) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${d.toString().padStart(2, '0')}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  useEffect(() => {
    if (systemStatus?.uptime_seconds) {
      Promise.resolve().then(() => {
        setUptime(systemStatus.uptime_seconds);
      });
    }
  }, [systemStatus]);

  useEffect(() => {
    const t = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async (isUserInitiated = false, overrideLimit = logLimit) => {
    if (isUserInitiated) setRefreshing(true);
    
    try {
      const results = await Promise.allSettled([
        axios.get('/api/v1/admin/usage'),
        axios.get(`/api/v1/admin/audit-logs?limit=${overrideLimit}`),
        axios.get('/api/v1/system/status'),
        axios.get('/api/v1/admin/presence')
      ]);

      if (!isMounted.current) return;

      const [usageRes, auditRes, statusRes, presenceRes] = results;

      if (usageRes.status === 'fulfilled' && usageRes.value.data.success) {
        setUsage(usageRes.value.data.data);
      } else if (usageRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch usage metrics', usageRes.reason.response?.data?.error || usageRes.reason.message);
      }

      if (auditRes.status === 'fulfilled' && auditRes.value.data.success) {
        setAuditLogs(auditRes.value.data.data.reverse());
      } else if (auditRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch audit logs', auditRes.reason.response?.data?.error || auditRes.reason.message);
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
        setSystemStatus(statusRes.value.data.data);
      } else if (statusRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch system status', statusRes.reason.response?.data?.error || statusRes.reason.message);
      }

      if (presenceRes.status === 'fulfilled' && presenceRes.value.data.success) {
        setOnlineUsers(presenceRes.value.data.data || []);
      }

    } catch {
      if (isUserInitiated) {
        notify('ERROR', 'Unexpected error during monitor refresh', 'Network or cluster communication error');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [notify, logLimit]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchData(false, logLimit);
    };
    addListener('*', handleUpdate);
    return () => removeListener('*', handleUpdate);
  }, [addListener, removeListener, fetchData, logLimit]);

  useEffect(() => {
    isMounted.current = true;
    const init = async () => {
      await fetchData(false, logLimit);
    };
    init();
    const interval = setInterval(() => fetchData(false, logLimit), 5000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchData, logLimit]);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight"
          >
            System Monitor
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
          >
            Real-time infrastructure telemetry and security audit stream
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner"
        >
           <button 
             onClick={() => fetchData(true)}
             disabled={refreshing}
             className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700 disabled:opacity-50"
             aria-label="Refresh telemetry"
           >
             <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
           </button>
           <div className="bg-zinc-950 border border-zinc-800/80 px-5 py-3 rounded-xl flex items-center gap-3 shadow-inner">
              <div className="relative flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full absolute ${systemStatus?.bridge_active ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></div>
                <div className={`w-2.5 h-2.5 rounded-full relative z-10 ${systemStatus?.bridge_active ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]'}`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${systemStatus?.bridge_active ? 'text-emerald-500' : 'text-red-500'}`}>
                LIVE_LINK: {systemStatus?.bridge_active ? 'NOMINAL' : 'INTERRUPTED'}
              </span>
           </div>
        </motion.div>
      </header>

      <div className="flex items-center gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl w-fit shadow-inner backdrop-blur-xl">
        {[
          { id: 'stats', label: 'Telemetry', icon: Zap },
          { id: 'logs', label: 'Audit Trail', icon: Terminal }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-zinc-800 text-white shadow-md ring-1 ring-zinc-700/50' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-indigo-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading && !usage && auditLogs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-zinc-900/40 border border-zinc-800/60 p-6 rounded-3xl space-y-4">
                  <Shimmer className="w-5 h-5 rounded-xl" />
                  <Shimmer className="w-16 h-10 rounded-xl" />
                  <Shimmer className="w-24 h-3 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-zinc-900/40 border border-zinc-800/60 p-8 rounded-3xl h-56 flex flex-col items-center justify-center space-y-5">
                  <Shimmer className="w-32 h-4 rounded" />
                  <Shimmer className="w-40 h-16 rounded-2xl" />
                  <Shimmer className="w-24 h-3 rounded" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'stats' ? (
              <div className="space-y-8">
                 <MetricsGrid usage={usage} />
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {/* Core Uptime Counter */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500">
                       <Clock size={120} />
                     </div>
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Core Uptime Counter</span>
                     <div className="text-2xl font-black text-white font-mono tracking-wider tabular-nums bg-zinc-950/80 border border-zinc-800 px-6 py-5 rounded-2xl shadow-inner drop-shadow-md">
                       {formatUptime(uptime)}
                     </div>
                     <div className="flex items-center gap-2 mt-6 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute"></div>
                       <div className="w-2 h-2 rounded-full bg-emerald-500 relative z-10 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                       Clocking active cycles
                     </div>
                   </div>

                   {/* P99 Signal Latency */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">P99 Signal Latency</span>
                     <div className="relative w-36 h-36 flex items-center justify-center">
                       <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-[30px] group-hover:bg-indigo-500/20 transition-colors"></div>
                       <svg className="w-full h-full transform -rotate-90 relative z-10">
                         <circle cx="72" cy="72" r="58" className="stroke-zinc-900/80 fill-none" strokeWidth="8" />
                         <circle 
                           cx="72" 
                           cy="72" 
                           r="58" 
                           className="stroke-indigo-400 fill-none transition-all duration-1000" 
                           strokeWidth="8" 
                           strokeDasharray="364" 
                           strokeDashoffset={364 - (364 * Math.min((systemStatus?.p99_latency_ms || 0) / Math.max(1000, (systemStatus?.p99_latency_ms || 0) * 1.2), 1)) || 364} 
                           strokeLinecap="round"
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center z-20">
                         <span className="text-3xl font-black text-white font-mono tracking-tighter drop-shadow-md">{systemStatus?.p99_latency_ms || 0}ms</span>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Response</span>
                       </div>
                     </div>
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-6 bg-zinc-950 px-4 py-2 rounded-xl shadow-inner border border-zinc-800/80">
                       {(systemStatus?.p99_latency_ms || 0) < 200 ? '⚡ EXTREME FIDELITY' : (systemStatus?.p99_latency_ms || 0) < 500 ? '✅ OPERATIONAL' : '⚠️ DEGRADED'}
                     </div>
                   </div>

                   {/* Active Bridge Channels */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Active Bridge Channels</span>
                     <div className="relative w-36 h-36 flex items-center justify-center">
                       <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-[30px] group-hover:bg-blue-500/20 transition-colors"></div>
                       <svg className="w-full h-full transform -rotate-90 relative z-10">
                         <circle cx="72" cy="72" r="58" className="stroke-zinc-900/80 fill-none" strokeWidth="8" />
                         <circle 
                           cx="72" 
                           cy="72" 
                           r="58" 
                           className="stroke-blue-400 fill-none transition-all duration-1000" 
                           strokeWidth="8" 
                           strokeDasharray="364" 
                           strokeDashoffset={364 - (364 * Math.min((systemStatus?.active_sessions || 0) / Math.max(10, (systemStatus?.active_sessions || 0) * 1.5), 1)) || 364} 
                           strokeLinecap="round"
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center z-20">
                         <span className="text-4xl font-black text-white font-mono tracking-tighter drop-shadow-md">{systemStatus?.active_sessions || 0}</span>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Sessions</span>
                       </div>
                     </div>
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-6 flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl shadow-inner border border-zinc-800/80">
                       <span className={`w-2 h-2 rounded-full ${systemStatus?.bridge_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-zinc-600'}`} />
                       {systemStatus?.bridge_active ? 'BRIDGE ONLINE' : 'BRIDGE DORMANT'}
                     </div>
                   </div>

                   {/* Active Neural Actors (WebSocket Presence) */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500">
                       <Users size={120} />
                     </div>
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Active Neural Actors</span>
                     <div className="text-5xl font-black text-white font-mono tracking-tighter tabular-nums bg-zinc-950/80 border border-zinc-800 px-8 py-6 rounded-[2rem] shadow-inner relative overflow-hidden drop-shadow-md">
                       {onlineUsers.length}
                       <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-emerald-500 opacity-40 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]"></div>
                     </div>
                     <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-full">
                        {onlineUsers.slice(0, 3).map(uid => (
                          <span key={uid} className="text-[9px] font-black font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg shadow-inner">
                            {uid.substring(0, 8)}
                          </span>
                        ))}
                        {onlineUsers.length > 3 && <span className="text-[9px] font-black text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg shadow-inner">+{onlineUsers.length - 3} MORE</span>}
                     </div>
                   </div>

                   {/* Background Compute Nodes */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Background Compute Nodes</span>
                     <div className="relative w-36 h-36 flex items-center justify-center">
                       <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-[30px] group-hover:bg-purple-500/20 transition-colors"></div>
                       <svg className="w-full h-full transform -rotate-90 relative z-10">
                         <circle cx="72" cy="72" r="58" className="stroke-zinc-900/80 fill-none" strokeWidth="8" />
                         <circle 
                           cx="72" 
                           cy="72" 
                           r="58" 
                           className="stroke-purple-400 fill-none transition-all duration-1000" 
                           strokeWidth="8" 
                           strokeDasharray="364" 
                           strokeDashoffset={364 - (364 * Math.min((systemStatus?.worker_count || 0) / Math.max(5, (systemStatus?.worker_count || 0) * 1.5), 1)) || 364} 
                           strokeLinecap="round"
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center z-20">
                         <span className="text-4xl font-black text-white font-mono tracking-tighter drop-shadow-md">{systemStatus?.worker_count || 0}</span>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Workers</span>
                       </div>
                     </div>
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-6 bg-zinc-950 px-4 py-2 rounded-xl shadow-inner border border-zinc-800/80">
                       {systemStatus?.worker_count > 0 ? '💻 HYPER-THREADED' : '💤 NO ACTIVE WORKERS'}
                     </div>
                   </div>

                   {/* CPU Load */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors">
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Core CPU Load</span>
                     <div className="relative w-36 h-36 flex items-center justify-center">
                       <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-[30px] group-hover:bg-amber-500/20 transition-colors"></div>
                       <svg className="w-full h-full transform -rotate-90 relative z-10">
                         <circle cx="72" cy="72" r="58" className="stroke-zinc-900/80 fill-none" strokeWidth="8" />
                         <circle 
                           cx="72" 
                           cy="72" 
                           r="58" 
                           className="stroke-amber-400 fill-none transition-all duration-1000" 
                           strokeWidth="8" 
                           strokeDasharray="364" 
                           strokeDashoffset={364 - (364 * Math.min((systemStatus?.cpu_load_percent || 24) / 100, 1)) || 364} 
                           strokeLinecap="round"
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center z-20">
                         <span className="text-3xl font-black text-white font-mono tracking-tighter drop-shadow-md">{Math.round(systemStatus?.cpu_load_percent || 24)}%</span>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">Usage</span>
                       </div>
                     </div>
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-6 bg-zinc-950 px-4 py-2 rounded-xl shadow-inner border border-zinc-800/80">
                       {(systemStatus?.cpu_load_percent || 24) < 70 ? '🟢 OPTIMAL' : '⚠️ HIGH LOAD'}
                     </div>
                   </div>

                   {/* Memory Load */}
                   <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 transition-colors md:col-span-2 lg:col-span-3 lg:w-1/3 lg:mx-auto">
                     <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5">Memory Allocation</span>
                     <div className="relative w-36 h-36 flex items-center justify-center">
                       <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-[30px] group-hover:bg-emerald-500/20 transition-colors"></div>
                       <svg className="w-full h-full transform -rotate-90 relative z-10">
                         <circle cx="72" cy="72" r="58" className="stroke-zinc-900/80 fill-none" strokeWidth="8" />
                         <circle 
                           cx="72" 
                           cy="72" 
                           r="58" 
                           className="stroke-emerald-400 fill-none transition-all duration-1000" 
                           strokeWidth="8" 
                           strokeDasharray="364" 
                           strokeDashoffset={364 - (364 * Math.min(((systemStatus?.memory_mb || 620) / 1024), 1)) || 364} 
                           strokeLinecap="round"
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center z-20">
                         <span className="text-3xl font-black text-white font-mono tracking-tighter drop-shadow-md">{Math.round((systemStatus?.memory_mb || 620) / 1024 * 100)}%</span>
                         <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">{systemStatus?.memory_mb || 620}MB</span>
                       </div>
                     </div>
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-6 bg-zinc-950 px-4 py-2 rounded-xl shadow-inner border border-zinc-800/80">
                       {((systemStatus?.memory_mb || 620) / 1024 * 100) < 85 ? '🟢 EFFICIENT' : '⚠️ OOM RISK'}
                     </div>
                   </div>
                 </div>
              </div>
            ) : (
              <LogsView 
                logs={auditLogs} 
                logSearch={logSearch} 
                setLogSearch={setLogSearch} 
                fetchData={fetchData} 
                refreshing={refreshing}
                logLimit={logLimit}
                setLogLimit={setLogLimit}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Monitor;