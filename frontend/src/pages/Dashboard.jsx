import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, Key, RefreshCw, Copy, Check, 
  ShieldCheck, Zap, ArrowRight, Bell, ShieldAlert, 
  Terminal, Cpu, Globe, Server, Activity, ArrowUpRight
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
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center">
                <Activity size={16} className="text-brand-primary" />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Environment</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-black text-white tracking-tighter"
          >
            Command Hub.
          </motion.h1>
        </div>

        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.3 }}
           className="flex items-center gap-6 bg-white/5 border border-white/10 px-8 py-4 rounded-3xl backdrop-blur-xl"
        >
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Status</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                 All Systems Nominal
              </span>
           </div>
           <div className="h-8 w-px bg-white/10"></div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Latency</span>
              <span className="text-xs font-bold text-white font-mono">14ms</span>
           </div>
        </motion.div>
      </header>

      {/* Pending Approvals Section */}
      <AnimatePresence>
        {pendingApprovals.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/5 border border-red-500/10 rounded-[3rem] p-10 backdrop-blur-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
               
               <h2 className="text-xl font-black text-white uppercase tracking-widest mb-10 flex items-center gap-3">
                 <ShieldAlert className="text-red-500 animate-pulse" size={24} />
                 Manual Resolution Required
               </h2>

               <div className="grid grid-cols-1 gap-4">
                 {pendingApprovals.map((approval) => (
                   <motion.div 
                     key={approval.task_id}
                     layout
                     initial={{ x: -20, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     className="bg-black/40 border border-white/5 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:border-red-500/30 group"
                   >
                     <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform">
                           <Terminal size={24} />
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-lg mb-1">{approval.task_name}</h4>
                          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Execution-ID: {approval.execution_id?.slice(0, 13)}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4 w-full md:w-auto">
                       <button 
                         onClick={() => handleDeny(approval.task_id)}
                         className="flex-1 md:flex-none px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white border border-white/5 transition-all"
                       >
                         Abort
                       </button>
                       <button 
                         onClick={() => handleApprove(approval.task_id)}
                         className="flex-1 md:flex-none bg-red-500 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(239,68,68,0.2)] hover:brightness-110 active:scale-95 transition-all"
                       >
                         Authorize Execution
                       </button>
                     </div>
                   </motion.div>
                 ))}
               </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Tier Intelligence Card */}
        <div className="glass-card p-10 rounded-[3rem] flex flex-col group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary border border-brand-primary/20 group-hover:rotate-12 transition-transform">
              <Crown size={24} />
            </div>
            <h3 className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Node Privilege</h3>
          </div>
          
          <div className="flex items-baseline gap-2 mb-4">
             <span className="text-5xl font-black text-white uppercase tracking-tighter glow-text">{user?.tier}</span>
             <span className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_10px_#d97706]"></span>
          </div>

          <p className="text-slate-400 text-sm font-medium leading-relaxed flex-1">
            {user?.tier === 'free' 
              ? 'Standard throughput. 2 concurrent neural streams active.' 
              : 'Unrestricted throughput. Up to 50 concurrent neural streams enabled.'}
          </p>

          {user?.tier === 'free' && (
            <button 
              onClick={handleUpgrade}
              className="mt-10 shimmer-button w-full bg-brand-primary text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              Elevate Node Tier <Zap size={14} />
            </button>
          )}
        </div>

        {/* Neural Streams Card */}
        <Link to="/tasks" className="glass-card p-10 rounded-[3rem] flex flex-col group relative overflow-hidden transition-all hover:border-brand-primary/30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-400 border border-blue-500/20 group-hover:-rotate-12 transition-transform">
              <Activity size={24} />
            </div>
            <h3 className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Neural Streams</h3>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
             <span className="text-6xl font-black text-white tracking-tighter">{taskCount}</span>
             <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Active</span>
          </div>

          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">
            Persistent orchestration threads currently executing across the distributed reaper network.
          </p>

          <div className="mt-auto flex items-center justify-between text-blue-400">
             <span className="text-[10px] font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">Orchestrate Now</span>
             <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </Link>

        {/* Reaper Network Card */}
        <div className="glass-card p-10 rounded-[3rem] flex flex-col group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Server size={24} />
            </div>
            <h3 className="font-black text-slate-500 uppercase tracking-[0.2em] text-[10px]">Infrastructure</h3>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
             <span className="text-5xl font-black text-white tracking-tighter italic">Reaper</span>
             <span className="text-emerald-500 font-black uppercase text-[10px] tracking-widest px-2 py-0.5 bg-emerald-500/10 rounded-lg">Online</span>
          </div>

          <p className="text-slate-400 text-sm font-medium leading-relaxed flex-1">
            Edge-compute nodes optimized for high-frequency task delivery and state synchronization.
          </p>

          <div className="mt-10 flex gap-2">
             <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Health</span>
                <span className="text-xs font-bold text-white uppercase tracking-tighter">Peak</span>
             </div>
             <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Uptime</span>
                <span className="text-xs font-bold text-white uppercase tracking-tighter">99.99%</span>
             </div>
          </div>
        </div>

        {/* API Identity Command Card */}
        <div className="glass-card p-10 rounded-[3.5rem] md:col-span-2 lg:col-span-3 flex flex-col relative overflow-hidden">
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-brand-primary/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-white/5 p-3 rounded-2xl text-slate-400 border border-white/10">
                <Key size={24} />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-[0.2em] text-xs">Neural Access Key</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Private Authentication Token</p>
              </div>
            </div>
            
            <button 
              onClick={handleRotate}
              disabled={rotating}
              className="hidden md:flex bg-red-500/10 text-red-400 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border border-red-500/20 hover:bg-red-500/20 transition-all items-center gap-3 shadow-xl active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              Rotate Token
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center relative z-10">
            <div className="flex-1 bg-obsidian-950/80 text-emerald-400 p-8 rounded-[2rem] font-mono text-sm break-all flex items-center justify-between border border-white/5 shadow-inner backdrop-blur-3xl group">
              <code className="tracking-[0.2em] opacity-80 group-hover:opacity-100 transition-opacity">{user?.api_key}</code>
              <button onClick={handleCopy} className="ml-8 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all text-emerald-500 shadow-2xl">
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            
            <button 
              onClick={handleRotate}
              disabled={rotating}
              className="md:hidden bg-red-500/10 text-red-400 px-8 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              Rotate Token
            </button>
          </div>
          
          <div className="mt-8 flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest relative z-10 bg-white/[0.02] w-fit px-4 py-2 rounded-lg border border-white/5">
             <ShieldCheck size={14} className="text-red-900" /> 
             <span>Security Alert: Rotation will instantly terminate all active client integrations.</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Terminal */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Intelligence', sub: 'Templates', icon: Cpu, path: '/templates' },
           { label: 'Geography', sub: 'Workspaces', icon: Globe, path: '/workspaces' },
           { label: 'Logistics', sub: 'Integrations', icon: Zap, path: '/webhooks' },
           { label: 'Security', sub: 'Vault', icon: Key, path: '/vault' },
         ].map((nav, i) => (
           <Link key={i} to={nav.path} className="glass-card p-6 rounded-[2rem] group hover:bg-white/[0.08] transition-all flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-brand-primary transition-colors">
                    <nav.icon size={20} />
                 </div>
                 <div>
                    <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">{nav.label}</span>
                    <span className="block text-sm font-black text-white tracking-tight">{nav.sub}</span>
                 </div>
              </div>
              <ArrowUpRight size={18} className="text-slate-700 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
           </Link>
         ))}
      </section>

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 20, scale: 0.9, filter: 'blur(10px)' }}
              className={`pointer-events-auto px-8 py-5 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border flex items-center gap-5 backdrop-blur-3xl min-w-[350px] ${
                toast.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {toast.type === 'success' ? <Zap size={18} /> : <Bell size={18} />}
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-0.5">{toast.type === 'success' ? 'Protocol Success' : 'Terminal Alert'}</span>
                <span className="block text-xs font-bold uppercase tracking-widest leading-tight">{toast.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;