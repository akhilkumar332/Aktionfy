import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { 
  Terminal, CheckCircle2, Clock, Activity, Users, 
  AlertTriangle, Database, Zap, RefreshCw, Server, Command, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatsTab = ({ usage }) => {
  if (!usage) return null;
  
  const metrics = [
    { label: 'Cluster Nodes', value: usage.users, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Neural Streams', value: usage.tasks, icon: Activity, color: 'text-white', bg: 'bg-white/10' },
    { label: 'Protocol Success', value: usage.task_successes, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Critical Errors', value: usage.task_failures, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Missed Cycles', value: usage.task_missed, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Audit Density', value: usage.audit_log_events, icon: Database, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((m, idx) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="bg-obsidian-900 border border-white/5 rounded-[3rem] p-10 backdrop-blur-3xl hover:border-white/20 transition-all group relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className={`p-4 rounded-2xl ${m.bg} border border-white/5 transition-transform group-hover:rotate-12`}>
               <m.icon className={`w-6 h-6 ${m.color}`} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Real-time Pulse</span>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-5xl font-black text-white mb-2 tabular-nums tracking-tighter">{m.value}</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 opacity-60">{m.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const LogsTab = ({ logs }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-obsidian-900 rounded-[3.5rem] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl relative"
  >
    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

    <div className="flex items-center justify-between px-12 py-10 bg-white/[0.02] border-b border-white/5 relative z-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
           <Terminal className="w-6 h-6 text-brand-primary" />
        </div>
        <div>
           <span className="text-xs font-mono font-black text-white tracking-widest uppercase">system_audit_trail.log</span>
           <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">Authorized Governance Stream</p>
        </div>
      </div>
      <div className="px-5 py-2 bg-black/40 border border-white/5 rounded-2xl text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></div>
         Live Monitoring
      </div>
    </div>
    
    <div className="p-0 overflow-x-auto custom-scrollbar relative z-10">
      <table className="w-full text-left border-collapse font-mono text-[11px] min-w-[900px]">
        <thead className="bg-black/20 text-slate-700">
          <tr>
            <th className="px-12 py-6 font-black uppercase tracking-[0.2em]">Timestamp</th>
            <th className="px-8 py-6 font-black uppercase tracking-[0.2em]">Neural Subject</th>
            <th className="px-8 py-6 font-black uppercase tracking-[0.2em]">Operation</th>
            <th className="px-8 py-6 font-black uppercase tracking-[0.2em]">Sector</th>
            <th className="px-12 py-6 font-black uppercase tracking-[0.2em] text-right">Encrypted Manifest</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {logs.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-12 py-40 text-center">
                 <div className="flex flex-col items-center gap-6">
                    <ShieldAlert size={48} className="text-slate-800" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic opacity-50">Audit buffer is currently empty. Baseline system state maintained.</span>
                 </div>
              </td>
            </tr>
          ) : logs.map((log) => (
            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="px-12 py-6 text-slate-500 whitespace-nowrap tabular-nums font-mono opacity-80">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="px-8 py-6">
                <div className="flex items-center gap-2">
                   <Users size={12} className="text-blue-500/50" />
                   <span className="text-blue-400 font-black tracking-tight">{log.user_id ? log.user_id.substring(0, 13) : 'SYSTEM_ROOT'}</span>
                </div>
              </td>
              <td className="px-8 py-6">
                <span className="text-white font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg border border-white/5">{log.action}</span>
              </td>
              <td className="px-8 py-6">
                <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-[10px] tracking-widest">
                   <Command size={10} className="text-slate-600" />
                   {log.resource_type}
                </div>
              </td>
              <td className="px-12 py-6 text-right">
                <code className="text-slate-600 group-hover:text-emerald-500/80 transition-colors truncate block max-w-[250px] ml-auto font-mono text-[10px] bg-black/20 p-2 rounded-lg border border-white/5">
                  {JSON.stringify(log.metadata)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const Monitor = () => {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' or 'logs'
  const [usage, setUsage] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (isMounted = { current: true }) => {
    try {
      const [usageRes, auditRes] = await Promise.all([
        axios.get('/api/v1/admin/usage'),
        axios.get('/api/v1/admin/audit-logs?limit=100')
      ]);
      if (!isMounted.current) return;
      if (usageRes.data.success) setUsage(usageRes.data.data);
      if (auditRes.data.success) setAuditLogs(auditRes.data.data);
    } catch (err) {
      console.error('Failed to fetch monitor data', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isMounted = { current: true };
    const init = async () => {
      await fetchData(isMounted);
    };
    init();
    const interval = setInterval(() => fetchData(isMounted), 60000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Server size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Oversight</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            System Monitor.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Real-time Telemetry & Global Audit Stream</p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={() => fetchData()}
             className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
           >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
           <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural Link</span>
                 <span className="text-xs font-black text-emerald-400 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                    NOMINAL
                 </span>
              </div>
           </div>
        </div>
      </header>

      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'stats', label: 'Neural Pulse', icon: Zap },
          { id: 'logs', label: 'Audit Stream', icon: Terminal }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-brand-primary border-brand-primary text-white shadow-[0_20px_50px_rgba(217,119,6,0.3)]' 
                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'animate-pulse' : ''} />
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
            className="flex flex-col items-center justify-center py-40 gap-8"
          >
            <div className="relative">
               <div className="w-16 h-16 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
               <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-10 animate-pulse"></div>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Synchronizing Global Telemetry...</p>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {activeTab === 'stats' ? (
              <StatsTab usage={usage} />
            ) : (
              <LogsTab logs={auditLogs} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default Monitor;