import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Layout, Search, Download, Sparkles, Zap, RefreshCw, X, Check, Upload, Eye, GitFork } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import TaskWizard from '../components/TaskWizard';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const decodeBase64 = (str) => {
    if (!str) return '';
    try {
        const binary = atob(str);
        try {
            return decodeURIComponent(binary.split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch {
            return binary;
        }
    } catch {
        return str;
    }
};

const Templates = () => {
    const { notify } = useNotify();
    const { addListener, removeListener } = useSSE();
    const [trending, setTrending] = useState([]);
    const isMounted = useRef(true);
    const fileInputRef = useRef(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [confirmDeploy, setConfirmDeploy] = useState(null);
    const [previewTemplate, setPreviewTemplate] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchTrending = useCallback(async () => {
        try {
            const res = await axios.get('/api/v1/templates/trending');
            if (res.data.success && isMounted.current) {
                setTrending(res.data.data || []);
            }
        } catch {
            // silent error fallback
        }
    }, []);
    
    const fetchTemplates = useCallback(async (query = '') => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/templates?search=${encodeURIComponent(query)}`);
            if (res.data.success && isMounted.current) {
                setTemplates(res.data.data || []);
            }
        } catch (err) {
            notify('ERROR', 'Failed to fetch blueprints', err.response?.data?.error || err.message);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        const handleUpdate = () => {
            fetchTemplates(search);
        };
        addListener('template_updated', handleUpdate);
        return () => removeListener('template_updated', handleUpdate);
    }, [addListener, removeListener, fetchTemplates, search]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            await fetchTemplates(search);
            await fetchTrending();
        }, 500);
        return () => clearTimeout(timer);
    }, [search, fetchTemplates, fetchTrending]);

    const handleDeployBundle = async (templateId) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/blueprints/deploy', {
                template_id: templateId,
                variables: {} 
            });
            if (res.data.success) {
                notify('SUCCESS', 'Blueprint bundle deployed successfully');
                navigate('/canvas');
            }
        } catch (err) {
            notify('ERROR', 'Failed to deploy blueprint bundle', err.response?.data?.error || err.message);
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setConfirmDeploy(null);
            }
        }
    };

    const handleUseBlueprint = (template) => {
        let config = template.config;
        if (typeof template.config === 'string') {
            try {
                config = JSON.parse(template.config);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    try {
                        config = JSON.parse(decodeBase64(template.config));
                    } catch {
                        notify('ERROR', 'Failed to parse blueprint configuration');
                        config = null; 
                    }
                } else {
                    config = null;
                }
            }
        }

        if (Array.isArray(config)) {
            setConfirmDeploy({ id: template.id, count: config.length });
        } else {
            setSelectedTemplate({
                template_id: template.id,
                name: `${template.name} (Copy)`,
                ...config
            });
            setIsWizardOpen(true);
        }
    };

    const handleFork = async (template) => {
        try {
            let config = template.config;
            if (typeof template.config === 'string') {
                try {
                    config = JSON.parse(template.config);
                } catch {
                    try { config = JSON.parse(decodeBase64(template.config)); } catch { /* ... */ }
                }
            }
            await axios.post('/api/v1/templates', {
                name: `${template.name} (Forked)`,
                description: template.description || '',
                config: config,
                is_public: false
            });
            notify('SUCCESS', 'Blueprint Forked Successfully');
            fetchTemplates(search);
        } catch (err) {
            notify('ERROR', 'Failed to fork blueprint', err.response?.data?.error || err.message);
        }
    };

    const handleExportBlueprint = (template) => {
        try {
            let config = template.config;
            if (typeof template.config === 'string') {
                try {
                    config = JSON.parse(template.config);
                } catch {
                    try {
                        config = JSON.parse(decodeBase64(template.config));
                    } catch {
                        // ignore
                    }
                }
            }

            const fileData = JSON.stringify({
                name: template.name,
                description: template.description || '',
                config: config
            }, null, 2);

            const blob = new Blob([fileData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_blueprint.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            notify('SUCCESS', 'Blueprint configuration exported');
        } catch (err) {
            notify('ERROR', 'Failed to export blueprint', err.message);
        }
    };

    const handleImportBlueprint = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.name || !data.config) {
                    throw new Error("Invalid blueprint format. Missing 'name' or 'config' fields.");
                }

                setLoading(true);
                const res = await axios.post('/api/v1/templates', {
                    name: data.name,
                    description: data.description || '',
                    config: data.config,
                    is_public: true
                });

                if (res.status === 201 || res.data) {
                    notify('SUCCESS', 'Blueprint imported successfully');
                    fetchTemplates(search);
                }
            } catch (err) {
                notify('ERROR', 'Import failed', err.response?.data?.error || err.message);
            } finally {
                if (isMounted.current) {
                  setLoading(false);
                }
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8 pb-12">
            <TaskWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onTaskCreated={async () => {
                    if (selectedTemplate && selectedTemplate.template_id) {
                        try {
                            await axios.post(`/api/v1/templates/${selectedTemplate.template_id}/increment-uses`);
                            fetchTemplates(search);
                        } catch {
                            // Non-critical error
                        }
                    }                }}
                initialData={selectedTemplate}
            />
            
            <AnimatePresence>
              {previewTemplate && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPreviewTemplate(null)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-zinc-950/90 backdrop-blur-3xl border border-indigo-500/30 p-8 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-3xl relative z-10 overflow-hidden flex flex-col h-[80vh] ring-1 ring-white/5"
                  >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"></div>
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div>
                         <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                           <Eye size={20} className="text-indigo-400" /> Blueprint Preview
                         </h2>
                         <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-2">{previewTemplate.name}</p>
                      </div>
                      <button onClick={() => setPreviewTemplate(null)} className="text-zinc-500 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 p-2 rounded-xl transition-all">
                         <X size={20} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto bg-black/60 border border-zinc-800/60 rounded-2xl p-6 custom-scrollbar shadow-inner relative">
                      <pre className="text-[11px] font-mono text-zinc-300 leading-loose">
                        {typeof previewTemplate.config === 'string' 
                          ? (() => {
                              try { return JSON.stringify(JSON.parse(previewTemplate.config), null, 2) }
                              catch { 
                                try { return JSON.stringify(JSON.parse(decodeBase64(previewTemplate.config)), null, 2) }
                                catch { return previewTemplate.config }
                              }
                            })()
                          : JSON.stringify(previewTemplate.config, null, 2)
                        }
                      </pre>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <motion.h1 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight"
                  >
                    Intelligence Marketplace
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-[0.2em]"
                  >
                    Industrial blueprints for high-frequency task automation
                  </motion.p>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/60 shadow-inner"
                >
                   <div className="relative group flex-1 md:w-64">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search Blueprints..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-white pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-inner"
                      />
                   </div>
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700"
                     title="Import Blueprint JSON"
                   >
                     <Upload size={16} /> <span className="text-[10px] uppercase tracking-[0.2em] font-black hidden sm:inline">Import</span>
                   </button>
                   <input 
                     type="file" 
                     accept=".json" 
                     onChange={handleImportBlueprint} 
                     className="hidden" 
                     ref={fileInputRef} 
                   />
                   <button 
                     onClick={() => fetchTemplates(search)}
                     className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all shadow-md active:scale-95 border border-zinc-700"
                   >
                     <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
                   </button>
                </motion.div>
            </header>

            {trending.length > 0 && (
              <div className="space-y-5">
                 <div className="flex items-center gap-3 ml-2">
                    <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Popular Blueprints Leaderboard</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                    {trending.map((t, idx) => (
                      <div 
                        key={`trend-${t.id}`}
                        onClick={() => handleUseBlueprint(t)}
                        className="bg-zinc-950/60 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-6 hover:border-indigo-500/50 hover:bg-zinc-900/80 hover:shadow-[0_0_30px_rgba(79,70,229,0.15)] transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                      >
                        <div className="absolute top-0 right-0 p-4 text-[12px] font-black text-indigo-500/20 tracking-tighter">
                           #{idx + 1}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight truncate mb-2 group-hover:text-indigo-400 transition-colors pr-6">{t.name}</h4>
                          <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed font-medium">
                            {t.description || "Baseline workflow configuration."}
                          </p>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-6 flex items-center gap-2">
                           <Zap size={12} className="text-indigo-500/50 group-hover:text-indigo-400 transition-colors" /> {t.uses_count || 0} deploys
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {loading && templates.length === 0 ? (
                <div className="py-40 flex flex-col items-center justify-center gap-5 opacity-60">
                  <RefreshCw className="animate-spin text-indigo-500" size={40} />
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] animate-pulse">Syncing Marketplace...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center gap-5 bg-zinc-900/20 border border-dashed border-zinc-800/60 rounded-3xl opacity-60">
                   <Layout size={48} className="text-zinc-700" />
                   <span className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.2em] text-center">Data synchronized.<br/>No blueprints matching query.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((t) => (
                    <div 
                      key={t.id}
                      className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 p-8 rounded-3xl hover:border-zinc-700 hover:bg-zinc-900/60 transition-all group flex flex-col h-full shadow-xl"
                    >
                      <div className="flex items-start justify-between mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:border-indigo-500/40 group-hover:text-indigo-400 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all shadow-inner">
                          <Sparkles size={24} />
                        </div>
                        {t.is_premium && (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner">
                             <Zap size={12} fill="currentColor" /> Premium
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-3 group-hover:text-indigo-400 transition-colors">{t.name}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium mb-10 flex-grow">
                        {t.description || "Baseline workflow configuration for autonomous task orchestration."}
                      </p>

                      <div className="flex items-center justify-between pt-6 border-t border-zinc-800/60">
                        <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                           <Download size={14} className="opacity-70" />
                           {t.uses_count || 0} Syncs
                        </div>
                         <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleExportBlueprint(t)}
                            className="p-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-white transition-all shadow-md hover:border-zinc-700"
                            title="Export Blueprint JSON"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => setPreviewTemplate(t)}
                            className="p-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-white transition-all shadow-md hover:border-zinc-700"
                            title="Preview Configuration"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleFork(t)}
                            className="p-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-white transition-all shadow-md hover:border-zinc-700"
                            title="Fork Blueprint"
                          >
                            <GitFork size={16} />
                          </button>
                          {confirmDeploy?.id === t.id ? (
                            <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-1.5 shadow-inner">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-2 whitespace-nowrap">Deploy {confirmDeploy.count}?</span>
                              <button 
                                onClick={() => handleDeployBundle(t.id)}
                                disabled={loading}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setConfirmDeploy(null)}
                                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-800"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleUseBlueprint(t)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ml-2"
                            >
                              Initialize
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
        </div>
    );
};

export default Templates;