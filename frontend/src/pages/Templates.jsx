import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Layout, Search, Download, Sparkles, Zap, RefreshCw, X, Check, Upload } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
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
                setLoading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <>
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
            
            <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Intelligence Marketplace</h1>
                  <p className="text-zinc-400 text-xs font-medium mt-1">Industrial blueprints for high-frequency neural orchestration.</p>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="relative group">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-brand-primary transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search Blueprints..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pro-input pl-9 w-64 !py-1.5 !text-xs"
                      />
                   </div>
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all text-xs font-semibold"
                     title="Import Blueprint JSON"
                   >
                     <Upload size={14} /> <span className="text-[10px] uppercase tracking-widest font-black">Import</span>
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
                     className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
                   >
                     <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                   </button>
                </div>
            </header>

            {trending.length > 0 && (
              <div className="mb-12 space-y-4">
                 <div className="flex items-center gap-2 text-indigo-400 ml-1">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Popular Blueprints Leaderboard</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {trending.map((t, idx) => (
                      <div 
                        key={`trend-${t.id}`}
                        onClick={() => handleUseBlueprint(t)}
                        className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-5 hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                      >
                        <div className="absolute top-0 right-0 p-3 text-[9px] font-mono text-indigo-500/20 font-black">
                           #{idx + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-tight truncate mb-1 group-hover:text-indigo-400 transition-colors">{t.name}</h4>
                          <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {t.description || "Baseline neural configuration."}
                          </p>
                        </div>
                        <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-4">
                           {t.uses_count || 0} deploys
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {loading && templates.length === 0 ? (
                <div className="py-40 flex flex-col items-center justify-center gap-4 opacity-50">
                  <RefreshCw className="animate-spin text-zinc-300" size={32} />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Marketplace...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center gap-4 pro-card border-dashed bg-zinc-900/10 opacity-50">
                   <Layout size={32} className="text-zinc-700" />
                   <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest italic">Registry synchronized. No blueprints matching query.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((t) => (
                    <div 
                      key={t.id}
                      className="pro-card p-6 flex flex-col h-full hover:bg-zinc-900/40 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:border-brand-primary/40 group-hover:text-brand-primary transition-all">
                          <Sparkles size={20} />
                        </div>
                        {t.is_premium && (
                          <span className="pro-badge bg-amber-500/10 border-amber-500/20 text-amber-500 flex items-center gap-1.5">
                             <Zap size={10} fill="currentColor" /> Premium
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white uppercase tracking-tight mb-2 group-hover:text-brand-primary transition-colors">{t.name}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium mb-8 flex-grow">
                        {t.description || "Baseline neural configuration for autonomous task orchestration."}
                      </p>

                      <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                           <Download size={12} />
                           {t.uses_count || 0} Syncs
                        </div>
                         <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleExportBlueprint(t)}
                            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
                            title="Export Blueprint JSON"
                          >
                            <Download size={12} />
                          </button>
                          {confirmDeploy?.id === t.id ? (
                            <div className="flex items-center gap-1 bg-brand-primary/10 border border-brand-primary/20 rounded-md p-0.5">
                              <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest px-2">Deploy {confirmDeploy.count} nodes?</span>
                              <button 
                                onClick={() => handleDeployBundle(t.id)}
                                disabled={loading}
                                className="p-1.5 text-brand-primary hover:bg-brand-primary hover:text-white rounded transition-all"
                              >
                                <Check size={12} />
                              </button>
                              <button 
                                onClick={() => setConfirmDeploy(null)}
                                className="p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded transition-all"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleUseBlueprint(t)}
                              className="pro-button-secondary !py-1.5 !px-4 !text-[10px] uppercase tracking-widest"
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
        </>
    );
};

export default Templates;