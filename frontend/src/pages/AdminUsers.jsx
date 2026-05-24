import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  UserCog, UserCircle, Search, RefreshCw, ChevronDown, 
  Lock, Unlock, ShieldAlert, History, Globe, Monitor, Terminal,
  UserPlus, KeyRound, Ban, TrendingUp, Send, Trash2, UserCheck, ShieldCheck, X
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

  // Pre-registration/Invitations state
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteTier, setInviteTier] = useState('free');

  // Overrides Modal state
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [overrideMaxTasksLimit, setOverrideMaxTasksLimit] = useState(0);
  const [overrideRateLimitOverride, setOverrideRateLimitOverride] = useState(0);
  const [submittingOverride, setSubmittingOverride] = useState(false);

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

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await axios.get('/api/v1/admin/invitations');
      if (res.data.success && isMounted.current) {
        setInvitations(res.data.data || []);
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch invitations', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) setInvitationsLoading(false);
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
    } else if (activeTab === 'invitations') {
      fetchInvitations();
    }
  }, [activeTab, fetchLoginHistory, fetchInvitations]);

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

  useEffect(() => {
    const handleInvitationsUpdate = () => {
      fetchInvitations();
    };
    
    addListener('invitations_updated', handleInvitationsUpdate);
    return () => {
      removeListener('invitations_updated', handleInvitationsUpdate);
    };
  }, [addListener, removeListener, fetchInvitations]);

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

  const handleImpersonate = async (userId) => {
    try {
      const res = await axios.post('/api/v1/admin/users/impersonate', { user_id: userId });
      if (res.data.success) {
        notify('SUCCESS', 'Impersonation session established successfully');
        window.location.href = '/dashboard';
      }
    } catch (err) {
      notify('ERROR', 'Failed to initiate impersonation', err.response?.data?.error || err.message);
    }
  };

  const handleRevokeSessions = async (userId) => {
    if (!window.confirm("CAUTION: This will immediately revoke ALL active web/CLI sessions and MCP bridge links, forcing an instant logout for this user. Continue?")) return;
    try {
      const res = await axios.post('/api/v1/admin/users/revoke-sessions', { user_id: userId });
      if (res.data.success) {
        notify('SUCCESS', 'All active sessions and bridge heartbeats terminated instantly');
      }
    } catch (err) {
      notify('ERROR', 'Failed to revoke sessions', err.response?.data?.error || err.message);
    }
  };

  const handleRolloverKey = async (userId) => {
    if (!window.confirm("WARNING: This will instantly regenerate the user's API Key and break any active CLI integrations or MCP bridge agents using the old key. Continue?")) return;
    try {
      const res = await axios.post('/api/v1/admin/users/rollover-key', { user_id: userId });
      if (res.data.success) {
        notify('SUCCESS', 'API Key successfully rotated and broadcasted');
        await fetchUsers(search);
      }
    } catch (err) {
      notify('ERROR', 'Failed to rotate API Key', err.response?.data?.error || err.message);
    }
  };

  const handleCreateInvitation = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/v1/admin/invitations', {
        email: inviteEmail,
        role: inviteRole,
        tier: inviteTier
      });
      if (res.data.success) {
        notify('SUCCESS', `Pre-registered identity invitation created`);
        setInviteEmail('');
        setInviteRole('user');
        setInviteTier('free');
        setIsInviteModalOpen(false);
        await fetchInvitations();
      }
    } catch (err) {
      notify('ERROR', 'Failed to pre-register invitation', err.response?.data?.error || err.message);
    }
  };

  const handleDeleteInvitation = async (inviteId) => {
    if (!window.confirm("Are you sure you want to delete and revoke this invitation link?")) return;
    try {
      const res = await axios.delete(`/api/v1/admin/invitations/${inviteId}`);
      if (res.data.success) {
        notify('SUCCESS', 'Invitation revoked successfully');
        await fetchInvitations();
      }
    } catch (err) {
      notify('ERROR', 'Failed to revoke invitation', err.response?.data?.error || err.message);
    }
  };

  const openOverrideModal = (user) => {
    setSelectedUser(user);
    setOverrideMaxTasksLimit(user.max_tasks_limit?.Valid ? user.max_tasks_limit.Int32 : -1);
    setOverrideRateLimitOverride(user.rate_limit_override?.Valid ? user.rate_limit_override.Int32 : -1);
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverrides = async (e) => {
    e.preventDefault();
    setSubmittingOverride(true);
    try {
      const payload = {
        user_id: selectedUser.id,
        max_tasks_limit: overrideMaxTasksLimit,
        rate_limit_override: overrideRateLimitOverride
      };
      await axios.post('/api/v1/admin/users/update', payload);
      notify('SUCCESS', 'Custom quota overrides successfully committed');
      setIsOverrideModalOpen(false);
      await fetchUsers(search);
    } catch (err) {
      notify('ERROR', 'Failed to update custom overrides', err.response?.data?.error || err.message);
    } finally {
      setSubmittingOverride(false);
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
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'invitations' 
                  ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus size={13} />
              Pre-Registrations
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

          {activeTab === 'invitations' && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] cursor-pointer"
            >
              <UserPlus size={13} />
              Pre-Register Identity
            </button>
          )}
          
          <button 
            onClick={activeTab === 'identities' ? () => fetchUsers(search) : activeTab === 'invitations' ? fetchInvitations : fetchLoginHistory}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all pro-focus"
            aria-label="Refresh view"
          >
            <RefreshCw size={16} className={(loading || historyLoading || invitationsLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'identities' && (
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
                              <span className="text-sm font-bold text-zinc-100 truncate">{u.email?.String || u.email || 'Anonymous'}</span>
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
                          {u.role?.String === 'admin' || u.role === 'admin' ? (
                            <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                          ) : u.role?.String === 'staff' || u.role === 'staff' ? (
                            <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                          ) : (
                            <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div>
                              {u.tier?.String === 'pro' || u.tier === 'pro' ? (
                                <span className="pro-badge bg-indigo-600/10 border-brand-primary/20 text-indigo-400">Pro Node</span>
                              ) : u.tier?.String === 'plus' || u.tier === 'plus' ? (
                                <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Plus</span>
                              ) : (
                                <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">Lite</span>
                              )}
                            </div>
                            {((u.max_tasks_limit?.Int32 > 0 || u.max_tasks_limit?.Valid) || (u.rate_limit_override?.Int32 > 0 || u.rate_limit_override?.Valid)) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {u.max_tasks_limit?.Valid && u.max_tasks_limit.Int32 >= 0 && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-indigo-950/40 border border-indigo-500/30 text-indigo-400 rounded uppercase font-black">
                                    Tasks: {u.max_tasks_limit.Int32}
                                  </span>
                                )}
                                {u.rate_limit_override?.Valid && u.rate_limit_override.Int32 >= 0 && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded uppercase font-black">
                                    Rate: {u.rate_limit_override.Int32}/m
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.is_locked?.Bool || u.is_locked ? (
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
                            {/* Impersonate User */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                              onClick={() => handleImpersonate(u.id)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-400 transition-all disabled:opacity-20 pro-focus"
                              title="Impersonate Identity"
                            >
                              <UserCheck size={13} />
                            </button>

                            {/* Quota Overrides */}
                            <button 
                              onClick={() => openOverrideModal(u)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-400 transition-all pro-focus"
                              title="Quota Overrides"
                            >
                              <TrendingUp size={13} />
                            </button>

                            {/* Staff Role Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                              onClick={() => handleUpdate(u.id, (u.role === 'user' || u.role?.String === 'user') ? 'staff' : 'user', u.tier?.String || u.tier)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-20 pro-focus"
                              title="Toggle Staff Role"
                            >
                              <UserCog size={13} />
                            </button>

                            {/* Tier Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                              onClick={() => handleUpdate(u.id, u.role?.String || u.role, (u.tier === 'pro' || u.tier?.String === 'pro') ? 'free' : 'pro')}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 transition-all disabled:opacity-20 pro-focus"
                              title="Toggle Tier"
                            >
                              <ChevronDown size={13} />
                            </button>

                            {/* API Key Rollover */}
                            <button 
                              onClick={() => handleRolloverKey(u.id)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-cyan-400 transition-all pro-focus"
                              title="Rollover API Key"
                            >
                              <KeyRound size={13} />
                            </button>

                            {/* Invalidate / Revoke Sessions */}
                            <button 
                              onClick={() => handleRevokeSessions(u.id)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-400 transition-all pro-focus"
                              title="Revoke Sessions"
                            >
                              <Ban size={13} />
                            </button>

                            {/* Account Lock Toggle */}
                            <button 
                              disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                              onClick={() => handleUpdate(u.id, u.role?.String || u.role, u.tier?.String || u.tier, !(u.is_locked?.Bool || u.is_locked))}
                              className={`p-2 border rounded-xl transition-all disabled:opacity-20 pro-focus ${
                                (u.is_locked?.Bool || u.is_locked)
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-white' 
                                  : 'bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-900/40 hover:text-white'
                              }`}
                              title={(u.is_locked?.Bool || u.is_locked) ? "Unlock Account" : "Lock Account"}
                            >
                              {(u.is_locked?.Bool || u.is_locked) ? <Unlock size={13} /> : <Lock size={13} />}
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
        )}

        {activeTab === 'invitations' && (
          <motion.div
            key="invitations-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pro-card overflow-hidden"
          >
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="pro-table-header border-b border-zinc-800">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Pre-Registered Email</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Assigned Privilege</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Assigned Tier</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Invitation Token</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Expires At</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {invitationsLoading && invitations.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-32">
                         <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Invitations...</span>
                         </div>
                      </td>
                    </tr>
                  ) : invitations.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-32 text-center">
                         <div className="flex flex-col items-center gap-2 opacity-40">
                            <UserPlus size={32} className="text-zinc-600" />
                            <span className="text-xs font-medium text-zinc-400 italic">No pending invitations pre-registered.</span>
                         </div>
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => (
                      <tr key={inv.id?.String || inv.id || Math.random().toString()} className="pro-table-row hover:bg-zinc-900/10">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-zinc-200">{inv.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          {inv.role === 'admin' ? (
                            <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                          ) : inv.role === 'staff' ? (
                            <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                          ) : (
                            <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {inv.tier === 'pro' ? (
                            <span className="pro-badge bg-indigo-600/10 border-brand-primary/20 text-indigo-400">Pro Node</span>
                          ) : inv.tier === 'plus' ? (
                            <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Plus</span>
                          ) : (
                            <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">Lite</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-[10px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 text-indigo-400 font-mono tracking-wider">
                            {inv.invite_token}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-400 font-medium">
                          {inv.expires_at?.Time ? new Date(inv.expires_at.Time).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteInvitation(inv.id?.String || inv.id)}
                            className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-400 transition-all pro-focus"
                            title="Delete Invitation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
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
                      <tr key={lh.id?.String || lh.id || Math.random().toString()} className="pro-table-row hover:bg-zinc-900/10">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                               <Terminal size={14} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-zinc-200">{lh.user_email?.String || lh.user_email || 'Autonomous Node'}</span>
                              <span className="text-[9px] text-zinc-500 font-mono">{lh.user_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-300 font-semibold">
                          {lh.login_time?.Time ? new Date(lh.login_time.Time).toLocaleString() : 'Unknown Cycle'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <Globe size={12} className="text-zinc-600" />
                            {lh.ip_address?.String || lh.ip_address || 'Local Socket'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                            <Monitor size={12} className="text-zinc-600" />
                            {parseUserAgent(lh.user_agent?.String || lh.user_agent)}
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

      {/* Quota Overrides Modal */}
      <AnimatePresence>
        {isOverrideModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOverrideModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden z-10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={18} className="text-brand-primary" />
                  <div>
                    <h3 className="text-md font-bold text-white leading-tight">Quota Overrides</h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">{selectedUser.email?.String || selectedUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOverrideModalOpen(false)} 
                  className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-all pro-focus cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveOverrides} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="override-max-tasks" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Max Tasks Count Limit</label>
                  <input 
                    id="override-max-tasks"
                    type="number" 
                    value={overrideMaxTasksLimit} 
                    onChange={(e) => setOverrideMaxTasksLimit(parseInt(e.target.value))}
                    placeholder="Enter limit, e.g. 50 (-1 for Tier Default)" 
                    className="pro-input w-full"
                    required
                  />
                  <p className="text-[9px] text-zinc-500 italic">Enter -1 to revert to default tier limit (Lite: 3, Plus: 10, Pro: Unlimited)</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="override-rate-limit" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rate Limit (Requests/Min)</label>
                  <input 
                    id="override-rate-limit"
                    type="number" 
                    value={overrideRateLimitOverride} 
                    onChange={(e) => setOverrideRateLimitOverride(parseInt(e.target.value))}
                    placeholder="Enter limit, e.g. 60 (-1 for Tier Default)" 
                    className="pro-input w-full"
                    required
                  />
                  <p className="text-[9px] text-zinc-500 italic">Enter -1 to revert to default tier rate limits (Lite: 60/m, Plus: 120/m, Pro: 300/m)</p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsOverrideModalOpen(false)}
                    className="flex-1 py-2 px-4 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOverride}
                    className="flex-1 py-2 px-4 bg-brand-primary border border-brand-primary/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 cursor-pointer"
                  >
                    {submittingOverride ? 'Saving...' : 'Apply Overrides'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pre-Register / Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden z-10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <UserPlus size={18} className="text-brand-primary" />
                  <div>
                    <h3 className="text-md font-bold text-white leading-tight">Pre-Register Identity</h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">Secure pre-registration invitation nexus</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInviteModalOpen(false)} 
                  className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-all pro-focus cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="invite-email" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Target Actor Email</label>
                  <input 
                    id="invite-email"
                    type="email" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="actor@domain.com" 
                    className="pro-input w-full"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="invite-role" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigned Privilege (Role)</label>
                  <div className="relative">
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="pro-input w-full appearance-none pr-8 bg-zinc-950 text-white"
                    >
                      <option value="user">User</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Root Admin</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="invite-tier" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigned Tier</label>
                  <div className="relative">
                    <select
                      id="invite-tier"
                      value={inviteTier}
                      onChange={(e) => setInviteTier(e.target.value)}
                      className="pro-input w-full appearance-none pr-8 bg-zinc-950 text-white"
                    >
                      <option value="free">Lite (Free)</option>
                      <option value="plus">Plus</option>
                      <option value="pro">Pro Node</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="flex-1 py-2 px-4 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-brand-primary border border-brand-primary/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] cursor-pointer"
                  >
                    Generate Invite
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminUsers;