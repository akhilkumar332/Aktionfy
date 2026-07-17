import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Trash2, Plus, Loader2, X, Command, Zap, RefreshCw, Key, Check, Settings, Users, Activity as ActivityIcon } from 'lucide-react';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const WorkspaceEnvSection = ({ workspaceId }) => {
  const { notify } = useNotify();
  const isMounted = useRef(true);
  const [envs, setEnvs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchEnvs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/workspaces/${workspaceId}/env`);
      if (res.data.success && isMounted.current) {
        setEnvs(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch env vars', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [workspaceId, notify]);

  useEffect(() => {
    const init = async () => {
      await fetchEnvs();
    };
    init();
  }, [fetchEnvs]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName || !newValue) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/v1/workspaces/${workspaceId}/env`, {
        name: newName,
        value: newValue
      });
      if (isMounted.current) {
        setNewName('');
        setNewValue('');
      }
      notify('SUCCESS', 'Environment variable injected successfully');
      fetchEnvs();
    } catch (err) {
      notify('ERROR', 'Failed to add environment variable', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleDelete = async (name) => {
    try {
      await axios.delete(`/api/v1/workspaces/${workspaceId}/env/${name}`);
      notify('SUCCESS', 'Environment variable terminated');
      fetchEnvs();
    } catch (err) {
      notify('ERROR', 'Failed to delete environment variable', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6 bg-zinc-950/40 backdrop-blur-xl border border-zinc-800/50 p-6 rounded-2xl shadow-inner">
      <div className="flex items-center gap-3">
         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.8)]"></div>
         <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Environment Variables</span>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center gap-3 opacity-50">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] animate-pulse">Syncing Keys...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {envs.length === 0 ? (
            <div className="col-span-full py-10 px-6 bg-zinc-900/30 border border-dashed border-zinc-700/50 rounded-xl flex flex-col items-center gap-3">
               <Key size={24} className="text-zinc-600 mb-1" />
               <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.1em] opacity-80 text-center">Empty variable buffer.<br/>Initialize to enable context propagation.</span>
            </div>
          ) : (
            envs.map(env => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={env.name} 
                className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80 group hover:border-indigo-500/40 hover:bg-zinc-900 transition-all shadow-md"
              >
                <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                  <span className="text-[11px] font-mono font-black text-zinc-200 flex items-center gap-2.5">
                     <Key size={12} className="text-indigo-400 opacity-80" /> {env.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[150px] sm:max-w-xs">{env.value.substring(0, 25)}{env.value.length > 25 ? '...' : ''}</span>
                </div>
                <div className="flex items-center shrink-0">
                  {confirmDelete === env.name ? (
                    <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/50 rounded-xl p-1 shadow-inner">
                      <button 
                        onClick={() => handleDelete(env.name)}
                        className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                        title="Confirm Terminate"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(null)}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-800"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDelete(env.name)}
                      className="p-2.5 bg-zinc-950/50 text-zinc-500 border border-zinc-800/50 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 shadow-sm"
                      title="Purge Variable"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-4 mt-4 border-t border-zinc-800/60">
        <div className="sm:col-span-5 relative group">
          <input 
            type="text" 
            placeholder="KEY_DESIGNATION"
            value={newName}
            onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-4 py-3 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
          />
        </div>
        <div className="sm:col-span-5 relative group">
          <input 
            type="text" 
            placeholder="Value String"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-4 py-3 rounded-xl text-[11px] font-mono tracking-wide placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
          />
        </div>
        <button 
          disabled={submitting || !newName || !newValue}
          className="sm:col-span-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg disabled:shadow-none"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Inject
        </button>
      </form>
    </div>
  );
};

const WorkspaceDetails = ({ workspaceId }) => {
  const [activeTab, setActiveTab] = useState('env');
  
  return (
    <div className="mt-8 pt-8 border-t border-zinc-800/60">
      <div className="flex items-center gap-2 mb-8 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/60 overflow-x-auto custom-scrollbar shadow-inner w-fit">
        <button onClick={() => setActiveTab('env')} className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'env' ? 'text-white bg-zinc-800 shadow-md border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <Key size={14} className={activeTab === 'env' ? 'text-indigo-400' : ''} /> Environment
        </button>
        <button onClick={() => setActiveTab('members')} className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'members' ? 'text-white bg-zinc-800 shadow-md border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <Users size={14} className={activeTab === 'members' ? 'text-indigo-400' : ''} /> Members & Roles
        </button>
        <button onClick={() => setActiveTab('activity')} className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'activity' ? 'text-white bg-zinc-800 shadow-md border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <ActivityIcon size={14} className={activeTab === 'activity' ? 'text-indigo-400' : ''} /> Activity Feed
        </button>
        <button onClick={() => setActiveTab('settings')} className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'settings' ? 'text-white bg-zinc-800 shadow-md border border-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <Settings size={14} className={activeTab === 'settings' ? 'text-indigo-400' : ''} /> Settings & Archive
        </button>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'env' && <WorkspaceEnvSection workspaceId={workspaceId} />}
          {activeTab === 'members' && (
            <div className="py-16 text-center bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 border-dashed rounded-3xl">
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Users size={28} className="text-zinc-500" />
              </div>
              <p className="text-[11px] text-zinc-300 font-black uppercase tracking-[0.2em]">Role-Based Access Control</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] mt-3 max-w-xs mx-auto leading-relaxed">Assign precise permissions (Admin, Editor, Viewer) to team members.</p>
            </div>
          )}
          {activeTab === 'activity' && (
            <div className="py-16 text-center bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 border-dashed rounded-3xl">
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ActivityIcon size={28} className="text-zinc-500" />
              </div>
              <p className="text-[11px] text-zinc-300 font-black uppercase tracking-[0.2em]">Audit Activity Feed</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] mt-3 max-w-xs mx-auto leading-relaxed">Trace deployment events, settings modifications, and structural changes.</p>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="py-12 bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 rounded-3xl flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-20"></div>
              
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
                <Settings size={28} className="text-zinc-400" />
              </div>
              <p className="text-[11px] text-white font-black uppercase tracking-[0.2em]">Cluster Configuration</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] mt-3 max-w-sm mx-auto leading-relaxed text-center mb-10">Modify cluster metadata, transfer root ownership, or initiate archival protocol.</p>
              
              <div className="w-full max-w-md flex flex-col sm:flex-row gap-3 mb-10 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/60">
                <input
                  id={`rename-input-${workspaceId}`}
                  type="text"
                  placeholder="New cluster designation..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
                />
                <button 
                  onClick={async () => {
                    const input = document.getElementById(`rename-input-${workspaceId}`);
                    if (!input.value) return;
                    try {
                      await axios.patch(`/api/v1/workspaces/${workspaceId}`, { name: input.value });
                      window.dispatchEvent(new CustomEvent('workspace-renamed'));
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg whitespace-nowrap"
                >
                  Rename
                </button>
              </div>

              <div className="w-full max-w-md border-t border-zinc-800/60 pt-8 flex justify-center">
                <button className="flex items-center justify-center gap-3 w-full bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 text-red-500 hover:text-red-400 px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-sm">
                  <Trash2 size={16} /> Initiate Archival Protocol
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const Workspaces = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteWorkspace, setConfirmDeleteWorkspace] = useState(null);

  const handleDeleteWorkspace = async (e, workspaceId) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/v1/workspaces/${workspaceId}`);
      notify('SUCCESS', 'Compute cluster decommissioned successfully');
      fetchWorkspaces();
    } catch (err) {
      notify('ERROR', 'Failed to decommission compute cluster', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setConfirmDeleteWorkspace(null);
    }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/workspaces');
      if (res.data.success && isMounted.current) {
        setWorkspaces(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch workspaces', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchWorkspaces();
    };
    addListener('workspace_updated', handleUpdate);
    return () => removeListener('workspace_updated', handleUpdate);
  }, [addListener, removeListener, fetchWorkspaces]);

  useEffect(() => {
    const init = async () => {
      await fetchWorkspaces();
    };
    init();
  }, [fetchWorkspaces]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName) return;
    setCreating(true);
    try {
      const res = await axios.post('/api/v1/workspaces', { name: newWorkspaceName });
      if (res.data.success) {
        if (isMounted.current) {
          setNewWorkspaceName('');
          setShowCreateForm(false);
        }
        notify('SUCCESS', 'Compute cluster enlisted successfully');
        fetchWorkspaces();
      }
    } catch (err) {
      notify('ERROR', 'Failed to create workspace', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setCreating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight"
          >
            Compute Clusters
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
          >
            Virtual isolation sectors and context deployment management
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
          >
            <Plus size={16} /> Enlist Cluster
          </button>
        </motion.div>
      </header>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950/90 backdrop-blur-3xl border border-indigo-500/30 p-8 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-md relative z-10 overflow-hidden ring-1 ring-white/5"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"></div>
              
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Initialize Cluster</h2>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mt-1">NEW_WORKSPACE_INIT</p>
                </div>
                <button onClick={() => setShowCreateForm(false)} className="text-zinc-500 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 p-2 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-8">
                <div className="space-y-3 relative group">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Cluster Designation</label>
                  <input 
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="ALPHA_SECTOR_01"
                    className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-5 py-4 rounded-2xl text-sm font-mono font-bold uppercase tracking-widest placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
                    autoFocus
                  />
                </div>
                <button 
                  disabled={creating || !newWorkspaceName}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg disabled:shadow-none"
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                  Authorize Deployment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-5 opacity-60">
            <RefreshCw className="animate-spin text-indigo-500" size={40} />
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] animate-pulse">Mapping Topology...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center gap-5 bg-zinc-900/20 border border-dashed border-zinc-800/60 rounded-3xl opacity-60">
            <Globe size={48} className="text-zinc-700" />
            <span className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.2em] text-center">No active compute clusters identified.<br/>Initialize a sector to begin.</span>
          </div>
        ) : (
          workspaces.map((w) => (
            <div 
              key={w.id} 
              className={`bg-zinc-900/40 backdrop-blur-xl border p-6 md:p-8 rounded-3xl transition-all cursor-pointer group shadow-xl ${expandedId === w.id ? 'border-indigo-500/50 bg-zinc-900/80 shadow-[0_0_30px_rgba(79,70,229,0.1)]' : 'border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/60'}`}
              onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl border transition-all flex items-center justify-center shrink-0 shadow-inner ${expandedId === w.id ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'bg-zinc-950 border-zinc-800 text-zinc-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30'}`}>
                    <Globe size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">{w.name}</h2>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono tracking-widest uppercase bg-zinc-950/50 px-2 py-1 rounded-md border border-zinc-800/50">
                         <Command size={10} className="opacity-70" /> {w.id.substring(0, 13)}
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Initialized: {new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                  {confirmDeleteWorkspace === w.id ? (
                    <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/50 rounded-xl p-1 shadow-inner relative z-20">
                      <button 
                        onClick={(e) => handleDeleteWorkspace(e, w.id)}
                        className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                        title="Confirm Terminate"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteWorkspace(null); }}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-800"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteWorkspace(w.id); }}
                      className="p-3 bg-zinc-950 text-zinc-500 border border-zinc-800/80 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 shadow-md relative z-20"
                      title="Decommission Cluster"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <motion.div 
                    animate={{ rotate: expandedId === w.id ? 180 : 0 }}
                    className="p-2 text-zinc-600 group-hover:text-zinc-300 transition-colors cursor-pointer bg-zinc-900/50 rounded-xl"
                    onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  >
                    <ChevronDown size={24} />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === w.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="pt-2">
                      <WorkspaceDetails workspaceId={w.id} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Workspaces;