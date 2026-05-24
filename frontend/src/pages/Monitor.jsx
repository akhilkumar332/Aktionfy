import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { 
  Terminal, CheckCircle2, Clock, Activity, Users, 
  AlertTriangle, Database, Zap, RefreshCw, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

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

const LogsView = ({ logs }) => (
  <div className="pro-card overflow-hidden">
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse font-mono text-[11px]">
        <thead>
          <tr className="pro-table-header">
            <th className="px-6 py-4">Timestamp</th>
            <th className="px-6 py-4">Subject</th>
            <th className="px-6 py-4">Action</th>
            <th className="px-6 py-4">Scope</th>
            <th className="px-6 py-4 text-right">Telemetry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {logs.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-32 text-center">
                 <div className="flex flex-col items-center gap-3 opacity-30">
                    <ShieldAlert size={32} className="text-zinc-300" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Audit stream synchronized. No events detected.</span>
                 </div>
              </td>
            </tr>
          ) : logs.map((log) => (
            <tr key={log.id} className="pro-table-row group">
              <td className="px-6 py-4 text-zinc-400 whitespace-nowrap tabular-nums">
                {new Date(log.created_at).toLocaleTimeString()}
              </td>
              <td className="px-6 py-4">
                <span className="text-blue-400 font-semibold">{log.user_id ? log.user_id.substring(0, 13) : 'SYSTEM_ROOT'}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-zinc-100 font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-800 rounded border border-zinc-700">{log.action}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-zinc-400 uppercase font-bold text-[10px] tracking-widest">{log.resource_type}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <code className="text-zinc-300 group-hover:text-zinc-400 transition-colors truncate block max-w-[200px] ml-auto font-mono text-[10px]">
                  {JSON.stringify(log.metadata)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Monitor = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const { addListener, removeListener } = useSSE();
  const [usage, setUsage] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uptime, setUptime] = useState(0);
  const isMounted = useRef(true);
  const { notify } = useNotify();

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

  const fetchData = useCallback(async (isUserInitiated = false) => {
    if (isUserInitiated) setRefreshing(true);
    
    try {
      const results = await Promise.allSettled([
        axios.get('/api/v1/admin/usage'),
        axios.get('/api/v1/admin/audit-logs?limit=100'),
        axios.get('/api/v1/system/status')
      ]);

      if (!isMounted.current) return;

      const [usageRes, auditRes, statusRes] = results;

      if (usageRes.status === 'fulfilled' && usageRes.value.data.success) {
        setUsage(usageRes.value.data.data);
      } else if (usageRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch usage metrics', usageRes.reason.response?.data?.error || usageRes.reason.message);
      }

      if (auditRes.status === 'fulfilled' && auditRes.value.data.success) {
        setAuditLogs(auditRes.value.data.data);
      } else if (auditRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch audit logs', auditRes.reason.response?.data?.error || auditRes.reason.message);
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.data.success) {
        setSystemStatus(statusRes.value.data.data);
      } else if (statusRes.status === 'rejected' && isUserInitiated) {
        notify('ERROR', 'Failed to fetch system status', statusRes.reason.response?.data?.error || statusRes.reason.message);
      }

    } catch (err) {
      if (isUserInitiated) {
        notify('ERROR', 'Unexpected error during monitor refresh', err.message);
      }
      console.error('Monitor fetch error:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchData(false);
    };
    addListener('*', handleUpdate);
    return () => removeListener('*', handleUpdate);
  }, [addListener, removeListener, fetchData]);

  useEffect(() => {
    isMounted.current = true;
    const init = async () => {
      await fetchData();
    };
    init();
    const interval = setInterval(() => fetchData(false), 60000);
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
            className="flex flex-col items-center justify-center py-40 gap-4 opacity-50"
          >
            <RefreshCw className="animate-spin text-zinc-300" size={32} />
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Establishing Signal...</p>
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
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.p99_latency_ms || 0) / 1000, 1)) || 282} 
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
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.active_sessions || 0) / 10, 1)) || 282} 
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
                           strokeDashoffset={282 - (282 * Math.min((systemStatus?.worker_count || 0) / 5, 1)) || 282} 
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
                 </div>
              </div>
            ) : (
              <LogsView logs={auditLogs} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Monitor;