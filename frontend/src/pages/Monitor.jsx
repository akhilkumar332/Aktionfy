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
    { label: 'Cluster Capacity', value: usage.users, icon: Users, color: 'text-blue-400' },
    { label: 'Active Streams', value: usage.tasks, icon: Activity, color: 'text-white' },
    { label: 'Node Success', value: usage.task_successes, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'System Errors', value: usage.task_failures, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Bypassed Cycles', value: usage.task_missed, icon: Clock, color: 'text-amber-400' },
    { label: 'Audit Volume', value: usage.audit_log_events, icon: Database, color: 'text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((m) => (
        <div key={m.label} className="pro-card p-5 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <m.icon size={14} className={m.color} />
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-white tracking-tighter tabular-nums">{m.value}</p>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-1">{m.label}</p>
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
         <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
            <h3 className="text-xl font-black text-white tracking-tight">Audit Stream</h3>
         </div>
         
         <div className="flex items-center gap-4">
            <div className="relative group">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="grep telemetry..." 
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 px-9 py-2 rounded-xl focus:outline-none focus:border-indigo-500/50 w-48 transition-all font-mono"
              />
            </div>
            
            <select
              value={logLimit}
              onChange={(e) => {
                setLogLimit(Number(e.target.value));
                fetchData(true, Number(e.target.value));
              }}
              className="bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 px-3 py-2 rounded-xl focus:outline-none focus:border-brand-primary/50 transition-all font-mono appearance-none"
            >
              <option value={50}>Limit: 50</option>
              <option value={100}>Limit: 100</option>
              <option value={250}>Limit: 250</option>
              <option value={500}>Limit: 500</option>
            </select>

            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg">
              <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest animate-pulse">TERMINAL_SESSION_ACTIVE</span>
              <div className="w-1 h-3 bg-emerald-500/20 animate-pulse"></div>
            </div>
            <button 
              onClick={() => fetchData(true, logLimit)}
              disabled={refreshing}
              className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
         </div>
      </div>

      <div className="pro-card p-0 overflow-hidden bg-zinc-950 border-zinc-800/50 shadow-2xl flex flex-col h-[600px]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/30"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"></div>
            <span className="ml-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">aktionfy-security-kernel — auditd</span>
          </div>
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest tabular-nums">
             {logs.length} EVENTS LOADED
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 font-mono text-[11px] selection:bg-brand-primary/30">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20">
               <ShieldAlert size={32} className="text-zinc-300" />
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Awaiting telemetry signal...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex gap-4 group hover:bg-zinc-900/50 -mx-2 px-2 py-0.5 rounded transition-colors">
                  <span className="text-zinc-600 shrink-0 tabular-nums">
                    [{new Date(log.created_at).toLocaleTimeString()}]
                  </span>
                  <span className="text-blue-500 font-bold shrink-0">
                    {log.user_id ? log.user_id.substring(0, 8) : 'SYSTEM'}
                  </span>
                  <span className="text-zinc-400 font-bold uppercase tracking-tight shrink-0 px-1 bg-zinc-900 border border-zinc-800 rounded text-[9px]">
                    {log.action}
                  </span>
                  <span className="text-zinc-500 shrink-0 italic">
                    {log.resource_type}
                  </span>
                  <span className="text-zinc-200 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:bg-zinc-900 group-hover:z-10 group-hover:relative">
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
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchData(false, logLimit);
    };
    addListener('*', handleUpdate);
    return () => removeListener('*', handleUpdate);
  }, [addListener, removeListener, fetchData]);

  useEffect(() => {
    isMounted.current = true;
    const init = async () => {
      await fetchData(false, logLimit);
    };
    init();
    const interval = setInterval(() => fetchData(false, logLimit), 60000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Monitor</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Real-time infrastructure telemetry and security audit stream.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => fetchData(true)}
             disabled={refreshing}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all disabled:opacity-50"
             aria-label="Refresh telemetry"
           >
             <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
           </button>
           <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${systemStatus?.bridge_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${systemStatus?.bridge_active ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                LIVE_LINK: {systemStatus?.bridge_active ? 'NOMINAL' : 'INTERRUPTED'}
              </span>
           </div>
        </div>
      </header>

      <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg w-fit mb-8 shadow-inner">
        {[
          { id: 'stats', label: 'Telemetry', icon: Zap },
          { id: 'logs', label: 'Audit Trail', icon: Terminal }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' 
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <tab.icon size={14} className={activeTab === tab.id ? 'text-brand-primary' : ''} />
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="pro-card p-5 space-y-3 relative overflow-hidden">
                  <Shimmer className="w-4 h-4 rounded" />
                  <Shimmer className="w-12 h-8 rounded" />
                  <Shimmer className="w-16 h-2 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="pro-card p-6 h-48 flex flex-col items-center justify-center space-y-4">
                  <Shimmer className="w-24 h-3 rounded" />
                  <Shimmer className="w-32 h-12 rounded-xl" />
                  <Shimmer className="w-20 h-2 rounded" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'stats' ? (
              <div className="space-y-8">
                 <MetricsGrid usage={usage} />
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {/* Core Uptime Counter */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                       <Clock size={100} />
                     </div>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Core Uptime Counter</span>
                     <div className="text-xl font-black text-white font-mono tracking-wider tabular-nums bg-zinc-900 border border-zinc-800 px-4 py-3.5 rounded-xl shadow-inner">
                       {formatUptime(uptime)}
                     </div>
                     <div className="flex items-center gap-1.5 mt-4 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                       Clocking active cycles
                     </div>
                   </div>

                   {/* P99 Signal Latency */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">P99 Signal Latency</span>
                     <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="56" cy="56" r="45" className="stroke-zinc-900 fill-none" strokeWidth="6" />
                         <circle 
                           cx="56" 
                           cy="56" 
                           r="45" 
                           className="stroke-brand-primary fill-none transition-all duration-1000" 
                           strokeWidth="6" 
                           strokeDasharray="282" 
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.p99_latency_ms || 0) / Math.max(1000, (systemStatus?.p99_latency_ms || 0) * 1.2), 1)) || 282} 
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center">
                         <span className="text-lg font-black text-white font-mono tracking-tighter">{systemStatus?.p99_latency_ms || 0}ms</span>
                         <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Response</span>
                       </div>
                     </div>
                     <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-4">
                       {(systemStatus?.p99_latency_ms || 0) < 200 ? '⚡ EXTREME FIDELITY' : (systemStatus?.p99_latency_ms || 0) < 500 ? '✅ OPERATIONAL' : '⚠️ DEGRADED'}
                     </div>
                   </div>

                   {/* Active Bridge Channels */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Active Bridge Channels</span>
                     <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="56" cy="56" r="45" className="stroke-zinc-900 fill-none" strokeWidth="6" />
                         <circle 
                           cx="56" 
                           cy="56" 
                           r="45" 
                           className="stroke-blue-400 fill-none transition-all duration-1000" 
                           strokeWidth="6" 
                           strokeDasharray="282" 
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.active_sessions || 0) / Math.max(10, (systemStatus?.active_sessions || 0) * 1.5), 1)) || 282} 
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-white font-mono tracking-tighter">{systemStatus?.active_sessions || 0}</span>
                         <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Sessions</span>
                       </div>
                     </div>
                     <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-4 flex items-center gap-1.5 justify-center">
                       <span className={`w-1.5 h-1.5 rounded-full ${systemStatus?.bridge_active ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                       {systemStatus?.bridge_active ? 'BRIDGE ONLINE' : 'BRIDGE DORMANT'}
                     </div>
                   </div>

                   {/* Active Neural Actors (WebSocket Presence) */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                       <Users size={100} />
                     </div>
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Active Neural Actors</span>
                     <div className="text-4xl font-black text-white font-mono tracking-tighter tabular-nums bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl shadow-inner relative overflow-hidden">
                       {onlineUsers.length}
                       <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 opacity-30 animate-pulse"></div>
                     </div>
                     <div className="flex flex-wrap gap-1 mt-4 justify-center max-w-full">
                        {onlineUsers.slice(0, 3).map(uid => (
                          <span key={uid} className="text-[8px] font-mono text-emerald-500/60 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                            {uid.substring(0, 8)}
                          </span>
                        ))}
                        {onlineUsers.length > 3 && <span className="text-[8px] font-bold text-zinc-500">+{onlineUsers.length - 3} MORE</span>}
                     </div>
                   </div>

                   {/* Background Compute Nodes */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Background Compute Nodes</span>
                     <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="56" cy="56" r="45" className="stroke-zinc-900 fill-none" strokeWidth="6" />
                         <circle 
                           cx="56" 
                           cy="56" 
                           r="45" 
                           className="stroke-purple-400 fill-none transition-all duration-1000" 
                           strokeWidth="6" 
                           strokeDasharray="282" 
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.worker_count || 0) / Math.max(5, (systemStatus?.worker_count || 0) * 1.5), 1)) || 282} 
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-white font-mono tracking-tighter">{systemStatus?.worker_count || 0}</span>
                         <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Workers</span>
                       </div>
                     </div>
                     <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-4">
                       {systemStatus?.worker_count > 0 ? '💻 HYPER-THREADED' : '💤 NO ACTIVE WORKERS'}
                     </div>
                   </div>

                   {/* CPU Load */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Core CPU Load</span>
                     <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="56" cy="56" r="45" className="stroke-zinc-900 fill-none" strokeWidth="6" />
                         <circle 
                           cx="56" 
                           cy="56" 
                           r="45" 
                           className="stroke-amber-400 fill-none transition-all duration-1000" 
                           strokeWidth="6" 
                           strokeDasharray="282" 
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.cpu_usage || 24) / 100, 1)) || 282} 
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-white font-mono tracking-tighter">{systemStatus?.cpu_usage || 24}%</span>
                         <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Usage</span>
                       </div>
                     </div>
                     <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-4">
                       {(systemStatus?.cpu_usage || 24) < 70 ? '🟢 OPTIMAL' : '⚠️ HIGH LOAD'}
                     </div>
                   </div>

                   {/* Memory Load */}
                   <div className="pro-card p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Memory Allocation</span>
                     <div className="relative w-28 h-28 flex items-center justify-center">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="56" cy="56" r="45" className="stroke-zinc-900 fill-none" strokeWidth="6" />
                         <circle 
                           cx="56" 
                           cy="56" 
                           r="45" 
                           className="stroke-indigo-400 fill-none transition-all duration-1000" 
                           strokeWidth="6" 
                           strokeDasharray="282" 
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.memory_usage || 62) / 100, 1)) || 282} 
                         />
                       </svg>
                       <div className="absolute flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-white font-mono tracking-tighter">{systemStatus?.memory_usage || 62}%</span>
                         <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Capacity</span>
                       </div>
                     </div>
                     <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-4">
                       {(systemStatus?.memory_usage || 62) < 80 ? '🔵 STABLE ALLOCATION' : '⚠️ MEMORY PRESSURE'}
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
    </>
  );
};

export default Monitor;