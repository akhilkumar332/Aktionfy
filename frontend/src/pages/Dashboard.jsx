import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, Key, RefreshCw, Copy, Check, 
  ShieldCheck, Zap, ShieldAlert, 
  Terminal, Cpu, Globe, ArrowUpRight, Layers, X, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE } from '../context/SSEContext';
import { useNotify } from '../context/NotificationContext';

const Dashboard = () => {
  const { user, checkAuth } = useAuth();
  const { notify } = useNotify();
  const isMounted = useRef(true);
  const [taskCount, setTaskCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/dashboard');
      if (res.data.success && isMounted.current) {
        setTaskCount(res.data.data.taskCount);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch dashboard data', err.response?.data?.error || err.message);
    }
  }, [notify]);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/system/status');
      if (res.data.success && isMounted.current) {
        setSystemStatus(res.data.data);
      }
    } catch {
      // Fail silently for background telemetry polling to avoid console/UI noise
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchData();
      await fetchSystemStatus();
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
              <span className="text-xs font-bold text-zinc-200 mt-1 tabular-nums font-mono">{systemStatus?.p99_latency_ms || 0}ms</span>
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
              <p className="text-4xl font-bold text-white tabular-nums tracking-tighter">{taskCount}</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Neural Streams</p>
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
              <span className={`pro-badge ${user?.tier === 'pro' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                 {user?.tier}
              </span>
           </div>
           <div className="space-y-1 relative z-10">
              <p className="text-3xl font-bold text-white uppercase tracking-tight">{user?.tier} Node</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Access Privilege Level</p>
           </div>
           {user?.tier === 'free' && (
             <button onClick={handleUpgrade} className="pro-button-primary w-full mt-8 !bg-zinc-100 !text-black hover:!bg-zinc-100 text-[11px] uppercase tracking-[0.2em] font-black">Elevate Tier</button>
           )}
        </div>

        {/* System Load */}
        <div className="pro-card p-8 group">
           <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 shadow-inner">
                 <Zap size={20} className="text-indigo-400/50" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-md">
                 <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Peak_Cap</span>
              </div>
           </div>
           <div className="space-y-4">
              <div>
                 <p className="text-2xl font-bold text-white tabular-nums tracking-tighter">
                   {systemStatus?.bridge_active ? 'NOMINAL_STABLE' : 'UNSTABLE_RECOVERING'}
                 </p>
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-1">System Reliability</p>
              </div>
              <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                 <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min(((systemStatus?.active_sessions || 0) / 50) * 100, 100)}%` }} 
                    className="h-full bg-indigo-600" 
                 />
              </div>
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
    </div>
  );
};

export default Dashboard;