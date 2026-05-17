import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell 
} from 'recharts';
import { BarChart3, Activity, Zap, Users, ShieldCheck, ArrowRight, Server, Globe, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Insights = () => {
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchInsights = useCallback(async () => {
    try {
      const [insightsRes, trendsRes] = await Promise.all([
          axios.get('/api/v1/admin/insights'),
          axios.get('/api/v1/admin/analytics/trends')
      ]);        
      if (insightsRes.data.success) {
        setData(insightsRes.data.data);
      }
      if (trendsRes.data.success) {
        setTrends(trendsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch insights', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchInsights();
    };
    init();
  }, [fetchInsights]);

  const chartColors = {
    primary: '#d97706', 
    secondary: '#3b82f6', 
    success: '#10b981', 
    grid: 'rgba(255, 255, 255, 0.05)',
    text: '#475569' 
  };

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                <BarChart3 size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Analytics Sector</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            System Insights.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Global Performance Telemetry & Trends</p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={fetchInsights}
             className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
           >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
           <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 px-8 py-5 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Growth Index</span>
                 <span className="text-xs font-black text-blue-400 flex items-center gap-2">
                    <Activity size={10} className="animate-pulse" />
                    POSITIVE_SIGMA
                 </span>
              </div>
           </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {loading && !data ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-40 flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
               <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
               <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-10 animate-pulse"></div>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Synthesizing Data Streams...</p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <MetricCard 
                icon={Zap} 
                label="P99 Latency" 
                value={`${data?.p99_latency || 0}ms`} 
                trend={trends?.tasks_growth || 'STABLE'} 
                color="text-brand-primary"
                bg="bg-brand-primary/10"
              />
              <MetricCard 
                icon={ShieldCheck} 
                label="Protocol Fidelity" 
                value={`${data?.success_rate || 0}%`} 
                trend={trends?.success_growth || 'NOMINAL'} 
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <MetricCard 
                icon={Users} 
                label="Active Actors" 
                value={data?.active_workers || 0} 
                trend={trends?.users_growth || 'EXPANDING'} 
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Tasks Chart */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] p-10 shadow-2xl backdrop-blur-3xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-slate-400">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter">Neural Throughput</h2>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">24-Hour Execution Frequency</p>
                    </div>
                  </div>
                </div>

                <div className="h-72 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.daily_tasks}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke={chartColors.text} 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      />
                      <YAxis 
                        stroke={chartColors.text} 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}
                        itemStyle={{ color: chartColors.primary, fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}
                        labelStyle={{ color: '#64748b', marginBottom: '8px', fontSize: '10px', fontWeight: 700 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke={chartColors.primary} 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                        animationDuration={2000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Status Distribution */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-obsidian-900 border border-white/5 rounded-[3.5rem] p-10 shadow-2xl backdrop-blur-3xl relative overflow-hidden"
              >
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-slate-400">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter">Protocol Integrity</h2>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Execution Result Distribution</p>
                    </div>
                  </div>
                </div>

                <div className="h-72 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'SUCCESS', val: data?.success_rate },
                      { name: 'FAILURE', val: 100 - (data?.success_rate || 0) }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis dataKey="name" stroke={chartColors.text} fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke={chartColors.text} fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1rem' }}
                      />
                      <Bar dataKey="val" radius={[12, 12, 0, 0]} barSize={60}>
                        <Cell fill={chartColors.success} />
                        <Cell fill="#ef4444" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            <div className="pt-8">
              <motion.div 
                whileHover={{ y: -5 }}
                onClick={() => navigate('/admin/workers')}
                className="bg-white/[0.02] border border-white/5 rounded-[3.5rem] p-10 backdrop-blur-3xl cursor-pointer hover:bg-white/[0.04] transition-all flex items-center justify-between group shadow-2xl"
              >
                <div className="flex items-center gap-8">
                  <div className="relative">
                     <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <div className="bg-obsidian-950 p-6 rounded-[2rem] text-blue-400 border border-white/5 group-hover:border-blue-400/30 transition-all relative z-10">
                       <Server size={32} />
                     </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Infrastructure Health</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Globe size={12} className="text-brand-primary" /> Active Multi-Region Cluster Monitoring
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-blue-400 font-black uppercase tracking-widest text-[10px] bg-blue-500/10 px-6 py-3 rounded-2xl border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  Registry Terminal <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

const MetricCard = ({ icon: Icon, label, value, trend, color, bg }) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-obsidian-900 border border-white/5 rounded-[3rem] p-10 backdrop-blur-3xl relative overflow-hidden group shadow-2xl"
  >
    <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
      <Icon size={120} />
    </div>
    <div className="flex items-start justify-between mb-8 relative z-10">
      <div className={`p-4 rounded-2xl ${bg} border border-white/5 group-hover:scale-110 transition-transform`}>
        <Icon size={24} className={color} />
      </div>
      <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
         <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{trend}</span>
         <Activity size={10} className="text-emerald-500 animate-pulse" />
      </div>
    </div>
    <div className="relative z-10">
      <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] mb-2 ml-1">{label}</p>
      <p className="text-4xl font-black text-white tracking-tighter tabular-nums">{value}</p>
    </div>
  </motion.div>
);

export default Insights;