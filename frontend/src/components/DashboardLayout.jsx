import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Users, LogOut, Key, 
  ListTodo, Webhook, Folder, FileText, Share2, BarChart3, 
  Settings, Menu, X, Zap, ChevronRight, Search, Command,
  ShieldAlert, Globe
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import BridgeAssistant from './modals/BridgeAssistant';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const SidebarItem = ({ icon: Icon, label, path, isActive, onClick, roles, userRole }) => {
  if (roles && !roles.includes(userRole)) return null;
  
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group pro-focus ${
        isActive 
          ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-brand-primary' : 'text-zinc-500 group-hover:text-zinc-300'} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {isActive && (
        <motion.div 
          layoutId="sidebar-active"
          className="ml-auto w-1 h-4 bg-brand-primary rounded-full"
        />
      )}
    </Link>
  );
};

const navGroups = [
  {
    title: 'Navigation',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['user', 'staff', 'admin'] },
      { icon: Share2, label: 'Workflows', path: '/canvas', roles: ['user', 'staff', 'admin'] },
      { icon: ListTodo, label: 'Schedules', path: '/tasks', roles: ['user', 'staff', 'admin'] },
    ]
  },
  {
    title: 'Infrastructure',
    items: [
      { icon: Folder, label: 'Workspaces', path: '/workspaces', roles: ['user', 'staff', 'admin'] },
      { icon: FileText, label: 'Templates', path: '/templates', roles: ['user', 'staff', 'admin'] },
      { icon: Webhook, label: 'Integrations', path: '/webhooks', roles: ['user', 'staff', 'admin'] },
      { icon: Key, label: 'Secrets', path: '/vault', roles: ['user', 'staff', 'admin'] },
    ]
  },
  {
    title: 'System Control',
    items: [
      { icon: Activity, label: 'Monitoring', path: '/monitor', roles: ['staff', 'admin'] },
      { icon: BarChart3, label: 'Analytics', path: '/admin/insights', roles: ['admin'] },
      { icon: Users, label: 'Users', path: '/admin/users', roles: ['admin'] },
      { icon: Globe, label: 'SEO Settings', path: '/admin/seo', roles: ['admin'] },
      { icon: Zap, label: 'Workers', path: '/admin/workers', roles: ['admin'] },
      { icon: Settings, label: 'Settings', path: '/admin/settings', roles: ['admin'] },
    ]
  }
];

const Sidebar = ({ mobile = false, user, location, setIsSidebarOpen, handleLogout }) => (
  <div className={`flex flex-col h-full bg-zinc-950 border-r border-zinc-800 ${mobile ? 'w-full' : 'w-64'}`}>
    <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group pro-focus rounded-md">
        <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center transition-all group-hover:border-brand-primary/50 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <Command size={18} className="text-brand-primary" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white uppercase">Aktionfy</span>
      </Link>
      {mobile && (
        <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white pro-focus" aria-label="Close menu">
          <X size={20} />
        </button>
      )}
    </div>

    <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 space-y-8" aria-label="Main Navigation">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(user?.role));
        if (visibleItems.length === 0) return null;
        
        return (
          <div key={group.title} className="space-y-2">
            <h3 className="px-3 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">{group.title}</h3>
            <div className="space-y-0.5">
              {visibleItems.map((item) => (
                <SidebarItem 
                  key={item.path}
                  {...item}
                  isActive={location.pathname === item.path}
                  onClick={() => mobile && setIsSidebarOpen(false)}
                  userRole={user?.role}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>

    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/10">
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
        <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-[10px] shrink-0">
          {user?.email?.[0].toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-zinc-100 truncate">{user?.email}</span>
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest truncate">{user?.role} • {user?.tier}</span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 w-full px-3 py-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-md transition-all text-sm font-medium pro-focus"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
    </div>
  </div>
);

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isConnected, bridgeActive } = useSSE();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBridgeAssistantOpen, setIsBridgeAssistantOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/system/status');
      if (res.data.success && isMounted.current) {
        setSystemStatus(res.data.data);
      }
    } catch {
      // Background telemetry fails silently
    }
  }, []);

  useEffect(() => {
    // Wrap in setTimeout to avoid cascading render warning in strict environments
    setTimeout(() => {
      void fetchStatus();
    }, 0);
    
    // Poll faster when bridge assistant is open for immediate feedback
    const intervalTime = isBridgeAssistantOpen ? 5000 : 30000;
    const interval = setInterval(fetchStatus, intervalTime);
    return () => clearInterval(interval);
  }, [fetchStatus, isBridgeAssistantOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleStopImpersonating = async () => {
    try {
      const res = await axios.post('/api/v1/admin/users/stop-impersonate');
      if (res.data.success) {
        window.location.href = '/admin/users';
      }
    } catch (err) {
      console.error('Failed to stop impersonating:', err);
    }
  };

  const isFullBleed = location.pathname === '/canvas';

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    'g d': '/dashboard',
    'g c': '/canvas',
    'g t': '/tasks',
    'r': () => window.location.reload(),
  }), []);

  useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-brand-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-50">
        <Sidebar user={user} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-[100]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-80 bg-zinc-950 shadow-lg flex flex-col"
            >
              <Sidebar mobile user={user} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen`}>
        {user?.masquerader_email && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between z-50 backdrop-blur-md">
            <div className="flex items-center gap-3 text-amber-400 text-xs font-semibold">
              <ShieldAlert size={16} className="animate-pulse shrink-0" />
              <span>
                Impersonating <strong className="text-zinc-100 font-bold underline">{user.email}</strong> (Original Admin: {user.masquerader_email})
              </span>
            </div>
            <button
              onClick={handleStopImpersonating}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-500 text-amber-200 hover:text-white rounded-md text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer pro-focus"
            >
              Exit Masquerade
            </button>
          </div>
        )}
        {/* Header Action Bar */}
        {!isFullBleed && (
          <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="lg:hidden p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md pro-focus"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2 text-sm font-medium" aria-label="Breadcrumb">
                <span className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Root</span>
                <ChevronRight size={14} className="text-zinc-800" aria-hidden="true" />
                <span className="text-zinc-200 capitalize font-bold tracking-tight">{location.pathname.split('/').pop().replace(/-/g, ' ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsBridgeAssistantOpen(true)}
                title="Neural Link Assistance"
                className="hidden md:flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-inner transition-all hover:border-brand-primary/50 group cursor-pointer"
              >
                  <div className={`w-1 h-1 rounded-full animate-signal transition-colors duration-500 ${
                    !isConnected 
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                      : !bridgeActive 
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  }`}></div>
                  <span className={
                    !isConnected 
                      ? 'text-red-500 group-hover:text-red-400' 
                      : !bridgeActive 
                      ? 'text-amber-500 group-hover:text-amber-400' 
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }>
                    {!isConnected 
                      ? 'Bridge Lost' 
                      : !bridgeActive 
                      ? 'Bridge Offline' 
                      : 'Neural Link Active'}
                  </span>
              </button>
              <button 
                onClick={() => {
                  const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                  window.dispatchEvent(event);
                }}
                className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md transition-all pro-focus group relative"
                aria-label="Search Command (Cmd+K)"
              >
                <Search size={18} />
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block px-2 py-1 bg-zinc-800 text-[9px] font-black uppercase tracking-widest text-white rounded shadow-2xl border border-zinc-700 whitespace-nowrap z-50">
                   Cmd + K
                </div>
              </button>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-x-hidden relative ${isFullBleed ? '' : 'p-6 md:p-10 lg:p-12'}`}>
          <div className={isFullBleed ? 'h-full flex flex-col' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>


      <BridgeAssistant 
        isOpen={isBridgeAssistantOpen} 
        onClose={() => setIsBridgeAssistantOpen(false)} 
        systemStatus={systemStatus}
        fetchStatus={fetchStatus}
      />
    </div>
  );
};

export default DashboardLayout;