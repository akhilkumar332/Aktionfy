import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, Key, RefreshCw, Copy, Check, 
  ShieldCheck, Zap, ShieldAlert, 
  Terminal, Cpu, Globe, ArrowUpRight, Layers, X, Eye, EyeOff, Activity, Calendar, CheckCircle2, AlertCircle
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
  const [latencyHistory, setLatencyHistory] = useState([]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, activityRes] = await Promise.all([
        axios.get(`/api/v1/dashboard?range=${timeRange}`),
        axios.get('/api/v1/dashboard/activities')
      ]);

      if (isMounted.current) {
        if (dashRes.data.success) {
          setTaskCount(dashRes.data.data.taskCount);
          if (dashRes.data.data.pendingApprovals) {
            setPendingApprovals(dashRes.data.data.pendingApprovals);
          }
          if (dashRes.data.data.latencyHistory && dashRes.data.data.latencyHistory.length > 0) {
            setLatencyHistory(dashRes.data.data.latencyHistory);
          } else if (latencyHistory.length === 0) {
            // Fill with 0s initially if no history exists yet
            const now = Date.now();
            setLatencyHistory(Array.from({ length: 8 }, (_, i) => ({
              time: new Date(now - (8 - i) * 60000).toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              }),
              latency: 0
            })));
          }
        }
        if (activityRes.data.success) {
          const historical = (activityRes.data.data || []).map(event => {
            let message = event.event_type;
            let type = 'success';
            let timeStr = 'Recent';
            if (event.timestamp && event.timestamp !== '0001-01-01T00:00:00Z') {
              timeStr = new Date(event.timestamp).toLocaleTimeString();
            }
            try {
              const payload = JSON.parse(event.payload);
              if (event.event_type === 'task_executed') {
                message = `Task ${payload.task_name || payload.task_id.slice(0, 8)} executed: ${payload.status}`;
                type = payload.status === 'success' ? 'success' : 'error';
              }
            } catch { /* ignore */ }
            
            return {
              id: `${event.timestamp || Math.random()}-${event.event_type}`,
              time: timeStr,
              message,
              type
            };
          });
          setActivities(historical.slice(0, 5));
        }
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch dashboard data', err.response?.data?.error || err.message);
    }
  }, [notify, timeRange, latencyHistory.length]);

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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight"
          >
            Command Hub
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
          >
            Global orchestration overview & system health
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          {/* Time Range Selector */}
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 px-4 py-2 rounded-2xl shadow-lg">
            <Calendar size={14} className="text-zinc-400" />
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-[11px] text-zinc-200 font-black uppercase tracking-widest focus:outline-none border-none cursor-pointer appearance-none"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* System Status Pill */}
          <div className="flex items-center gap-4 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 px-5 py-2.5 rounded-2xl shadow-lg">
             <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full bg-zinc-950 border ${systemStatus?.bridge_active ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                   <Activity size={12} className={systemStatus?.bridge_active ? 'animate-pulse' : ''} />
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">Cluster Status</span>
                   <span className={`text-[11px] font-black uppercase tracking-wider mt-1 ${systemStatus?.bridge_active ? 'text-emerald-400' : 'text-red-400'}`}>
                      {systemStatus?.bridge_active ? 'Nominal' : 'Signal Lost'}
                   </span>
                </div>
             </div>
             <div className="h-8 w-px bg-zinc-800/80 mx-2"></div>
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">Latency p99</span>
                   <span className="text-[11px] font-black text-zinc-200 uppercase tracking-wider mt-1 font-mono">
                     {isLoading ? <div className="h-3 w-8 bg-zinc-800 animate-pulse rounded" /> : `${systemStatus?.p99_latency_ms || 0}MS`}
                   </span>
                </div>
             </div>
          </div>
        </motion.div>
      </header>

      {/* Manual Interventions (Only shows if active) */}
      <AnimatePresence>
        {pendingApprovals.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 text-red-500 mb-6 pl-2">
                 <ShieldAlert size={16} className="animate-pulse" />
                 <span className="text-[11px] font-black uppercase tracking-[0.2em]">Manual Resolution Required</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingApprovals.map((approval) => (
                  <div key={approval.task_id} className="bg-zinc-950/50 border border-red-900/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                           <Terminal size={20} />
                        </div>
                        <div>
                          <h4 className="text-white font-black tracking-tight">{approval.task_name}</h4>
                          <p className="text-[9px] font-mono font-bold text-red-400/80 uppercase tracking-widest mt-1">AUTH_REQ // {approval.execution_id?.slice(0, 13)}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                       <button onClick={() => handleDeny(approval.task_id)} className="flex-1 sm:flex-none px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-zinc-800">Abort</button>
                       <button onClick={() => handleApprove(approval.task_id)} className="flex-1 sm:flex-none px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]">Authorize</button>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Bento Box Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Stream Metrics (Small Box) */}
        <Link to="/tasks" className="lg:col-span-4 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-3xl group hover:bg-zinc-900/60 transition-all shadow-xl flex flex-col justify-between">
           <div className="flex items-center justify-between mb-8">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                 <Layers size={24} />
              </div>
              <ArrowUpRight size={20} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
           </div>
           <div>
              <div className="h-12 flex items-center mb-2">
                {isLoading ? (
                  <div className="h-10 w-24 bg-zinc-800 animate-pulse rounded-lg" />
                ) : (
                  <p className="text-5xl font-black text-white tabular-nums tracking-tighter">{taskCount}</p>
                )}
              </div>
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Active Task Streams</p>
              <p className="text-xs font-medium text-zinc-500 mt-4 leading-relaxed">Persistent orchestration threads executing across the cluster.</p>
           </div>
        </Link>

        {/* Execution Timeline Chart (Large Box) */}
        <div className="lg:col-span-8 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-3xl relative overflow-hidden group shadow-xl flex flex-col justify-between min-h-[300px]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
           
           <div className="flex items-start justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                 <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl text-zinc-400">
                    <Activity size={24} className="text-indigo-400" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Execution Timeline</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">Real-time latency index</p>
                 </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.1em]">Live Telemetry</span>
              </div>
           </div>

           <div className="flex-1 w-full relative z-10 mt-4 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={latencyHistory} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#52525b" 
                      fontSize={9}
                      fontWeight={700}
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={9}
                      fontWeight={700}
                      tickLine={false} 
                      axisLine={false}
                      unit="ms"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      labelStyle={{ color: '#a1a1aa', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#818cf8" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorLatency)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* API Authentication Interface (Wide Box) */}
        <div className="lg:col-span-8 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-3xl relative overflow-hidden shadow-xl">
           <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                 <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl text-zinc-400">
                    <Key size={24} className="text-amber-400" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white tracking-tight">API Access Key</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">Private Protocol Token</p>
                 </div>
              </div>
              <div>
                {confirmRotate ? (
                  <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/50 rounded-xl p-2 shadow-lg backdrop-blur-md">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest px-3">Authorize?</span>
                    <button 
                      onClick={handleRotate}
                      disabled={rotating}
                      className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all shadow-md"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setConfirmRotate(false)}
                      className="p-2.5 bg-zinc-900 text-zinc-400 rounded-lg hover:text-white transition-all border border-zinc-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmRotate(true)} 
                    disabled={rotating}
                    className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black text-zinc-300 uppercase tracking-[0.1em] transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={rotating ? 'animate-spin text-amber-400' : 'text-zinc-500'} /> 
                    Rotate Signature
                  </button>
                )}
              </div>
           </div>

           <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 flex items-center justify-between shadow-inner">
              <code className="text-sm md:text-base font-mono font-bold text-emerald-400 tracking-[0.15em] opacity-90 truncate select-all px-2">
                {showKey ? user?.api_key : '•'.repeat(32)}
              </code>
              <div className="flex items-center gap-2 shrink-0">
                 <button 
                   onClick={() => setShowKey(!showKey)}
                   className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all hover:scale-105 active:scale-95"
                   title={showKey ? "Hide Signature" : "Show Signature"}
                 >
                   {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
                 <button 
                   onClick={handleCopy} 
                   className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all hover:scale-105 active:scale-95"
                 >
                   {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                 </button>
              </div>
           </div>

           <div className="mt-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-5 py-3 rounded-xl w-fit">
              <ShieldCheck size={16} className="text-amber-500" />
              <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">Security Notice: Key rotation invalidates all active integrations.</span>
           </div>
        </div>

        {/* Tier Status (Small Box) */}
        <div className="lg:col-span-4 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-3xl relative overflow-hidden group shadow-xl flex flex-col justify-between">
           <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none duration-700">
              <Crown size={180} />
           </div>
           <div>
             <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 shadow-inner">
                   <Crown size={24} />
                </div>
                {isLoading ? (
                  <div className="h-8 w-20 bg-zinc-800 rounded-full animate-pulse" />
                ) : (
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${user?.tier === 'pro' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                     {user?.tier}
                  </span>
                )}
             </div>
             <div className="relative z-10">
                <div className="h-10 flex items-center mb-2">
                  {isLoading ? (
                    <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded-lg" />
                  ) : (
                    <p className="text-3xl font-black text-white uppercase tracking-tight">{user?.tier} Node</p>
                  )}
                </div>
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Access Privilege Level</p>
             </div>
           </div>
           
           {!isLoading && user?.tier === 'free' && (
             <button onClick={handleUpgrade} className="w-full mt-8 px-6 py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl text-[11px] uppercase tracking-[0.2em] font-black transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] relative z-10">
               Elevate Tier
             </button>
           )}
        </div>
      </div>

      {/* Quick Access Terminal */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'Blueprints', sub: 'Templates', icon: Cpu, path: '/templates' },
           { label: 'Sectors', sub: 'Workspaces', icon: Globe, path: '/workspaces' },
           { label: 'Protocols', sub: 'Integrations', icon: Zap, path: '/webhooks' },
           { label: 'Security', sub: 'Vault', icon: Key, path: '/vault' },
         ].map((nav) => (
           <Link key={nav.sub} to={nav.path} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 p-6 rounded-3xl group hover:bg-zinc-800/60 transition-all flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-5">
                 <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 transition-colors shadow-inner">
                    <nav.icon size={20} />
                 </div>
                 <div className="hidden sm:block">
                    <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{nav.label}</span>
                    <span className="block text-sm font-black text-zinc-200 tracking-wide">{nav.sub}</span>
                 </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-950/50 flex items-center justify-center border border-zinc-800/50 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-all">
                <ArrowUpRight size={14} className="text-zinc-600 group-hover:text-indigo-400" />
              </div>
           </Link>
         ))}
      </section>

      {/* Live Activity Feed */}
      <section className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800/60 shadow-xl">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
             </div>
             <div>
                <h3 className="text-lg font-black text-white uppercase tracking-widest">Live Activity Feed</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1">Real-time telemetry stream</p>
             </div>
          </div>
          <span className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-400 uppercase tracking-widest">Last 5 Events</span>
        </div>
        
        {activities.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800/50 rounded-2xl bg-zinc-950/50">
             <Activity size={32} className="text-zinc-700 mb-4 opacity-50" />
             <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">No recent network activity observed</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activities.map((activity, idx) => (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-5 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    activity.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {activity.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">{activity.message}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 bg-zinc-900/80 px-4 py-2 rounded-xl border border-zinc-800/80">
                  <span className="text-[10px] font-black font-mono text-zinc-500 uppercase tracking-widest">{activity.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;