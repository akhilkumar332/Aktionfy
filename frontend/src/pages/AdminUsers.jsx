import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  UserPlus, RefreshCw, Search, X, TrendingUp, ChevronDown, Activity, History, Info, UserCheck, UserCog, Ban, Unlock, Lock, ShieldAlert, KeyRound
} from 'lucide-react';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';
import { motion, AnimatePresence } from 'framer-motion';

import UserTable from './admin_users/UserTable';
import PreRegistrations from './admin_users/PreRegistrations';
import AuditLogsViewer from './admin_users/AuditLogsViewer';
import AccessLogsViewer from './admin_users/AccessLogsViewer';
import UserDrawer from './admin_users/UserDrawer';

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
    return { color: 'text-zinc-400 bg-zinc-800/50 border-zinc-700/30', icon: Info };
  };

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
            <UserTable 
              users={users}
              loading={loading}
              updating={updating}
              handleImpersonate={handleImpersonate}
              openDrawer={openDrawer}
              openOverrideModal={openOverrideModal}
              handleUpdate={handleUpdate}
              handleRevokeSessions={handleRevokeSessions}
            />
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
            <PreRegistrations 
              invitations={invitations}
              invitationsLoading={invitationsLoading}
              handleDeleteInvitation={handleDeleteInvitation}
            />
          </motion.div>
        )}

        {activeTab === 'audit' && (
          <motion.div
            key="audit-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AuditLogsViewer 
              auditLoading={auditLoading}
              auditLimit={auditLimit}
              setAuditLimit={setAuditLimit}
              filteredAuditLogs={filteredAuditLogs}
              expandedLogId={expandedLogId}
              setExpandedLogId={setExpandedLogId}
              resolveAuditVisuals={resolveAuditVisuals}
            />
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
            <AccessLogsViewer 
              loginHistory={loginHistory}
              historyLoading={historyLoading}
              parseUserAgent={parseUserAgent}
            />
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
      <UserDrawer 
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        drawerUser={drawerUser}
        showApiKey={showApiKey}
        setShowApiKey={setShowApiKey}
        copiedKey={copiedKey}
        handleCopyKey={handleCopyKey}
        handleRolloverKey={handleRolloverKey}
        handleRevokeSessions={handleRevokeSessions}
        openOverrideModal={openOverrideModal}
      />
    </>
  );
};

export default AdminUsers;