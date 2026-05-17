import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, Key, RefreshCw, Copy, Check, 
  ShieldCheck, Zap, Bell, ShieldAlert, 
  Terminal, Cpu, Globe, ArrowUpRight, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSSE } from '../hooks/useSSE';

const Dashboard = () => {
  const { user, checkAuth } = useAuth();
  const [taskCount, setTaskCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/dashboard');
      if (res.data.success) {
        setTaskCount(res.data.data.taskCount);
      }
    } catch {
      console.error('Failed to fetch dashboard data');
    }
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  useSSE(useCallback((event) => {
    if (event.event_type === 'task_executed') {
      try {
        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        addToast(
          `Task ${payload.task_name || payload.task_id.slice(0, 8)} executed: ${payload.status}`, 
          payload.status === 'success' ? 'success' : 'error'
        );
        fetchData();
      } catch (e) {
        console.error('Error parsing task_executed payload', e);
      }
    }

    if (event.event_type === 'task_status_changed') {
      addToast('Task status updated');
      fetchData();
    }

    if (event.event_type === 'approval_required') {
      try {
        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        setPendingApprovals(prev => {
          if (prev.find(a => a.task_id === payload.task_id)) return prev;
          return [...prev, payload];
        });
        addToast(`Manual Approval Required: ${payload.task_name}`, 'error');
      } catch (e) {
        console.error('Error parsing approval_required payload', e);
      }
    }
  }, [addToast, fetchData]));

  const handleApprove = async (taskId) => {
    try {
      await axios.post(`/api/v1/tasks/${taskId}/approve`);
      setPendingApprovals(prev => prev.filter(a => a.task_id !== taskId));
      addToast('Task approved and resumed');
      fetchData();
    } catch {
      addToast('Failed to approve task', 'error');
    }
  };

  const handleDeny = async (taskId) => {
    try {
      await axios.post(`/api/v1/tasks/${taskId}/deny`);
      setPendingApprovals(prev => prev.filter(a => a.task_id !== taskId));
      addToast('Task execution denied');
      fetchData();
    } catch {
      addToast('Failed to deny task', 'error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(user?.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    if (!confirm('Are you sure you want to rotate your API key? The current key will stop working immediately.')) return;
    setRotating(true);
    try {
      await axios.post('/api/v1/rotate-api-key');
      await checkAuth();
      addToast('API Key rotated successfully');
    } catch {
      addToast('Failed to rotate API Key', 'error');
    } finally {
      setRotating(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await axios.post('/api/v1/billing/create-checkout-session');
      if (res.data.success && res.data.data.url) {
        window.location.assign(res.data.data.url);
      }
    } catch {
      addToast('Failed to initiate upgrade', 'error');
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Hub</h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">Global orchestration overview and system health.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-lg shadow-sm">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Cluster Status</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 mt-1">
                 <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                 Nominal
              </span>
           </div>
           <div className="h-6 w-px bg-zinc-800 mx-2"></div>
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Latency</span>
              <span className="text-xs font-bold text-zinc-200 mt-1 tabular-nums font-mono">14ms</span>
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
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-0.5">AUTH_REQ // {approval.execution_id?.slice(0, 13)}</p>
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
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 group-hover:text-brand-primary transition-colors shadow-inner">
                 <Layers size={20} />
              </div>
              <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
           </div>
           <div className="space-y-1">
              <p className="text-4xl font-bold text-white tabular-nums tracking-tighter">{taskCount}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Neural Streams</p>
           </div>
           <p className="text-xs text-zinc-500 mt-6 leading-relaxed opacity-80">Persistent orchestration threads executing across the cluster.</p>
        </Link>

        {/* Tier Status */}
        <div className="pro-card p-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
              <Crown size={100} />
           </div>
           <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 shadow-inner">
                 <Crown size={20} className="text-amber-500/50" />
              </div>
              <span className={`pro-badge ${user?.tier === 'pro' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                 {user?.tier}
              </span>
           </div>
           <div className="space-y-1 relative z-10">
              <p className="text-3xl font-bold text-white uppercase tracking-tight">{user?.tier} Node</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Access Privilege Level</p>
           </div>
           {user?.tier === 'free' && (
             <button onClick={handleUpgrade} className="pro-button-primary w-full mt-8 !bg-zinc-100 !text-black hover:!bg-white text-[11px] uppercase tracking-[0.2em] font-black">Elevate Tier</button>
           )}
        </div>

        {/* System Load */}
        <div className="pro-card p-8 group">
           <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 shadow-inner">
                 <Zap size={20} className="text-brand-primary/50" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-md">
                 <div className="w-1 h-1 rounded-full bg-brand-primary"></div>
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Peak_Cap</span>
              </div>
           </div>
           <div className="space-y-4">
              <div>
                 <p className="text-2xl font-bold text-white tabular-nums tracking-tighter">99.9%</p>
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mt-1">Infrastructure Uptime</p>
              </div>
              <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                 <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-brand-primary" />
              </div>
           </div>
        </div>

        {/* API Authentication Interface */}
        <div className="pro-card p-8 md:col-span-2 lg:col-span-3 space-y-8 relative overflow-hidden">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-500 shadow-inner">
                    <Key size={20} />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Neural Access Key</h3>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Private Protocol Token</p>
                 </div>
              </div>
              <button 
                onClick={handleRotate} 
                disabled={rotating}
                className="pro-button-secondary !py-2 !px-6 !border-zinc-800 text-[11px] uppercase tracking-widest flex items-center gap-2"
              >
                <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} /> Rotate Signature
              </button>
           </div>

           <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex items-center justify-between shadow-inner group/key">
                 <code className="text-sm font-mono text-emerald-500 tracking-[0.1em] opacity-80 truncate select-all">{user?.api_key}</code>
                 <button onClick={handleCopy} className="ml-4 p-2.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-500 hover:text-white transition-all shadow-xl">
                   {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                 </button>
              </div>
           </div>

           <div className="flex items-center gap-3 bg-red-500/[0.02] border border-red-500/10 px-5 py-3 rounded-lg w-fit">
              <ShieldCheck size={14} className="text-red-900" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest italic">Security Notice: Key rotation will invalidate all active client integrations.</span>
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
                 <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-brand-primary transition-colors">
                    <nav.icon size={18} />
                 </div>
                 <div className="hidden sm:block">
                    <span className="block text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{nav.label}</span>
                    <span className="block text-sm font-bold text-zinc-200 tracking-tight">{nav.sub}</span>
                 </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-800 group-hover:text-zinc-500 transition-colors" />
           </Link>
         ))}
      </section>

      {/* Notification Toast Stream */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className={`pointer-events-auto px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-4 min-w-[320px] backdrop-blur-md ${
                toast.type === 'success' 
                  ? 'bg-zinc-900/90 border-emerald-500/20 text-zinc-100' 
                  : 'bg-zinc-900/90 border-red-500/20 text-zinc-100'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {toast.type === 'success' ? <Zap size={14} /> : <Bell size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.15em] opacity-40 leading-none mb-1.5">{toast.type === 'success' ? 'Protocol Sync' : 'Terminal Alert'}</span>
                <span className="block text-xs font-semibold tracking-tight truncate">{toast.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;