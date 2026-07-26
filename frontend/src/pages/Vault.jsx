import React, { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Key, Trash2, Plus, ShieldCheck, Loader2, X, RefreshCw, Shield, Check, Eye, EyeOff, Edit2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const Vault = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSecret, setNewSecret] = useState({ name: '', value: '', ttl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedSecret, setExpandedSecret] = useState(null);

  const handleEditClick = (secret) => {
    setNewSecret({ name: secret.name, value: '', ttl: secret.ttl ? String(secret.ttl) : '' });
    setEditMode(true);
    setShowAddForm(true);
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/secrets');
      if (res.data.success && isMounted.current) {
        setSecrets(res.data.data || []);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch secrets', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchData();
    };
    addListener('secret_updated', handleUpdate);
    return () => removeListener('secret_updated', handleUpdate);
  }, [addListener, removeListener, fetchData]);

  useEffect(() => {
    const init = async () => {
      await fetchData();
    };
    init();
  }, [fetchData]);

  const handleDelete = async (name) => {
    try {
      await axios.delete(`/api/v1/secrets/${name}`);
      notify('SUCCESS', `Secret "${name}" decoupled`);
      fetchData();
    } catch (err) {
      notify('ERROR', `Failed to decouple secret`, err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setConfirmDelete(null);
    }
  };

  const handleUpsert = async (e) => {
    e.preventDefault();
    if (!newSecret.name || !newSecret.value) {
      notify('ERROR', 'Identity and value required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: newSecret.name,
        value: newSecret.value,
        ttl: newSecret.ttl ? parseInt(newSecret.ttl, 10) : 0
      };
      await axios.post('/api/v1/secrets', payload);
      notify('SUCCESS', editMode ? `Secret "${newSecret.name}" updated successfully` : `Secret "${newSecret.name}" encrypted and stored`);
      if (isMounted.current) {
        setNewSecret({ name: '', value: '', ttl: '' });
        setEditMode(false);
        setShowAddForm(false);
      }
      fetchData();
    } catch (err) {
      notify('ERROR', 'Failed to store secret', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSubmitting(false);
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
            Secret Vault
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
          >
            Encrypted credential & private key persistence buffer
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner"
        >
           <button 
             onClick={fetchData}
             className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700"
             aria-label="Refresh secrets"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
           </button>
           <button 
            onClick={() => {
              setEditMode(false);
              setNewSecret({ name: '', value: '', ttl: '' });
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Store Secret</span>
          </button>
        </motion.div>
      </header>

      {/* Add Secret Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddForm(false);
                setNewSecret({ name: '', value: '', ttl: '' });
                setEditMode(false);
              }}
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
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    {editMode ? "Modify Data" : "Deposit Identity"}
                  </h2>
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mt-1">
                    {editMode ? "PROTOCOL: SECURE_VAULT_UPDATE" : "PROTOCOL: SECURE_VAULT_DEPOSIT"}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSecret({ name: '', value: '', ttl: '' });
                    setEditMode(false);
                  }} 
                  className="text-zinc-500 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 p-2 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpsert} className="space-y-6">
                <div className="space-y-3 relative group">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Secret Identity (Key)</label>
                  <input 
                    type="text"
                    value={newSecret.name}
                    onChange={(e) => setNewSecret({...newSecret, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')})}
                    placeholder="INFRA_API_TOKEN"
                    className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-5 py-4 rounded-2xl text-sm font-mono font-bold uppercase tracking-widest placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner disabled:opacity-50 disabled:bg-zinc-950"
                    required
                    autoFocus={!editMode}
                    disabled={editMode}
                  />
                </div>
                <div className="space-y-3 relative group">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Sensitive Data</label>
                  <div className="relative">
                      <input 
                      type={showSecretValue ? "text" : "password"}
                      value={newSecret.value}
                      onChange={(e) => setNewSecret({...newSecret, value: e.target.value})}
                      placeholder="Raw data..."
                      className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-5 py-4 pr-12 rounded-2xl text-sm font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSecretValue(!showSecretValue)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-800/50 p-1.5 rounded-lg"
                      title={showSecretValue ? "Hide Value" : "Show Value"}
                    >
                      {showSecretValue ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 relative group">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Temporary Lease (Seconds)</label>
                    <input 
                    type="number"
                    value={newSecret.ttl || ''}
                    onChange={(e) => setNewSecret({...newSecret, ttl: e.target.value})}
                    placeholder="e.g. 3600 (optional)"
                    className="w-full bg-zinc-900/80 border border-zinc-800 text-white px-5 py-4 rounded-2xl text-sm font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
                    min="0"
                  />
                </div>
                
                <button 
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg disabled:shadow-none mt-4"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Authorize Encryption
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-[2rem] overflow-hidden shadow-2xl relative group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
        <div className="overflow-x-auto custom-scrollbar relative z-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/50 border-b border-zinc-800/60">
                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Secret Identity</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">Encryption</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center">Initialized</th>
                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {loading && secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-32">
                     <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] animate-pulse">Synchronizing Vault...</span>
                     </div>
                  </td>
                </tr>
              ) : secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-32 text-center bg-zinc-950/20">
                     <div className="flex flex-col items-center gap-5 opacity-40">
                        <Key size={48} className="text-zinc-500" />
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] text-center">Vault is empty.<br/>No encrypted identities identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <React.Fragment key={secret.name}>
                    <tr className="group hover:bg-zinc-800/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:border-indigo-500/50 group-hover:text-indigo-400 group-hover:shadow-[0_0_15px_rgba(79,70,229,0.2)] transition-all shadow-inner">
                             <Key size={20} />
                          </div>
                          <div className="flex flex-col min-w-0">
                             <span className="text-sm font-black text-white truncate font-mono uppercase tracking-widest">{secret.name}</span>
                             <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">AES_256_GCM_BUFFER</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                         {secret.is_leased ? (
                           <span className="inline-flex items-center gap-2 bg-indigo-950/40 border border-indigo-900/50 text-indigo-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-inner">
                              <Clock size={12} className="text-indigo-400 animate-pulse" /> Lease: {secret.ttl}s
                           </span>
                         ) : (
                           <span className="inline-flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 text-zinc-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-inner">
                              <Shield size={12} className="text-emerald-500/70" /> Locked
                           </span>
                         )}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-[11px] text-zinc-400 font-bold tabular-nums uppercase tracking-[0.1em]">{new Date(secret.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                          {confirmDelete === secret.name ? (
                            <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 rounded-xl p-1 shadow-inner">
                              <button 
                                onClick={() => handleDelete(secret.name)}
                                className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                                title="Confirm Terminate"
                              >
                                <Check size={16} />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete(null)}
                                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-800"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => setExpandedSecret(expandedSecret === secret.name ? null : secret.name)}
                                className={`p-2.5 rounded-xl transition-all shadow-md ${
                                  expandedSecret === secret.name 
                                    ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400' 
                                    : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                                title="View Versions"
                              >
                                <RefreshCw size={16} />
                              </button>
                              <button 
                                onClick={() => handleEditClick(secret)}
                                className="p-2.5 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-all shadow-md"
                                title="Modify Data"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete(secret.name)}
                                className="p-2.5 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all shadow-md hover:bg-red-500/10"
                                title="Terminate Linkage"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedSecret === secret.name && (
                        <tr className="bg-black/20 border-b border-zinc-800/50 shadow-inner">
                          <td colSpan="4" className="px-8 py-0">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="py-6 border-t border-zinc-800/30">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Version History</h4>
                                <div className="space-y-3 max-w-2xl">
                                  {[1, 2].map((v) => (
                                    <div key={v} className="flex items-center justify-between p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-2xl hover:border-zinc-700 transition-colors">
                                      <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800/80 shadow-inner">v{3 - v}</span>
                                        <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.1em]">Updated by system actor</span>
                                      </div>
                                      <div className="flex items-center gap-6">
                                        <span className="text-[11px] text-zinc-500 font-bold tabular-nums tracking-wider">
                                          {new Date(Date.now() - v * 86400000).toLocaleDateString()}
                                        </span>
                                        <button className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors">
                                          Restore
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Vault;