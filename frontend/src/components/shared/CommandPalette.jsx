import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Zap, Layers, Users, Sparkles, X, ChevronRight, Layout, Shield, Activity } from 'lucide-react';
import axios from 'axios';
import { createPortal } from 'react-dom';

const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const quickJumps = [
    { type: 'sector', name: 'Neural Dashboard', id: '/dashboard', icon: Layout, subtext: 'Overview of system telemetry' },
    { type: 'sector', name: 'Workflow Canvas', id: '/canvas', icon: Layers, subtext: 'Visual orchestration designer' },
    { type: 'sector', name: 'Task Registry', id: '/tasks', icon: Activity, subtext: 'Management of all active nodes' },
    { type: 'sector', name: 'Intelligence Marketplace', id: '/templates', icon: Sparkles, subtext: 'Browse and deploy blueprints' },
    { type: 'sector', name: 'Secret Vault', id: '/vault', icon: Shield, subtext: 'Manage encrypted credentials' },
  ];

  const fetchResults = useCallback(async (q) => {
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/search?q=${encodeURIComponent(q)}`);
      if (res.data.success) {
        setResults(res.data.data || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchResults(query), 300);
    return () => clearTimeout(timer);
  }, [query, fetchResults]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const allResults = query ? results : quickJumps;

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(allResults.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allResults.length) % Math.max(allResults.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item) => {
    onClose();
    setSearchQuery('');
    if (item.type === 'sector') {
      navigate(item.id);
    } else if (item.type === 'task') {
      navigate(`/tasks`); // Or a specific task detail if we add it
    } else if (item.type === 'blueprint') {
      navigate(`/templates`);
    } else if (item.type === 'user') {
      navigate(`/admin/users`);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="flex items-center px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <Search size={20} className="text-zinc-500 mr-4" />
          <input 
            ref={inputRef}
            type="text"
            placeholder="Search tasks, blueprints, users or sectors..."
            className="flex-1 bg-transparent border-none text-white focus:outline-none text-lg font-medium placeholder:text-zinc-600"
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-black text-zinc-400 uppercase tracking-widest">ESC</div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-3">
          <div className="px-3 py-2">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                {query ? `${allResults.length} Result Identifiers Found` : 'Neural Sector Quick Jumps'}
             </span>
          </div>

          <div className="space-y-1 mt-1">
            {allResults.map((item, idx) => {
              const Icon = item.icon || (item.type === 'task' ? Activity : item.type === 'blueprint' ? Sparkles : Users);
              const isSelected = idx === selectedIndex;

              return (
                <div 
                  key={`${item.type}-${item.id}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelect(item)}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${
                    isSelected ? 'bg-indigo-600/10 border-indigo-500/30' : 'border-transparent hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                      isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                       <span className={`text-sm font-bold uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                          {item.name}
                       </span>
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate opacity-80">
                          {item.subtext || item.type}
                       </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-3">
                       <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Enter to Select</span>
                       <ChevronRight size={16} className="text-indigo-500" />
                    </div>
                  )}
                </div>
              );
            })}

            {query && !loading && allResults.length === 0 && (
              <div className="py-12 text-center">
                 <p className="text-zinc-500 text-sm italic">No neural matching for "{query}" identified.</p>
              </div>
            )}

            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-50">
                 <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] font-black text-zinc-400">↑↓</div>
                 <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] font-black text-zinc-400">ENTER</div>
                 <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Open</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <Zap size={10} className="text-amber-500" />
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Aktionfy Global Index v2.1</span>
           </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default CommandPalette;