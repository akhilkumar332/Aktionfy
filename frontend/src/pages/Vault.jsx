import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Key, Trash2, Plus, ShieldCheck, Loader2, X, RefreshCw, Shield, Check, Eye, EyeOff, Edit2 } from 'lucide-react';
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
  const [newSecret, setNewSecret] = useState({ name: '', value: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const handleEditClick = (secret) => {
    setNewSecret({ name: secret.name, value: '' });
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
      await axios.post('/api/v1/secrets', newSecret);
      notify('SUCCESS', editMode ? `Secret "${newSecret.name}" updated successfully` : `Secret "${newSecret.name}" encrypted and stored`);
      if (isMounted.current) {
        setNewSecret({ name: '', value: '' });
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
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Secret Vault</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Encrypted credential and private key persistence buffer.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={fetchData}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
             aria-label="Refresh secrets"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
            onClick={() => {
              setEditMode(false);
              setNewSecret({ name: '', value: '' });
              setShowAddForm(true);
            }}
            className="pro-button-primary !py-2 !px-5 flex items-center gap-2"
          >
            <Plus size={16} /> <span className="text-[11px] uppercase tracking-widest">Store Secret</span>
          </button>
        </div>
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
                setNewSecret({ name: '', value: '' });
                setEditMode(false);
              }}
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
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                    {editMode ? "Modify Secret Payload" : "Deposit Identity"}
                  </h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                    {editMode ? "PROTOCOL: SECURE_VAULT_UPDATE" : "PROTOCOL: SECURE_VAULT_DEPOSIT"}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSecret({ name: '', value: '' });
                    setEditMode(false);
                  }} 
                  className="text-zinc-400 hover:text-white p-2"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpsert} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Secret Identity (Key)</label>
                  <input 
                    type="text"
                    value={newSecret.name}
                    onChange={(e) => setNewSecret({...newSecret, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')})}
                    placeholder="INFRA_API_TOKEN"
                    className="pro-input w-full font-mono !text-xs disabled:opacity-50"
                    required
                    autoFocus={!editMode}
                    disabled={editMode}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Sensitive Payload</label>
                  <div className="relative">
                    <input 
                      type={showSecretValue ? "text" : "password"}
                      value={newSecret.value}
                      onChange={(e) => setNewSecret({...newSecret, value: e.target.value})}
                      placeholder="Enter raw value for 256-bit encryption..."
                      className="pro-input w-full font-mono !text-xs pr-10"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSecretValue(!showSecretValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title={showSecretValue ? "Hide Value" : "Show Value"}
                    >
                      {showSecretValue ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button 
                  disabled={submitting}
                  className="pro-button-primary w-full !py-3 !text-[11px] uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Authorize Encryption
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pro-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="pro-table-header">
                <th className="px-6 py-4">Secret Identity</th>
                <th className="px-6 py-4 text-center">Encryption</th>
                <th className="px-6 py-4 text-center">Initialized</th>
                <th className="px-6 py-4 text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Synchronizing Vault...</span>
                     </div>
                  </td>
                </tr>
              ) : secrets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-30">
                        <Key size={32} className="text-zinc-300" />
                        <span className="text-xs font-medium text-zinc-400 italic">Vault registry void. No encrypted identities identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <tr key={secret.name} className="pro-table-row group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/50 transition-all">
                           <Key size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-sm font-semibold text-zinc-100 truncate font-mono uppercase tracking-widest">{secret.name}</span>
                           <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-tighter opacity-60">AES_256_GCM_BUFFER</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="pro-badge bg-zinc-950 border-zinc-800 text-zinc-400 w-fit mx-auto flex items-center gap-1.5 ring-1 ring-zinc-800/50">
                          <Shield size={10} className="text-emerald-500/50" /> Locked
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[11px] text-zinc-400 font-semibold tabular-nums uppercase">{new Date(secret.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        {confirmDelete === secret.name ? (
                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-md p-0.5">
                            <button 
                              onClick={() => handleDelete(secret.name)}
                              className="p-1 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                              title="Confirm Terminate"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditClick(secret)}
                              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-all"
                              title="Modify Payload"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(secret.name)}
                              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-red-500 hover:border-red-500/30 transition-all"
                              title="Terminate Linkage"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Vault;