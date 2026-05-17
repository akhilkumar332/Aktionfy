import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Trash2, Plus, Loader2, X, Activity, Command, Zap } from 'lucide-react';

const WorkspaceEnvSection = ({ workspaceId }) => {
  const [envs, setEnvs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEnvs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/workspaces/${workspaceId}/env`);
      if (res.data.success) {
        setEnvs(res.data.data || []);
      }
    } catch {
      console.error('Failed to fetch env vars');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

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
      setNewName('');
      setNewValue('');
      fetchEnvs();
    } catch {
      console.error('Failed to add environment variable');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Terminate variable ${name}?`)) return;
    try {
      await axios.delete(`/api/v1/workspaces/${workspaceId}/env/${name}`);
      fetchEnvs();
    } catch {
      console.error('Failed to delete environment variable');
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-white/5 space-y-8">
      <div className="flex items-center gap-3 ml-2">
         <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div>
         <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Environment Neural Links</h3>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center gap-4">
          <Loader2 size={24} className="animate-spin text-brand-primary/50" />
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest animate-pulse">Syncing Variables...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {envs.length === 0 ? (
            <div className="col-span-full py-10 px-8 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl text-center">
               <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic opacity-50">Empty variable buffer. Initialize to enable context propagation.</span>
            </div>
          ) : (
            envs.map(env => (
              <motion.div 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={env.name} 
                className="flex items-center justify-between bg-black/60 p-5 rounded-[2rem] border border-white/5 group hover:border-brand-primary/20 transition-all"
              >
                <div className="flex flex-col gap-1.5 ml-2">
                  <span className="text-xs font-mono font-black text-white tracking-widest flex items-center gap-2">
                     <Command size={10} className="text-brand-primary opacity-50" /> {env.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 truncate max-w-[150px] sm:max-w-xs uppercase tracking-tighter">VALUE: {env.value.substring(0, 20)}{env.value.length > 20 ? '...' : ''}</span>
                </div>
                <button 
                  onClick={() => handleDelete(env.name)}
                  className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <input 
          type="text" 
          placeholder="IDENTITY_KEY"
          value={newName}
          onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
          className="bg-black/80 border border-white/5 rounded-2xl px-6 py-5 text-xs text-white font-mono focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
        />
        <input 
          type="text" 
          placeholder="Value String"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          className="bg-black/80 border border-white/5 rounded-2xl px-6 py-5 text-xs text-white font-mono focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
        />
        <button 
          disabled={submitting || !newName || !newValue}
          className="shimmer-button bg-brand-primary text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Inject Link
        </button>
      </form>
    </div>
  );
};

const Workspaces = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/workspaces');
      if (res.data.success) setWorkspaces(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
        setNewWorkspaceName('');
        setShowCreateForm(false);
        fetchWorkspaces();
      }
    } catch (err) {
      console.error('Failed to create workspace', err);
    } finally {
      setCreating(false);
    }
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
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Globe size={16} />
             </div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Infrastructure Sector</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Compute Clusters.
          </motion.h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Virtual Isolation & Context Deployment</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="shimmer-button bg-brand-primary text-white px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus size={16} /> Enlist Cluster
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
              className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-obsidian-900 border border-white/5 p-12 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Initialize Cluster</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Protocol: NEW_WORKSPACE_INIT</p>
                </div>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-white transition-colors p-3 bg-white/5 rounded-2xl border border-white/10">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Cluster Designation</label>
                  <input 
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g. ALPHA_NEURAL_GRID"
                    className="w-full bg-black/40 border border-white/5 rounded-[2rem] p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                    autoFocus
                  />
                </div>
                <button 
                  disabled={creating || !newWorkspaceName}
                  className="shimmer-button w-full bg-brand-primary text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Authorize Deployment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-brand-primary" size={48} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Cluster Topology...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-40 flex flex-col items-center justify-center text-center gap-8 bg-white/[0.01] border border-dashed border-white/10 rounded-[4rem]"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
              <Globe size={48} className="text-slate-700" />
            </div>
            <div>
              <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">Neural Registry Void</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">No active compute clusters identified. Initialize your first sector to begin.</p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {workspaces.map((w, i) => (
              <motion.div 
                key={w.id} 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-obsidian-900 border border-white/5 rounded-[3rem] p-10 hover:bg-white/[0.02] transition-all cursor-pointer group relative overflow-hidden shadow-2xl ${expandedId === w.id ? 'ring-2 ring-brand-primary/20 bg-white/[0.02]' : ''}`}
                onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                       <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${expandedId === w.id ? 'bg-brand-primary text-white shadow-2xl shadow-orange-500/20 border-brand-primary' : 'bg-obsidian-950 text-brand-primary border-white/5 group-hover:border-brand-primary/30'}`}>
                          <Globe size={32} />
                       </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">{w.name}</h2>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-white/5 shadow-inner">
                           <Command size={10} className="text-slate-600" />
                           <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest tabular-nums">{w.id ? w.id.substring(0, 13) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                           <Activity size={10} className="text-emerald-500" />
                           Initialized: {new Date(w.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <motion.div 
                    animate={{ rotate: expandedId === w.id ? 180 : 0 }}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${expandedId === w.id ? 'bg-brand-primary border-brand-primary text-white shadow-2xl' : 'bg-white/5 border-white/10 text-slate-500'}`}
                  >
                    <ChevronDown size={24} />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {expandedId === w.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <WorkspaceEnvSection workspaceId={w.id} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Workspaces;