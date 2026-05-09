import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { Crown, ListChecks, Key, RefreshCw, Copy, Check, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user, checkAuth } = useAuth();
  const [taskCount, setTaskCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/dashboard');
        if (res.data.success) {
          setTaskCount(res.data.data.taskCount);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    fetchData();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(user?.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    if (!confirm('Are you sure you want to rotate your API key? The current key will stop working immediately.')) return;
    
    setRotating(true);
    try {
      await axios.post('/api/rotate-api-key');
      await checkAuth();
      alert('API Key rotated successfully');
    } catch (err) {
      alert('Failed to rotate API Key');
    } finally {
      setRotating(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await axios.post('/api/billing/create-checkout-session');
      if (res.data.success && res.data.data.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err) {
      console.error('Upgrade error', err);
      alert('Failed to initiate upgrade');
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black text-white tracking-tight mb-2"
        >
          Control Center
        </motion.h1>
        <p className="text-slate-400 font-medium tracking-wide uppercase text-[10px] tracking-[0.2em]">Operational Status: <span className="text-emerald-500">Nominal</span></p>
      </header>

      {new URLSearchParams(window.location.search).get('payment') === 'success' && (
        <div className="bg-emerald-500/10 text-emerald-400 p-6 rounded-3xl border border-emerald-500/20 mb-12 font-bold flex items-center gap-4 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          <ShieldCheck size={24} />
          Payment successful! Your neural capacity has been upgraded to PRO.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {/* Tier Card */}
        <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col group hover:bg-white/[0.08] transition-all duration-500 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-accent-orange/10 p-3 rounded-2xl text-accent-orange group-hover:scale-110 transition-transform">
              <Crown size={24} />
            </div>
            <h3 className="font-bold text-slate-300 uppercase tracking-widest text-xs">Node Tier</h3>
          </div>
          <div className="text-4xl font-black text-white uppercase tracking-tighter mb-4 glow-text">
            {user?.tier}
          </div>
          <p className="text-slate-500 text-sm font-medium flex-1">
            {user?.tier === 'free' ? 'Legacy throughput: 2 concurrent streams.' : 'High-capacity throughput: 50 concurrent streams.'}
          </p>
          {user?.tier === 'free' && (
            <button 
              onClick={handleUpgrade}
              className="mt-8 text-xs font-black text-accent-orange uppercase tracking-[0.2em] hover:text-white transition-colors text-left flex items-center gap-2"
            >
              Upgrade Neural Capacity <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Task Stats Card */}
        <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col group hover:bg-white/[0.08] transition-all duration-500 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
              <ListChecks size={24} />
            </div>
            <h3 className="font-bold text-slate-300 uppercase tracking-widest text-xs">Active Streams</h3>
          </div>
          <div className="text-5xl font-black text-white mb-4 tracking-tighter">
            {taskCount}
          </div>
          <p className="text-slate-500 text-sm font-medium flex-1">
            Durable schedules currently active across your global node network.
          </p>
        </div>

        {/* Identity Card */}
        <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col group hover:bg-white/[0.08] transition-all duration-500 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
              <Zap size={24} />
            </div>
            <h3 className="font-bold text-slate-300 uppercase tracking-widest text-xs">System Uptime</h3>
          </div>
          <div className="text-4xl font-black text-white mb-4 tracking-tighter">
            99.99<span className="text-slate-600">%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium flex-1">
            Guaranteed low-latency delivery through our distributed reaper network.
          </p>
        </div>

        {/* API Key Card */}
        <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 shadow-2xl md:col-span-2 lg:col-span-3 flex flex-col backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-orange/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex items-center gap-4 mb-10 relative z-10">
            <div className="bg-white/5 p-3 rounded-2xl text-slate-400">
              <Key size={24} />
            </div>
            <h3 className="font-bold text-slate-300 uppercase tracking-widest text-xs">Neural Access Key</h3>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center relative z-10">
            <div className="flex-1 bg-black/60 text-emerald-400 p-6 rounded-[1.5rem] font-mono text-sm break-all flex items-center justify-between border border-white/5 shadow-inner">
              <code className="tracking-widest">{user?.api_key}</code>
              <button onClick={handleCopy} className="ml-6 p-2 hover:bg-white/5 rounded-xl transition-all">
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button 
              onClick={handleRotate}
              disabled={rotating}
              className="bg-red-500/10 text-red-400 px-10 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-3 justify-center shadow-xl active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              Rotate Key
            </button>
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest relative z-10">
             <ShieldCheck size={12} className="text-red-900" /> Key rotation will instantly terminate all existing client connections.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
