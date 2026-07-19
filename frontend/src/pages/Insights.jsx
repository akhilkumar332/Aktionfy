import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell 
} from 'recharts';
import { BarChart3, Activity, Zap, Users, ShieldCheck, ArrowRight, Server, Globe, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';
import { SkeletonMetric, SkeletonChart } from '../components/shared/AdvancedSkeleton';

const Insights = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [hourlyHeatmap, setHourlyHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const navigate = useNavigate();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const [insightsRes, trendsRes, heatmapRes] = await Promise.all([
          axios.get('/api/v1/admin/insights'),
          axios.get('/api/v1/admin/analytics/trends'),
          axios.get('/api/v1/admin/analytics/hourly-heatmap')
      ]);        
      if (isMountedRef.current && insightsRes.data.success) {
        setData(insightsRes.data.data);
      }
      if (isMountedRef.current && trendsRes.data.success) {
        setTrends(trendsRes.data.data);
      }
      if (isMountedRef.current && heatmapRes.data.success) {
        setHourlyHeatmap(heatmapRes.data.data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        notify('ERROR', 'Failed to fetch insights', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchInsights();
    });
    
    // Live polling for real-time metric updates
    const interval = setInterval(() => {
      fetchInsights();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchInsights();
    };
    addListener('task_executed', handleUpdate);
    addListener('worker_updated', handleUpdate);
    return () => {
      removeListener('task_executed', handleUpdate);
      removeListener('worker_updated', handleUpdate);
    };
  }, [addListener, removeListener, fetchInsights]);

  const chartColors = {
    primary: '#6366f1', 
    secondary: '#8b5cf6', 
    success: '#10b981', 
    grid: 'rgba(255, 255, 255, 0.05)',
    text: '#475569' 
  };

  const getTrendDisplay = (trend) => {
    if (!trend || trend === '0%') return 'STABLE';
    if (trend === '+100%') return 'NEW';
    return trend;
  };

  const p99Latency = data?.p99_latency === 0 ? '---' : `${data?.p99_latency || 0}ms`;

  return (
    <div className="space-y-8 pb-12">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 shadow-inner">
                <BarChart3 size={16} />
             </div>
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Analytics Sector</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tighter"
          >
            System Insights
          </motion.h1>
          <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 ml-1">Global Performance Telemetry & Trends</p>
        </div>
        
        <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner">
           <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 px-4 py-3 rounded-xl shadow-inner">
             <select 
               value={dateRange}
               onChange={(e) => setDateRange(e.target.value)}
               className="bg-transparent text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] focus:outline-none border-none cursor-pointer px-2 appearance-none"
             >
               <option value="7d">Last 7 Days</option>
               <option value="30d">Last 30 Days</option>
               <option value="90d">Last 90 Days</option>
             </select>
           </div>
           <button 
             onClick={fetchInsights}
             className="p-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700"
           >
             <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-400' : ''} />
           </button>
           {trends?.tasks_growth && trends.tasks_growth !== '0%' && (
             <div className="flex items-center gap-6 bg-zinc-950 border border-zinc-800/80 px-6 py-3 rounded-xl shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:bg-indigo-500/20 transition-colors"></div>
                <div className="flex flex-col relative z-10">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Growth Index</span>
                   <span className={`text-xs font-black flex items-center gap-2 mt-0.5 ${trends.tasks_growth.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <Activity size={10} className="animate-pulse" />
                      {trends.tasks_growth.startsWith('+') ? 'ACCELERATING' : 'REDUCING'}
                   </span>
                </div>
             </div>
           )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {loading && !data ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-12"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map(i => <SkeletonMetric key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[1, 2].map(i => <SkeletonChart key={i} />)}
            </div>
            <SkeletonChart />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <MetricCard 
                icon={Zap} 
                label="P99 Latency" 
                value={p99Latency} 
                trend={getTrendDisplay(trends?.tasks_growth)} 
                color="text-brand-primary"
                bg="bg-brand-primary/10"
              />
              <MetricCard 
                icon={ShieldCheck} 
                label="Protocol Fidelity" 
                value={`${data?.success_rate || 0}%`} 
                trend={getTrendDisplay(trends?.success_growth)} 
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <MetricCard 
                icon={Users} 
                label="Active Actors" 
                value={data?.active_workers || 0} 
                trend={getTrendDisplay(trends?.users_growth)} 
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <MetricCard 
                icon={Server} 
                label="AI Token Cost" 
                value={data?.ai_token_cost ? `$${data.ai_token_cost.toFixed(2)}` : '$0.00'} 
                trend="+15%" 
                color="text-purple-400"
                bg="bg-purple-500/10"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Tasks Chart */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-10 rounded-[2rem] shadow-xl relative overflow-hidden group hover:bg-zinc-900/60 transition-colors"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
                
                <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">Neural Throughput</h2>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">24-Hour Execution Frequency</p>
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
                className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-10 rounded-[2rem] shadow-xl relative overflow-hidden group hover:bg-zinc-900/60 transition-colors"
              >
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
                
                <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">Protocol Integrity</h2>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Execution Result Distribution</p>
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

            {/* Hourly Heatmap Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-10 rounded-[2rem] shadow-xl relative overflow-hidden group hover:bg-zinc-900/60 transition-colors"
            >
              <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/10 blur-[60px] rounded-full -translate-y-1/2 -translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
              
              <div className="flex items-center justify-between mb-12 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 text-purple-400 shadow-inner group-hover:scale-110 transition-transform">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">Hourly Chrono-Flux</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Execution load per hour over the last 24 hours</p>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyHeatmap}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="label" stroke={chartColors.text} fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke={chartColors.text} fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1rem' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '12px' }}
                      labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '10px' }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32}>
                      {hourlyHeatmap.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#6366f1' : 'rgba(255, 255, 255, 0.05)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <div className="pt-8">
              <motion.div 
                whileHover={{ y: -5 }}
                onClick={() => navigate('/admin/workers')}
                className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-10 rounded-[2rem] shadow-xl relative overflow-hidden group cursor-pointer hover:bg-zinc-900/60 transition-all flex items-center justify-between"
              >
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/4 group-hover:bg-blue-500/20 transition-colors"></div>
                <div className="flex items-center gap-8 relative z-10">
                  <div className="relative">
                     <div className="bg-zinc-950 p-6 rounded-[2rem] text-blue-400 border border-zinc-800/80 group-hover:border-blue-400/50 transition-all shadow-inner group-hover:scale-110">
                       <Server size={40} />
                     </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-md">Infrastructure Health</h2>
                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Globe size={14} className="text-blue-400" /> Active Multi-Region Cluster Monitoring
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-blue-400 font-black uppercase tracking-[0.2em] text-[11px] bg-zinc-950 px-8 py-4 rounded-2xl border border-zinc-800/80 group-hover:border-blue-500/50 group-hover:bg-blue-500/10 transition-all shadow-inner relative z-10">
                  Registry Terminal <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, trend, color, bg }) => {
  const isPositive = trend?.startsWith('+') || trend === 'NEW';
  const isNegative = trend?.startsWith('-');
  const trendTextColor = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-zinc-500';
  const trendIconColor = isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-zinc-600';
  const trendBg = isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : isNegative ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-950 border-zinc-800/80';
  const glowColor = bg.includes('brand') ? 'bg-indigo-500/20' : bg.includes('emerald') ? 'bg-emerald-500/20' : bg.includes('blue') ? 'bg-blue-500/20' : 'bg-purple-500/20';

  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] p-8 relative overflow-hidden group shadow-xl hover:bg-zinc-900/60 hover:border-zinc-700 transition-all"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${glowColor} blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-1000`}></div>
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity duration-700 pointer-events-none group-hover:scale-110">
        <Icon size={120} />
      </div>
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className={`p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-inner group-hover:scale-110 transition-transform`}>
          <Icon size={24} className={color} />
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-inner ${trendBg}`}>
           <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${trendTextColor}`}>{trend}</span>
           <Activity size={12} className={`${trendIconColor} ${isPositive || isNegative ? 'animate-pulse' : ''}`} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.3em] mb-2 ml-1">{label}</p>
        <p className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">{value}</p>
      </div>
    </motion.div>
  );
};

export default Insights;