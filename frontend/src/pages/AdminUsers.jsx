import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { UserCog, Shield, UserCircle, Search, Activity, Command, Key, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  const fetchUsers = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`/api/v1/admin/users?search=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await fetchUsers(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleUpdate = async (userId, role, tier) => {
    setUpdating(userId);
    try {
      await axios.post('/api/v1/admin/users/update', { user_id: userId, role, tier });
      await fetchUsers(search);
    } catch {
      console.error('Failed to update user');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">
                <Shield size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Governance Module</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Identity Nexus.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Centralized Registry of Neural Actors</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
           <div className="relative group flex-1 sm:w-80">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors z-10">
                 <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Query Identity Registry..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-[2rem] pl-16 pr-8 py-5 text-sm text-white focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner placeholder:text-slate-800 font-mono"
              />
           </div>
           <button 
             onClick={() => fetchUsers(search)}
             className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
           >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-obsidian-900 border border-white/5 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl relative"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-white/[0.02] text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
              <tr>
                <th className="px-10 py-8">Neural Identity</th>
                <th className="px-6 py-8">Access Signature</th>
                <th className="px-6 py-8 text-center">Privilege Level</th>
                <th className="px-6 py-8 text-center">Protocol Tier</th>
                <th className="px-10 py-8 text-right">System Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-40">
                     <div className="flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Syncing Encrypted Identity Buffer...</span>
                     </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-40 text-center">
                     <div className="flex flex-col items-center gap-4">
                        <UserCircle size={48} className="text-slate-800" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Neural registry void. No matching identities identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {users.map((u, i) => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/[0.02] transition-colors group relative"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                          <div className="relative">
                             <div className="absolute inset-0 bg-slate-400/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="bg-obsidian-950 p-4 rounded-[1.5rem] text-slate-600 border border-white/5 group-hover:border-brand-primary/30 transition-all relative z-10">
                               <UserCircle className="w-6 h-6" />
                             </div>
                          </div>
                          <div>
                            <div className="font-black text-white tracking-tight text-base mb-1">{u.email}</div>
                            <div className="text-[9px] text-slate-500 font-mono tracking-tighter opacity-60 uppercase flex items-center gap-2">
                               <Command size={10} /> {u.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-8">
                        <div className="flex items-center gap-3">
                           <Key size={12} className="text-slate-700" />
                           <code className="text-[11px] bg-black/40 px-4 py-2 rounded-xl text-emerald-500/80 font-mono border border-white/5 shadow-inner tracking-widest">
                             {u.api_key.substring(0, 16)}...
                           </code>
                        </div>
                      </td>
                      <td className="px-6 py-8 text-center">
                        {u.role === 'admin' ? (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                            <Shield className="w-3.5 h-3.5" /> root
                          </div>
                        ) : u.role === 'staff' ? (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Activity className="w-3.5 h-3.5" /> staff
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-600 border border-white/5">
                            user
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-8 text-center">
                        {u.tier === 'pro' ? (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-[0_0_20px_rgba(217,119,6,0.15)]">
                            <Sparkles className="w-3.5 h-3.5 fill-brand-primary" /> pro
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-600 border border-white/5">
                            lite
                          </div>
                        )}
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex justify-end gap-4">
                          <button 
                            disabled={updating === u.id || u.role === 'admin'}
                            onClick={() => handleUpdate(u.id, u.role === 'user' ? 'staff' : 'user', u.tier)}
                            className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-blue-400 hover:border-blue-400/40 hover:bg-blue-400/5 transition-all disabled:opacity-20"
                            title={u.role === 'user' ? 'Elevate to Staff' : 'Revert to User'}
                          >
                            <UserCog className="w-5 h-5" />
                          </button>
                          <button 
                            disabled={updating === u.id || u.role === 'admin'}
                            onClick={() => handleUpdate(u.id, u.role, u.tier === 'free' ? 'pro' : 'free')}
                            className="p-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-all shadow-xl disabled:opacity-20"
                            title={u.tier === 'free' ? 'Protocol Upgrade' : 'Protocol Downgrade'}
                          >
                            <Crown className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

const Crown = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

export default AdminUsers;