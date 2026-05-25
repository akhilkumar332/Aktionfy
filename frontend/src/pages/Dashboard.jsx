import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, Key, RefreshCw, Copy, Check, 
  ShieldCheck, Zap, ShieldAlert, 
  Terminal, Cpu, Globe, ArrowUpRight, Layers, X, Eye, EyeOff, Activity, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE } from '../context/SSEContext';
import { useNotify } from '../context/NotificationContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const { user, checkAuth } = useAuth();
  const { notify } = useNotify();
  const isMounted = useRef(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [activities, setActivities] = useState([]);
  
  const [taskCount, setTaskCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [latencyHistory, setLatencyHistory] = useState(() => {
    const now = Date.now();
    return Array.from({ length: 8 }, (_, i) => {
      const timeStr = new Date(now - (8 - i) * 30000).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      return { time: timeStr, latency: 0 };
    });
  });

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/dashboard?range=${timeRange}`);
      if (res.data.success && isMounted.current) {
        setTaskCount(res.data.data.taskCount);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch dashboard data', err.response?.data?.error || err.message);
    }
  }, [notify, timeRange]);

  const fetchSystemStatus = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await axios.get('/api/v1/system/status');
      if (res.data.success && isMounted.current) {
        const status = res.data.data;
        setSystemStatus(status);
        setLatencyHistory(prev => {
          const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newHistory = [...prev, { time: now, latency: status.p99_latency_ms || 0 }];
          if (newHistory.length > 8) {
            return newHistory.slice(newHistory.length - 8);
          }
          return newHistory;
        });
      }
    } catch {
      // Fail silently for background telemetry polling to avoid console/UI noise
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchData(), fetchSystemStatus()]);
      if (isMounted.current) setIsLoading(false);
    };
    init();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchSystemStatus]);

  const { addListener, removeListener } = useSSE();

  useEffect(() => {
    const handleEvent = () => {
      fetchData();
      fetchSystemStatus();
    };
    const handleTaskExecuted = (payload) => {
      notify(
        payload.status === 'success' ? 'SUCCESS' : 'ERROR', 
        `Task ${payload.task_name || payload.task_id.slice(0, 8)} executed: ${payload.status}`
      );
      if (isMounted.current) {
        setActivities(prev => [{
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `Task ${payload.task_name || payload.task_id.slice(0, 8)} executed: ${payload.status}`,
          type: payload.status === 'success' ? 'success' : 'error'
        }, ...prev].slice(0, 5));
      }
      fetchData();
      fetchSystemStatus();
    };
    const handleTaskStatusChanged = () => {
      notify('SUCCESS', 'Task status updated');
      fetchData();
      fetchSystemStatus();
    };
    const handleApprovalRequired = (payload) => {
      if (isMounted.current) {
        setPendingApprovals(prev => {
          if (prev.find(a => a.task_id === payload.task_id)) return prev;
          return [...prev, payload];
        });
      }
      notify('ERROR', `Manual Approval Required: ${payload.task_name}`);
    };

    addListener('task_executed', handleTaskExecuted);
    addListener('task_status_changed', handleTaskStatusChanged);
    addListener('approval_required', handleApprovalRequired);
    addListener('task_updated', handleEvent);
    addListener('workspace_updated', handleEvent);
    addListener('template_updated', handleEvent);
    addListener('secret_updated', handleEvent);
    addListener('webhook_updated', handleEvent);
    addListener('settings_updated', handleEvent);
    addListener('worker_updated', handleEvent);
    addListener('bridge_status_changed', handleEvent);
    
    return () => {
      removeListener('task_executed', handleTaskExecuted);
      removeListener('task_status_changed', handleTaskStatusChanged);
      removeListener('approval_required', handleApprovalRequired);
      removeListener('task_updated', handleEvent);
      removeListener('workspace_updated', handleEvent);
      removeListener('template_updated', handleEvent);
      removeListener('secret_updated', handleEvent);
      removeListener('webhook_updated', handleEvent);
      removeListener('settings_updated', handleEvent);
      removeListener('worker_updated', handleEvent);
      removeListener('bridge_status_changed', handleEvent);
    };
  }, [addListener, removeListener, fetchData, fetchSystemStatus, notify]);

  const handleApprove = async (taskId) => {
    try {
      await axios.post(`/api/v1/tasks/${taskId}/approve`);
      if (isMounted.current) {
        setPendingApprovals(prev => prev.filter(a => a.task_id !== taskId));
      }
      notify('SUCCESS', 'Task approved and resumed');
      fetchData();
    } catch (err) {
      notify('ERROR', 'Failed to approve task', err.response?.data?.error || err.message);
    }
  };

  const handleDeny = async (taskId) => {
    try {
      await axios.post(`/api/v1/tasks/${taskId}/deny`);
      if (isMounted.current) {
        setPendingApprovals(prev => prev.filter(a => a.task_id !== taskId));
      }
      notify('SUCCESS', 'Task execution denied');
      fetchData();
    } catch (err) {
      notify('ERROR', 'Failed to deny task', err.response?.data?.error || err.message);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(user?.api_key);
    setCopied(true);
    setTimeout(() => {
      if (isMounted.current) setCopied(false);
    }, 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await axios.post('/api/v1/rotate-api-key');
      await checkAuth();
      notify('SUCCESS', 'API Key rotated successfully');
    } catch (err) {
      notify('ERROR', 'Failed to rotate API Key', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) {
        setRotating(false);
        setConfirmRotate(false);
      }
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await axios.post('/api/v1/billing/create-checkout-session');
      if (res.data.success && res.data.data.url) {
        window.location.assign(res.data.data.url);
      }
    } catch (err) {
      notify('ERROR', 'Failed to initiate upgrade', err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Hub</h1>
          <p className="text-zinc-400 text-sm font-medium mt-1">Global orchestration overview and system health.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg">
            <Calendar size={14} className="text-zinc-500 ml-2" />
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 font-bold uppercase tracking-wider focus:outline-none border-none cursor-pointer pr-4"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg shadow-sm">
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Cluster Status</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 mt-1 ${systemStatus?.bridge_active ? 'text-emerald-500' : 'text-red-500'}`}>
                   <div className={`w-1 h-1 rounded-full animate-pulse ${systemStatus?.bridge_active ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                   {systemStatus?.bridge_active ? 'Nominal' : 'Signal Lost'}
                </span>
             </div>
             <div className="h-6 w-px bg-zinc-800 mx-2"></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Latency</span>
                <span className="text-xs font-bold text-zinc-200 mt-1 tabular-nums font-mono">
                  {isLoading ? <div className="h-4 w-8 bg-zinc-800 animate-pulse rounded" /> : `${systemStatus?.p99_latency_ms || 0}ms`}
                </span>
             </div>
          </div>
        </div>
      </header>

      {/* Manual Interventions */}
      <AnimatePresence>
        {pendingApprovals.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-red-500 ml-2">
               <ShieldAlert size={14} className="animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manual Resolution Required</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {pendingApprovals.map((approval) => (
                <div key={approval.task_id} className="pro-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-red-500/20 bg-red-500/[0.02]">
                   <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                         <Terminal size={18} />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-base">{approval.task_name}</h4>
                        <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest mt-0.5">AUTH_REQ // {approval.execution_id?.slice(0, 13)}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 w-full sm:w-auto">
                     <button onClick={() => handleDeny(approval.task_id)} className="pro-button-secondary !py-2 !px-6 flex-1 sm:flex-none !border-zinc-800 text-[11px] uppercase tracking-widest">Abort</button>
                     <button onClick={() => handleApprove(approval.task_id)} className="pro-button-primary !py-2 !px-8 flex-1 sm:flex-none !bg-red-600 hover:!bg-red-500 text-[11px] uppercase tracking-widest">Authorize</button>
                   </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Stream Metrics */}
        <Link to="/tasks" className="pro-card p-8 group hover:bg-zinc-800/40 transition-all border-zinc-800/50">
           <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 group-hover:text-indigo-400 transition-colors shadow-inner">
                 <Layers size={20} />
              </div>
              <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
           </div>
           <div className="space-y-1">
              <div className="h-10 flex items-center">
                {isLoading ? (
                  <div className="h-8 w-16 bg-zinc-800/50 rounded animate-pulse" />
                ) : (
                  <p className="text-4xl font-bold text-white tabular-nums tracking-tighter">{taskCount}</p>
                )}
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Active Neural Streams</p>
           </div>
           <p className="text-xs text-zinc-400 mt-6 leading-relaxed opacity-80">Persistent orchestration threads executing across the cluster.</p>
        </Link>

        {/* Tier Status */}
        <div className="pro-card p-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
              <Crown size={100} />
           </div>
           <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 shadow-inner">
                 <Crown size={20} className="text-amber-500/50" />
              </div>
              {isLoading ? (
                <div className="h-6 w-16 bg-zinc-800/50 rounded-full animate-pulse" />
              ) : (
                <span className={`pro-badge ${user?.tier === 'pro' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                   {user?.tier}
                </span>
              )}
           </div>
           <div className="space-y-1 relative z-10">
              <div className="h-9 flex items-center">
                {isLoading ? (
                  <div className="h-7 w-24 bg-zinc-800/50 rounded animate-pulse" />
                ) : (
                  <p className="text-3xl font-bold text-white uppercase tracking-tight">{user?.tier} Node</p>
                )}
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Access Privilege Level</p>
           </div>
           {!isLoading && user?.tier === 'free' && (
             <button onClick={handleUpgrade} className="pro-button-primary w-full mt-8 !bg-zinc-100 !text-black hover:!bg-zinc-100 text-[11px] uppercase tracking-[0.2em] font-black">Elevate Tier</button>
           )}
        </div>

        {/* Execution Timeline Chart */}
        <div className="pro-card p-8 flex flex-col justify-between border-zinc-800/50 relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400">
                    <Activity size={20} className="text-indigo-400" />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-none">Execution Timeline</h3>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Real-time latency index</p>
                 </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-md">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                 <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Live telemetry</span>
              </div>
           </div>

           <div className="h-32 w-full relative z-10 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={latencyHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                      unit="ms"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.75rem' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '10px' }}
                      labelStyle={{ color: '#64748b', fontSize: '8px', fontWeight: 700 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorLatency)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* API Authentication Interface */}
        <div className="pro-card p-8 md:col-span-2 lg:col-span-3 space-y-8 relative overflow-hidden">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 shadow-inner">
                    <Key size={20} />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Neural Access Key</h3>
                    <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest mt-0.5">Private Protocol Token</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                {confirmRotate ? (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-2 shadow-sm">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest px-2">Authorize Rotation?</span>
                    <button 
                      onClick={handleRotate}
                      disabled={rotating}
                      className="p-2 bg-red-500 text-white rounded-md hover:brightness-110 transition-all shadow-md"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setConfirmRotate(false)}
                      className="p-2 bg-zinc-800 text-zinc-400 rounded-md hover:text-white transition-all border border-zinc-700 shadow-sm"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmRotate(true)} 
                    disabled={rotating}
                    className="pro-button-secondary !py-2 !px-6 !border-zinc-800 text-[11px] uppercase tracking-widest flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} /> Rotate Signature
                  </button>
                )}
              </div>
           </div>

           <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex items-center justify-between shadow-inner group/key">
                 <code className="text-sm font-mono text-emerald-500 tracking-[0.1em] opacity-80 truncate select-all">
                   {showKey ? user?.api_key : '•'.repeat(24)}
                 </code>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowKey(!showKey)}
                      className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all shadow-xl"
                      title={showKey ? "Hide Signature" : "Show Signature"}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={handleCopy} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all shadow-xl">
                      {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-3 bg-red-500/[0.02] border border-red-500/10 px-5 py-3 rounded-lg w-fit">
              <ShieldCheck size={14} className="text-red-900" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest italic">Security Notice: Key rotation will invalidate all active client integrations.</span>
           </div>
        </div>
      </div>

      {/* Quick Access Terminal */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: 'Blueprints', sub: 'Templates', icon: Cpu, path: '/templates' },
           { label: 'Sectors', sub: 'Workspaces', icon: Globe, path: '/workspaces' },
           { label: 'Protocols', sub: 'Integrations', icon: Zap, path: '/webhooks' },
           { label: 'Security', sub: 'Vault', icon: Key, path: '/vault' },
         ].map((nav) => (
           <Link key={nav.sub} to={nav.path} className="pro-card p-5 group hover:bg-zinc-900/80 transition-all flex items-center justify-between border-zinc-800/30">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 transition-colors">
                    <nav.icon size={18} />
                 </div>
                 <div className="hidden sm:block">
                    <span className="block text-[8px] font-bold text-zinc-300 uppercase tracking-widest mb-0.5">{nav.label}</span>
                    <span className="block text-sm font-bold text-zinc-200 tracking-tight">{nav.sub}</span>
                 </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-800 group-hover:text-zinc-400 transition-colors" />
           </Link>
         ))}
      </section>

      {/* Live Activity Feed */}
      <section className="pro-card p-8 border-zinc-800/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
             <h3 className="text-sm font-bold text-white uppercase tracking-widest">Live Activity Feed</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Last 5 events</span>
        </div>
        
        {activities.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/10">
             <span className="text-xs font-semibold text-zinc-500 italic">No recent network activity observed.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map(activity => (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  activity.type === 'success' 
                    ? 'bg-emerald-500/5 border-emerald-500/10' 
                    : 'bg-red-500/5 border-red-500/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${activity.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {activity.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  </div>
                  <span className="text-xs font-semibold text-zinc-300">{activity.message}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">{activity.time}</span>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;