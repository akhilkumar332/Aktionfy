import { NavLink, Outlet } from 'react-router-dom';
import { Book, Code, Terminal, FileJson, Info, Zap, Shield, Workflow, Command, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ sections, setIsMobileMenuOpen }) => (
  <div className="p-8 pt-12 flex flex-col h-full">
    <nav className="space-y-10 flex-1">
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em] mb-4 ml-3">{section.title}</h4>
          <ul className="space-y-1">
            {section.links.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    }`
                  }
                >
                  <link.icon size={16} className="text-zinc-300 group-hover:text-zinc-400 shrink-0" />
                  <span className="truncate">{link.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
    
    <div className="mt-auto pt-8 border-t border-zinc-800/50">
       <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-brand-primary">
             <Command size={16} />
          </div>
          <div>
             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Version</p>
             <p className="text-xs font-bold text-zinc-200 mt-1">v3.4.2-PRO</p>
          </div>
       </div>
    </div>
  </div>
);

const DocumentationLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const sections = [
    {
      title: 'Getting Started',
      links: [
        { name: 'Overview', path: '/docs/overview', icon: Info },
        { name: 'Quick Start', path: '/docs/quickstart', icon: Zap },
        { name: 'Installation', path: '/docs/installation', icon: Terminal },
      ]
    },
    {
      title: 'Developer Guide',
      links: [
        { name: 'Core Concepts', path: '/docs/concepts', icon: Book },
        { name: 'API Reference', path: '/docs/api-reference', icon: Code },
        { name: 'Worker Architecture', path: '/docs/architecture', icon: Workflow },
      ]
    },
    {
      title: 'MCP Protocol',
      links: [
        { name: 'Protocol Spec', path: '/docs/protocol-spec', icon: FileJson },
        { name: 'Auth & Security', path: '/docs/security', icon: Shield },
      ]
    }
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile Docs Header */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-16 z-30">
        <div className="flex items-center gap-2">
           <Book size={18} className="text-zinc-400" />
           <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Documentation</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[40] top-16">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col"
            >
              <Sidebar sections={sections} setIsMobileMenuOpen={setIsMobileMenuOpen} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Docs Sidebar */}
      <aside className="w-72 border-r border-zinc-800 bg-zinc-950 hidden lg:block sticky top-16 h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar shrink-0">
        <Sidebar sections={sections} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      </aside>

      {/* Docs Content */}
      <main className="flex-1 p-8 md:p-16 lg:p-20 overflow-y-auto">
        <div className="max-w-3xl mx-auto prose prose-invert prose-zinc prose-headings:font-bold prose-headings:tracking-tighter prose-a:text-brand-primary prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-code:text-brand-primary prose-code:bg-zinc-900 prose-code:px-1 prose-code:rounded prose-img:rounded-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DocumentationLayout;