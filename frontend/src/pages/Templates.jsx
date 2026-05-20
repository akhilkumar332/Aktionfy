import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Layout, Search, Download, Sparkles, Zap, RefreshCw, X, Check } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import TaskWizard from '../components/TaskWizard';
import { useNotify } from '../context/NotificationContext';

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
    const isMounted = useRef(true);
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
        const timer = setTimeout(() => {
            fetchTemplates(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, fetchTemplates]);

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
                     onClick={() => fetchTemplates(search)}
                     className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
                   >
                     <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                   </button>
                </div>
            </header>

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