import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Layout, Search, Download, Loader2, Sparkles, Plus, Zap, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import TaskWizard from '../components/TaskWizard';

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
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const navigate = useNavigate();
    
    const fetchTemplates = useCallback(async (query = '') => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/templates?search=${encodeURIComponent(query)}`);
            if (res.data.success) {
                setTemplates(res.data.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTemplates(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, fetchTemplates]);

    const handleUseBlueprint = async (template) => {
        let config = template.config;
        if (typeof template.config === 'string') {
            try {
                config = JSON.parse(template.config);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    try {
                        config = JSON.parse(decodeBase64(template.config));
                    } catch (e2) {
                        console.error("Failed to parse template config:", e2);
                        config = null; 
                    }
                } else {
                    config = null;
                }
            }
        }

        if (Array.isArray(config)) {
            if (!confirm(`This blueprint contains ${config.length} tasks. Deploy this bundle to your workspace?`)) return;
            
            setLoading(true);
            try {
                const res = await axios.post('/api/v1/blueprints/deploy', {
                    template_id: template.id,
                    variables: {} 
                });
                if (res.data.success) {
                    navigate('/canvas');
                }
            } catch (err) {
                console.error('Failed to deploy blueprint bundle', err);
                alert('Failed to deploy blueprint bundle. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            setSelectedTemplate({
                id: template.id,
                name: `${template.name} (Copy)`,
                ...config
            });
            setIsWizardOpen(true);
        }
    };

    return (
        <DashboardLayout>
            <TaskWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onTaskCreated={async () => {
                    if (selectedTemplate && selectedTemplate.id) {
                        try {
                            await axios.post(`/api/v1/templates/${selectedTemplate.id}/increment-uses`);
                            fetchTemplates(search);
                        } catch (err) {
                            console.error('Failed to increment uses', err);
                        }
                    }
                }}
                initialData={selectedTemplate}
            />
            
            <header className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div>
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 mb-4"
                  >
                     <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                        <Sparkles size={16} />
                     </div>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Knowledge Base</span>
                  </motion.div>
                  <motion.h1 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-black text-white tracking-tighter"
                  >
                    Intelligence Marketplace.
                  </motion.h1>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">Pre-built Neural Workflow Blueprints</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                   <div className="relative group flex-1 sm:w-80">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-primary transition-colors z-10">
                         <Search size={18} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Search Intelligence..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-[2rem] pl-16 pr-8 py-5 text-sm text-white focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner placeholder:text-slate-800 font-mono"
                      />
                   </div>
                   <button 
                     onClick={() => fetchTemplates(search)}
                     className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-slate-400 hover:text-white transition-all active:scale-95"
                   >
                     <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                   </button>
                </div>
            </header>

            <AnimatePresence mode="wait">
              {loading && templates.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-40 flex flex-col items-center justify-center gap-6"
                >
                  <Loader2 className="animate-spin text-brand-primary" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Curating Intelligence Registry...</p>
                </motion.div>
              ) : templates.length === 0 ? (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="py-40 flex flex-col items-center justify-center text-center gap-8 bg-white/[0.01] border border-dashed border-white/10 rounded-[4rem]"
                >
                   <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5 text-slate-700">
                      <Layout size={48} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Registry Exhausted</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed opacity-60">The intelligence marketplace is currently undergoing a deep synchronization. Check back shortly.</p>
                   </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {templates.map((t, idx) => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-obsidian-900 border border-white/5 rounded-[3rem] p-10 hover:bg-white/[0.02] hover:border-brand-primary/20 transition-all group flex flex-col h-full relative overflow-hidden shadow-2xl"
                    >
                      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 blur-[80px] translate-x-1/4 -translate-y-1/4 pointer-events-none group-hover:bg-brand-primary/10 transition-all duration-700"></div>

                      <div className="flex items-start justify-between mb-10 relative z-10">
                        <div className="bg-brand-primary/10 p-5 rounded-[1.5rem] text-brand-primary border border-brand-primary/20 group-hover:rotate-12 transition-transform">
                          <Sparkles size={28} />
                        </div>
                        {t.is_premium && (
                          <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-[0.2em] rounded-full border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                             <Zap size={10} fill="currentColor" /> Premium
                          </div>
                        )}
                      </div>

                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 relative z-10 group-hover:text-brand-primary transition-colors">{t.name}</h3>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10 flex-grow relative z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                        {t.description || "Baseline neural configuration for autonomous task orchestration."}
                      </p>

                      <div className="flex items-center justify-between pt-8 border-t border-white/5 relative z-10">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-slate-500 group-hover:text-brand-primary transition-colors">
                              <Download size={14} />
                           </div>
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.uses_count || 0} Synchronizations</span>
                        </div>
                        <button 
                          onClick={() => handleUseBlueprint(t)}
                          className="shimmer-button bg-white text-obsidian-950 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 shadow-2xl"
                        >
                          <Plus size={14} /> Initialize
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
        </DashboardLayout>
    );
};

export default Templates;