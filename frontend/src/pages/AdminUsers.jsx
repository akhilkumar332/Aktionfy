import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  UserCog, UserCircle, Search, RefreshCw, ChevronDown, 
  Lock, Unlock, ShieldAlert, History, Globe, Monitor, Terminal,
  UserPlus, KeyRound, Ban, TrendingUp, Send, Trash2, UserCheck, ShieldCheck, X,
  Activity, Eye, EyeOff, Clipboard, Check, ChevronRight, Settings, Info
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

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditLimit, setAuditLimit] = useState(100);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Side Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchUsers = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`/api/v1/admin/users?search=${encodeURIComponent(query)}`);
      if (res.data.success && isMounted.current) {
        setUsers(res.data.data || []);
        // Refresh the drawer user if it's open
        if (drawerUser) {
          const updated = (res.data.data || []).find(u => u.id === drawerUser.id);
          if (updated) setDrawerUser(updated);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch users', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify, drawerUser]);

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

  const fetchAuditLogs = useCallback(async (limit = 100) => {
    setAuditLoading(true);
    try {
      const res = await axios.get(`/api/v1/admin/audit-logs?limit=${limit}`);
      if (res.data.success && isMounted.current) {
        setAuditLogs(res.data.data || []);
      }
    } catch (err) {
      if (isMounted.current) {
        notify('ERROR', 'Failed to fetch audit logs', err.response?.data?.error || err.message);
      }
    } finally {
      if (isMounted.current) setAuditLoading(false);
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
    } else if (activeTab === 'audit') {
      fetchAuditLogs(auditLimit);
    }
  }, [activeTab, fetchLoginHistory, fetchInvitations, fetchAuditLogs, auditLimit]);

  // Synchronize dynamic updates in real-time
  useEffect(() => {
    const handleUserUpdate = () => {
      fetchUsers(search);
      if (activeTab === 'history') {
        fetchLoginHistory();
      } else if (activeTab === 'audit') {
        fetchAuditLogs(auditLimit);
      }
    };
    
    addListener('user_updated', handleUserUpdate);
    return () => {
      removeListener('user_updated', handleUserUpdate);
    };
  }, [addListener, removeListener, fetchUsers, fetchLoginHistory, fetchAuditLogs, search, activeTab, auditLimit]);

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

  const openDrawer = (user) => {
    setDrawerUser(user);
    setShowApiKey(false);
    setCopiedKey(false);
    setIsDrawerOpen(true);
  };

  const handleCopyKey = (keyString) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const parseUserAgent = (ua) => {
    if (!ua) return 'Unknown Client';
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('AktionfyCLI') || ua.includes('Go-http-client') || ua.includes('curl')) return 'Aktionfy Node';
    return ua.split(' ')[0] || 'Web Agent';
  };

  // Helper to resolve highly aesthetic category details for audit logs
  const resolveAuditVisuals = (action) => {
    const act = action.toLowerCase();
    if (act.includes('impersonate')) {
      return { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: UserCheck };
    }
    if (act.includes('role') || act.includes('tier') || act.includes('privilege')) {
      return { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: UserCog };
    }
    if (act.includes('quota') || act.includes('override') || act.includes('limit')) {
      return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: TrendingUp };
    }
    if (act.includes('lock') || act.includes('quarantine')) {
      return { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: ShieldAlert };
    }
    if (act.includes('revoke') || act.includes('session')) {
      return { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Ban };
    }
    if (act.includes('create') || act.includes('signup') || act.includes('invite')) {
      return { color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: UserPlus };
    }
    return { color: 'text-zinc-400 bg-zinc-800/50 border-zinc-700/30', icon: Settings };
  };

  // Filter audit logs based on search query
  const filteredAuditLogs = auditLogs.filter(log => {
    const q = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.user_id && log.user_id.toLowerCase().includes(q)) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(q)) ||
      (log.resource_id && log.resource_id.toLowerCase().includes(q))
    );
  });

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
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'audit' 
                  ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700/50' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity size={13} />
              System Audits
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

          {activeTab === 'audit' && (
             <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Query Action, Target ID..." 
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
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
            onClick={
              activeTab === 'identities' ? () => fetchUsers(search) : 
              activeTab === 'invitations' ? fetchInvitations : 
              activeTab === 'audit' ? () => fetchAuditLogs(auditLimit) :
              fetchLoginHistory
            }
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all pro-focus"
            aria-label="Refresh view"
          >
            <RefreshCw size={16} className={(loading || historyLoading || invitationsLoading || auditLoading) ? 'animate-spin' : ''} />
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
                              {u.api_key ? `${u.api_key.substring(0, 8)}...` : 'N/A'}
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
                            {((u.max_tasks_limit?.Valid && u.max_tasks_limit.Int32 >= 0) || (u.rate_limit_override?.Valid && u.rate_limit_override.Int32 >= 0)) && (
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

                            {/* Open Security Settings Drawer */}
                            <button 
                              onClick={() => openDrawer(u)}
                              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-brand-primary transition-all pro-focus"
                              title="Security Credentials Drawer"
                            >
                              <KeyRound size={13} />
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

        {activeTab === 'audit' && (
          <motion.div
            key="audit-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="pro-card p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-zinc-400" />
                <span className="text-xs text-zinc-400 font-medium">Displaying up to <strong className="text-zinc-200">{auditLimit}</strong> recent system audit actions. Use search to filter surgically.</span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="audit-limit-select" className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Limit:</label>
                <select
                  id="audit-limit-select"
                  value={auditLimit}
                  onChange={(e) => setAuditLimit(parseInt(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 font-mono focus:border-brand-primary outline-none"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
              </div>
            </div>

            <div className="pro-card divide-y divide-zinc-800/60 overflow-hidden">
              {auditLoading && auditLogs.length === 0 ? (
                <div className="py-32 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing System Activity Ledgers...</span>
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="py-32 text-center flex flex-col items-center gap-2">
                  <Activity size={32} className="text-zinc-700 animate-pulse" />
                  <span className="text-xs font-medium text-zinc-500 italic">No matching activities found.</span>
                </div>
              ) : (
                filteredAuditLogs.map((log) => {
                  const visuals = resolveAuditVisuals(log.action);
                  const Icon = visuals.icon;
                  const isExpanded = expandedLogId === log.id;
                  
                  return (
                    <div key={log.id} className="p-5 hover:bg-zinc-900/10 transition-colors flex flex-col gap-3 group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${visuals.color}`}>
                            <Icon size={15} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-zinc-300 font-mono">{log.action}</span>
                              <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md font-bold">{log.resource_type}</span>
                            </div>
                            <div className="mt-1 text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>Actor: <strong className="text-zinc-200">{log.user_id || 'Autonomous Engine'}</strong></span>
                              {log.resource_id && (
                                <>
                                  <span className="text-zinc-600 font-bold">•</span>
                                  <span>Target: <strong className="text-zinc-300 font-mono">{log.resource_id}</strong></span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0 text-right">
                          <span className="text-[10px] text-zinc-500 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                          {Object.keys(log.metadata || {}).length > 0 && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-all cursor-pointer"
                              title="Toggle metadata payload"
                            >
                              <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90 text-brand-primary' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && log.metadata && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-1"
                          >
                            <pre className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg text-[10px] font-mono text-zinc-300 overflow-x-auto custom-scrollbar leading-relaxed">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
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

      {/* Sliding Security Credentials Drawer */}
      <AnimatePresence>
        {isDrawerOpen && drawerUser && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full bg-zinc-950 border-l border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.85)] z-10 flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-brand-primary">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-white leading-tight">Credentials & Credentials</h3>
                    <p className="text-[10px] text-zinc-500 font-mono tracking-tighter uppercase mt-0.5">{drawerUser.email?.String || drawerUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-all pro-focus cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* User Context Info Card */}
                <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Identity Context</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">Assigned Privilege</span>
                      <span className="text-xs font-bold text-white mt-0.5">
                        {drawerUser.role?.String || drawerUser.role}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">Operational Tier</span>
                      <span className="text-xs font-bold text-brand-primary mt-0.5 uppercase">
                        {drawerUser.tier?.String || drawerUser.tier}
                      </span>
                    </div>
                  </div>
                </div>

                {/* API Key Panel */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Connection Signatures</h4>
                  <div className="p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Access API Token</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-all cursor-pointer"
                          title={showApiKey ? 'Hide Token' : 'Reveal Token'}
                        >
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleCopyKey(drawerUser.api_key)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-all cursor-pointer"
                          title="Copy to clipboard"
                        >
                          {copiedKey ? <Check size={14} className="text-emerald-500 animate-pulse" /> : <Clipboard size={14} />}
                        </button>
                      </div>
                    </div>
                    
                    <code className="block p-3 bg-zinc-950 border border-zinc-900 rounded-lg text-xs font-mono text-zinc-300 break-all select-all font-semibold">
                      {showApiKey ? drawerUser.api_key : 'akt_••••••••••••••••••••••••••••••••'}
                    </code>

                    <div className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-900/10 p-3 rounded-lg border border-zinc-800/40 space-y-1">
                      <div className="font-bold text-zinc-400 uppercase tracking-wider">How to authenticate:</div>
                      <div>• CLI Client: Set local environment `AKTIONFY_API_KEY` configuration.</div>
                      <div>• REST Nodes: Attach standard header `X-API-Key` on requests.</div>
                    </div>
                  </div>
                </div>

                {/* Quotas & Limits Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Node Limit Status</h4>
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        openOverrideModal(drawerUser);
                      }}
                      className="text-[9px] font-black uppercase tracking-wider text-indigo-400 hover:text-white transition-all cursor-pointer"
                    >
                      Configure Overrides
                    </button>
                  </div>
                  <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-4">
                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">
                        <span>Max Task Limit capacity</span>
                        <span className="font-mono text-white font-bold">
                          {drawerUser.max_tasks_limit?.Valid && drawerUser.max_tasks_limit.Int32 >= 0 ? `${drawerUser.max_tasks_limit.Int32} (Override)` : 'Tier Default'}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                        <div className="bg-brand-primary h-full rounded-full" style={{ width: drawerUser.max_tasks_limit?.Valid && drawerUser.max_tasks_limit.Int32 > 0 ? '70%' : '20%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">
                        <span>Request Rate Limit Bucket</span>
                        <span className="font-mono text-white font-bold">
                          {drawerUser.rate_limit_override?.Valid && drawerUser.rate_limit_override.Int32 >= 0 ? `${drawerUser.rate_limit_override.Int32}/min (Override)` : 'Tier Default'}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: drawerUser.rate_limit_override?.Valid && drawerUser.rate_limit_override.Int32 > 0 ? '80%' : '35%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations & Revocations */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Security Operations</h4>
                  <div className="p-4 bg-red-950/10 border border-red-500/10 rounded-xl space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleRolloverKey(drawerUser.id)}
                        className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <KeyRound size={14} className="text-cyan-400" />
                        Rollover API Key
                      </button>
                      <p className="text-[9px] text-zinc-500 italic text-center">Regenerates key instantly, invalidating any active CLI agents.</p>
                    </div>

                    <div className="flex flex-col gap-1.5 border-t border-zinc-800/60 pt-4">
                      <button
                        onClick={() => handleRevokeSessions(drawerUser.id)}
                        className="w-full py-2.5 px-4 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Ban size={14} className="text-red-400 animate-pulse" />
                        Quarantine Sessions
                      </button>
                      <p className="text-[9px] text-zinc-500 italic text-center">Instantly revokes all active browser sessions and sever SSE/MCP links.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/10 flex items-center gap-3">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all pro-focus cursor-pointer"
                >
                  Dismiss Drawer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminUsers;