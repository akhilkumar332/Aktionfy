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
    <div className="space-y-6">
      <div className="flex items-center gap-2 ml-1">
         <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Environment Variables</span>
      </div>
      
      {loading ? (
        <div className="py-6 flex flex-col items-center gap-2 opacity-40">
          <Loader2 size={16} className="animate-spin text-zinc-300" />
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Syncing...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {envs.length === 0 ? (
            <div className="col-span-full py-8 px-6 bg-zinc-950 border border-dashed border-zinc-800 rounded-lg text-center">
               <span className="text-[10px] text-zinc-300 font-medium uppercase tracking-tighter opacity-50">Empty variable buffer. Initialize to enable context propagation.</span>
            </div>
          ) : (
            envs.map(env => (
              <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={env.name} 
                className="flex items-center justify-between bg-zinc-950 p-4 rounded-lg border border-zinc-800 group hover:border-zinc-700 transition-all shadow-inner"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-mono font-bold text-zinc-100 flex items-center gap-2">
                     <Key size={10} className="text-zinc-300" /> {env.name}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-400 truncate max-w-[150px] sm:max-w-xs uppercase">{env.value.substring(0, 20)}{env.value.length > 20 ? '...' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  {confirmDelete === env.name ? (
                    <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-md p-0.5">
                      <button 
                        onClick={() => handleDelete(env.name)}
                        className="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                      >
                        <Check size={12} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(null)}
                        className="p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDelete(env.name)}
                      className="p-2 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-md transition-all opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <input 
          type="text" 
          placeholder="KEY_DESIGNATION"
          value={newName}
          onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
          className="pro-input !py-2 !text-[10px] font-mono"
        />
        <input 
          type="text" 
          placeholder="Value String"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          className="pro-input !py-2 !text-[10px] font-mono"
        />
        <button 
          disabled={submitting || !newName || !newValue}
          className="pro-button-primary !py-2 !text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Inject
        </button>
      </form>
    </div>
  );
};

const WorkspaceDetails = ({ workspaceId }) => {
  const [activeTab, setActiveTab] = useState('env');
  
  return (
    <div className="mt-6 pt-6 border-t border-zinc-800">
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-800/50 pb-4 overflow-x-auto custom-scrollbar">
        <button onClick={() => setActiveTab('env')} className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'env' ? 'text-brand-primary bg-brand-primary/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Key size={12} /> Environment
        </button>
        <button onClick={() => setActiveTab('members')} className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'members' ? 'text-brand-primary bg-brand-primary/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Users size={12} /> Members & Roles
        </button>
        <button onClick={() => setActiveTab('activity')} className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'activity' ? 'text-brand-primary bg-brand-primary/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <ActivityIcon size={12} /> Activity Feed
        </button>
        <button onClick={() => setActiveTab('settings')} className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'settings' ? 'text-brand-primary bg-brand-primary/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Settings size={12} /> Settings & Archive
        </button>
      </div>
      
      {activeTab === 'env' && <WorkspaceEnvSection workspaceId={workspaceId} />}
      {activeTab === 'members' && (
        <div className="py-12 text-center bg-zinc-950 border border-zinc-800/50 border-dashed rounded-xl">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={20} className="text-zinc-500" />
          </div>
          <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">Role-Based Access Control</p>
          <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Assign precise permissions (Admin, Editor, Viewer) to team members.</p>
        </div>
      )}
      {activeTab === 'activity' && (
        <div className="py-12 text-center bg-zinc-950 border border-zinc-800/50 border-dashed rounded-xl">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <ActivityIcon size={20} className="text-zinc-500" />
          </div>
          <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">Audit Activity Feed</p>
          <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Trace deployment events, settings modifications, and structural changes.</p>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="py-10 bg-zinc-950 border border-zinc-800/50 border-dashed rounded-xl flex flex-col items-center justify-center relative">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings size={20} className="text-zinc-500" />
          </div>
          <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">Cluster Configuration</p>
          <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed text-center mb-6">Modify cluster metadata, transfer root ownership, or initiate archival protocol.</p>
          
          <div className="w-full max-w-sm flex gap-2 mb-8">
            <input
              id={`rename-input-${workspaceId}`}
              type="text"
              placeholder="New cluster name..."
              className="pro-input flex-1 !py-2 !text-[11px]"
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
              className="pro-button-primary !py-2 !px-4 !text-[10px] uppercase tracking-widest"
            >
              Rename
            </button>
          </div>

          <button className="pro-button-secondary !py-2 !px-5 !text-[9px] uppercase tracking-widest border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2">
            <Trash2 size={12} /> Archive Cluster
          </button>
        </div>
      )}
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
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Compute Clusters</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Virtual isolation sectors and context deployment management.</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
        >
          <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Enlist Cluster</span>
        </button>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="bg-zinc-950 border border-zinc-800 p-8 rounded-lg shadow-lg w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Initialize Cluster</h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">NEW_WORKSPACE_INIT</p>
                </div>
                <button onClick={() => setShowCreateForm(false)} className="text-zinc-400 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cluster Designation</label>
                  <input 
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="ALPHA_SECTOR_01"
                    className="pro-input w-full font-mono !text-xs"
                    autoFocus
                  />
                </div>
                <button 
                  disabled={creating || !newWorkspaceName}
                  className="pro-button-primary w-full !py-3 !text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Authorize Deployment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-4 opacity-50">
            <RefreshCw className="animate-spin text-zinc-300" size={32} />
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Mapping Topology...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center gap-4 pro-card border-dashed bg-zinc-900/10 opacity-50">
            <Globe size={32} className="text-zinc-700" />
            <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest italic">No active compute clusters identified.</span>
          </div>
        ) : (
          workspaces.map((w) => (
            <div 
              key={w.id} 
              className={`pro-card p-6 hover:bg-zinc-900/40 transition-all cursor-pointer group ${expandedId === w.id ? 'ring-1 ring-brand-primary/30 bg-zinc-900/40' : ''}`}
              onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center ${expandedId === w.id ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-indigo-900/20' : 'bg-zinc-950 border-zinc-800 text-zinc-300 group-hover:border-zinc-700'}`}>
                    <Globe size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-tight">{w.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-300 font-mono tracking-tighter uppercase opacity-60">
                         <Command size={10} /> {w.id.substring(0, 13)}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Initialized: {new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  {confirmDeleteWorkspace === w.id ? (
                    <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-md p-0.5 relative z-20">
                      <button 
                        onClick={(e) => handleDeleteWorkspace(e, w.id)}
                        className="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                      >
                        <Check size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteWorkspace(null); }}
                        className="p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteWorkspace(w.id); }}
                      className="p-2 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-md transition-all opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-sm relative z-20"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <motion.div 
                    animate={{ rotate: expandedId === w.id ? 180 : 0 }}
                    className="text-zinc-700 group-hover:text-zinc-400 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === w.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <WorkspaceDetails workspaceId={w.id} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default Workspaces;