import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, KeyRound, EyeOff, Eye, Check, Clipboard, Ban, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const UserDrawer = ({
  isDrawerOpen,
  setIsDrawerOpen,
  drawerUser,
  showApiKey,
  setShowApiKey,
  copiedKey,
  handleCopyKey,
  handleRolloverKey,
  handleRevokeSessions,
  openOverrideModal
}) => {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!drawerUser) return;
    setLoadingSessions(true);
    try {
      const res = await axios.get(`/api/v1/admin/users/${drawerUser.id}/sessions`);
      if (res.data.success) {
        setSessions(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load user sessions", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [drawerUser]);

  useEffect(() => {
    if (isDrawerOpen && drawerUser) {
      Promise.resolve().then(() => {
        fetchSessions();
      });
    }
  }, [isDrawerOpen, drawerUser, fetchSessions]);

  const handleRevokeSingleSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to revoke this specific session?")) return;
    try {
      const res = await axios.delete(`/api/v1/admin/users/${drawerUser.id}/sessions/${sessionId}`);
      if (res.data.success) {
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to revoke session", err);
    }
  };

  return (
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

              {/* Active Sessions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Active Web Sessions</h4>
                  <button
                    onClick={fetchSessions}
                    disabled={loadingSessions}
                    className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-all cursor-pointer"
                    title="Refresh Sessions"
                  >
                    <RefreshCw size={12} className={loadingSessions ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
                  {loadingSessions && sessions.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold text-center py-4 animate-pulse">Syncing sessions...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold text-center py-4">No active sessions found</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {sessions.map((sess) => (
                        <div key={sess.session_id} className="flex items-center justify-between p-2.5 bg-black/40 border border-zinc-900 rounded-lg hover:border-zinc-800 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white font-mono break-all max-w-[120px] truncate">{sess.ip_address || "Unknown IP"}</span>
                              <span className="text-[9px] text-zinc-550 font-medium">
                                {sess.last_active ? new Date(sess.last_active).toLocaleTimeString() : ""}
                              </span>
                            </div>
                            <p className="text-[8px] text-zinc-500 truncate max-w-[240px]" title={sess.user_agent}>
                              {sess.user_agent || "Unknown Browser"}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevokeSingleSession(sess.session_id)}
                            className="p-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="Revoke Session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
  );
};

export default UserDrawer;
