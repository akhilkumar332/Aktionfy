import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  UserCog, UserCircle, Search, RefreshCw, ChevronDown, 
  Lock, Unlock, ShieldAlert, History, Globe, Monitor, Terminal
} from 'lucide-react';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';
import { motion, AnimatePresence } from 'framer-motion';

const AdminUsers = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  
  const [activeTab, setActiveTab] = useState('identities');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  // Login History state
  const [loginHistory, setLoginHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUsers = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`/api/v1/admin/users?search=${encodeURIComponent(query)}`);
      if (res.data.success && isMounted.current) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch users', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify]);

  const fetchLoginHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/v1/admin/login-history?limit=50&offset=0');
      if (res.data.success && isMounted.current) {
        setLoginHistory(res.data.data || []);
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch login history', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) setHistoryLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await fetchUsers(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchLoginHistory();
    }
  }, [activeTab, fetchLoginHistory]);

  // Synchronize dynamic updates in real-time
  useEffect(() => {
    const handleUserUpdate = () => {
      fetchUsers(search);
      if (activeTab === 'history') {
        fetchLoginHistory();
      }
    };
    
    addListener('user_updated', handleUserUpdate);
    return () => {
      removeListener('user_updated', handleUserUpdate);
    };
  }, [addListener, removeListener, fetchUsers, fetchLoginHistory, search, activeTab]);

  const handleUpdate = async (userId, role, tier, isLocked = undefined) => {
    setUpdating(userId);
    try {
      const payload = { user_id: userId, role, tier };
      if (isLocked !== undefined) {
        payload.is_locked = isLocked;
      }
      await axios.post('/api/v1/admin/users/update', payload);
      notify('SUCCESS', 'Identity privileges updated and synchronized');
      await fetchUsers(search);
    } catch (err) {
      notify('ERROR', 'Failed to update user status', err.response?.data?.error || err.message);
    } finally {
      setUpdating(null);
    }
  };

  const parseUserAgent = (ua) => {
    if (!ua) return 'Unknown Client';
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('AktionfyCLI') || ua.includes('Go-http-client') || ua.includes('curl')) return 'Aktionfy Node';
    return ua.split(' ')[0] || 'Web Agent';
  };

  return (
    <>
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Identity Nexus</h1>
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mt-1.5">Manage and audit neural actor privileges and access logs</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Glassmorphic Tabs */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-1 flex gap-1 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('identities')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'identities' 
                  ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Identities
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History size={13} />
              Access Logs
            </button>
          </div>

          {activeTab === 'identities' && (
             <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Query ID or Email..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pro-input pl-9 w-64 !py-2 !text-xs"
                />
             </div>
          )}
          
          <button 
            onClick={activeTab === 'identities' ? () => fetchUsers(search) : fetchLoginHistory}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all pro-focus"
            aria-label="Refresh view"
          >
            <RefreshCw size={16} className={(loading || historyLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'identities' ? (
          <motion.div
            key="identities-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pro-card overflow-hidden"
          >
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="pro-table-header border-b border-zinc-800">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Neural Actor</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Signature</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Privilege</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Tier</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Account Status</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-32">
                         <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Actors...</span>
                         </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-32 text-center">
                         <div className="flex flex-col items-center gap-2 opacity-40">
                            <UserCircle size={32} className="text-zinc-300" />
                            <span className="text-xs font-medium text-zinc-400 italic">No matching identities identified.</span>
                         </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="pro-table-row group transition-colors duration-250">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/50 transition-all">
                               <UserCircle size={18} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-zinc-100 truncate">{u.email}</span>
                              <span className="text-[9px] text-zinc-500 font-mono tracking-tighter uppercase truncate font-bold">{u.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-[10px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 text-emerald-500 font-mono tracking-wider">
                              {u.api_key}
                            </code>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.role === 'admin' ? (
                            <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                          ) : u.role === 'staff' ? (
                            <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                          ) : (
                            <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {u.tier === 'pro' ? (
                            <span className="pro-badge bg-indigo-600/10 border-brand-primary/20 text-indigo-400">Pro Node</span>
                          ) : u.tier === 'plus' ? (
                            <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Plus</span>
                          ) : (
                            <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">Lite</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {u.is_locked ? (
                            <span className="pro-badge bg-red-500/10 border-red-500/20 text-red-400 flex items-center gap-1.5 w-fit">
                              <ShieldAlert size={10} />
                              Locked
                            </span>
                          ) : (
                            <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 w-fit">
                              <Unlock size={10} className="text-emerald-500" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            {/* Staff Role Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin'}
                              onClick={() => handleUpdate(u.id, u.role === 'user' ? 'staff' : 'user', u.tier)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-20 pro-focus"
                              title="Toggle Staff Role"
                            >
                              <UserCog size={13} />
                            </button>

                            {/* Tier Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin'}
                              onClick={() => handleUpdate(u.id, u.role, u.tier === 'pro' ? 'free' : 'pro')}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 transition-all disabled:opacity-20 pro-focus"
                              title="Toggle Tier"
                            >
                              <ChevronDown size={13} />
                            </button>

                            {/* Account Lock Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin'}
                              onClick={() => handleUpdate(u.id, u.role, u.tier, !u.is_locked)}
                              className={`p-2 border rounded-xl transition-all disabled:opacity-20 pro-focus ${
                                u.is_locked 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-white' 
                                  : 'bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-900/40 hover:text-white'
                              }`}
                              title={u.is_locked ? "Unlock Account" : "Lock Account"}
                            >
                              {u.is_locked ? <Unlock size={13} /> : <Lock size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pro-card overflow-hidden"
          >
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="pro-table-header border-b border-zinc-800">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Actor Account</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Network IP Address</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Client Signature</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {historyLoading && loginHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-32">
                         <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Access Ledgers...</span>
                         </div>
                      </td>
                    </tr>
                  ) : loginHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-32 text-center">
                         <div className="flex flex-col items-center gap-2 opacity-40">
                            <History size={32} className="text-zinc-800 mx-auto mb-2" />
                            <span className="text-xs font-medium text-zinc-400 italic">No access events logged.</span>
                         </div>
                      </td>
                    </tr>
                  ) : (
                    loginHistory.map((lh) => (
                      <tr key={lh.id.String || Math.random().toString()} className="pro-table-row hover:bg-zinc-900/10">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                               <Terminal size={14} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-200">{lh.user_email.String || 'Autonomous Node'}</span>
                              <span className="text-[9px] text-zinc-500 font-mono">{lh.user_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-300 font-semibold">
                          {lh.login_time.Time ? new Date(lh.login_time.Time).toLocaleString() : 'Unknown Cycle'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <Globe size={12} className="text-zinc-600" />
                            {lh.ip_address.String || 'Local Socket'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                            <Monitor size={12} className="text-zinc-600" />
                            {parseUserAgent(lh.user_agent.String)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {lh.status === 'success' ? (
                            <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Granted</span>
                          ) : (
                            <span className="pro-badge bg-red-500/10 border-red-500/20 text-red-400">Denied</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminUsers;