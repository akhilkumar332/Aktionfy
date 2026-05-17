import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Users, LogOut, Key, 
  ListTodo, Webhook, Folder, FileText, Share2, BarChart3, 
  Settings, Menu, X, Zap
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarContent = ({ user, location, setIsSidebarOpen, handleLogout }) => (
  <>
    <div className="p-8 border-b border-white/5 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="bg-brand-primary/10 p-2 rounded-xl border border-brand-primary/20 group-hover:scale-110 transition-transform">
          <img src="/logo-icon.svg" className="w-8 h-8" alt="Logo" />
        </div>
        <span className="font-black text-xl tracking-tighter text-white">Aktionfy</span>
      </Link>
      <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white">
        <X size={20} />
      </button>
    </div>

    <nav className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
      {[
        { group: 'Core', items: [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['user', 'staff', 'admin'] },
          { icon: Share2, label: 'Workflow Canvas', path: '/canvas', roles: ['user', 'staff', 'admin'] },
          { icon: ListTodo, label: 'Schedules', path: '/tasks', roles: ['user', 'staff', 'admin'] },
        ]},
        { group: 'Infrastructure', items: [
          { icon: Folder, label: 'Workspaces', path: '/workspaces', roles: ['user', 'staff', 'admin'] },
          { icon: FileText, label: 'Templates', path: '/templates', roles: ['user', 'staff', 'admin'] },
          { icon: Webhook, label: 'Integrations', path: '/webhooks', roles: ['user', 'staff', 'admin'] },
          { icon: Key, label: 'Vault', path: '/vault', roles: ['user', 'staff', 'admin'] },
        ]},
        { group: 'Operations', items: [
          { icon: Activity, label: 'System Monitor', path: '/monitor', roles: ['staff', 'admin'] },
          { icon: BarChart3, label: 'Insights', path: '/admin/insights', roles: ['admin'] },
          { icon: Users, label: 'Identity Nexus', path: '/admin/users', roles: ['admin'] },
          { icon: Zap, label: 'Reaper Registry', path: '/admin/workers', roles: ['admin'] },
          { icon: Settings, label: 'Control Plane', path: '/admin/settings', roles: ['admin'] },
        ]},
      ].map((group) => {
        const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
        if (visibleItems.length === 0) return null;
        
        return (
          <div key={group.group} className="space-y-4">
            <h3 className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">{group.group}</h3>
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group ${
                    location.pathname === item.path
                      ? 'bg-brand-primary/10 text-brand-primary font-bold border border-brand-primary/20 shadow-[0_0_30px_rgba(217,119,6,0.1)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon size={18} className={location.pathname === item.path ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
                    <span className="text-[12px] font-bold tracking-wide">{item.label}</span>
                  </div>
                  {location.pathname === item.path && <div className="w-1 h-1 rounded-full bg-brand-primary shadow-[0_0_10px_#d97706]"></div>}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>

    <div className="p-6 border-t border-white/5 bg-white/[0.01]">
      <div className="px-5 py-5 bg-black/40 rounded-2xl border border-white/5 mb-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 relative z-10">Neural Identity</p>
        <p className="text-[13px] font-black text-white truncate mb-1 relative z-10">{user?.email}</p>
        <div className="flex items-center gap-2 relative z-10">
           <span className="px-2 py-0.5 bg-brand-primary text-white text-[8px] font-black rounded-lg uppercase tracking-widest">
             {user?.role}
           </span>
           <span className="px-2 py-0.5 bg-white/5 text-slate-400 text-[8px] font-black rounded-lg uppercase tracking-widest border border-white/5">
             {user?.tier}
           </span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-3 w-full py-4 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em]"
      >
        <LogOut size={16} />
        Session Termination
      </button>
    </div>
  </>
);

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-obsidian-950 text-white font-sans selection:bg-brand-primary selection:text-white">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-80 bg-obsidian-900 border-r border-white/5 flex-col sticky top-0 h-screen z-50">
        <SidebarContent user={user} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
      </aside>

      {/* Sidebar for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 bg-obsidian-900 border-r border-white/5 flex flex-col z-[70]"
            >
              <SidebarContent user={user} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-obsidian-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
          <div className="flex items-center gap-3">
             <img src="/logo-icon.svg" className="w-8 h-8" alt="Logo" />
             <span className="font-black text-lg tracking-tighter">Aktionfy</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white">
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 p-6 md:p-12 lg:p-20 overflow-x-hidden relative">
          {/* Subtle Page Glows */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;