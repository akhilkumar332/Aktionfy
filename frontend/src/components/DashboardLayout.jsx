import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Users, LogOut, Key, 
  ListTodo, Webhook, Folder, FileText, Share2, BarChart3, 
  Settings, Menu, X, Zap, ChevronRight, Search, Command
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarItem = ({ icon: Icon, label, path, isActive, onClick, roles, userRole }) => {
  if (roles && !roles.includes(userRole)) return null;
  
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group ${
        isActive 
          ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-brand-primary' : 'text-zinc-400 group-hover:text-zinc-300'} />
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
      { icon: Zap, label: 'Workers', path: '/admin/workers', roles: ['admin'] },
      { icon: Settings, label: 'Settings', path: '/admin/settings', roles: ['admin'] },
    ]
  }
];

const Sidebar = ({ mobile = false, user, location, setIsSidebarOpen, handleLogout }) => (
  <div className={`flex flex-col h-full bg-zinc-950 border-r border-zinc-800 ${mobile ? 'w-full' : 'w-64'}`}>
    <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center transition-all group-hover:border-brand-primary/50 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <Command size={18} className="text-brand-primary" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">Aktionfy</span>
      </Link>
      {mobile && (
        <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400 hover:text-white">
          <X size={20} />
        </button>
      )}
    </div>

    <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 space-y-8">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(user?.role));
        if (visibleItems.length === 0) return null;
        
        return (
          <div key={group.title} className="space-y-2">
            <h3 className="px-3 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{group.title}</h3>
            <div className="space-y-1">
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

    <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-900/20">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary font-bold text-xs shrink-0">
          {user?.email?.[0].toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white truncate">{user?.email}</span>
          <span className="text-[10px] text-zinc-400 uppercase font-black tracking-tight truncate">{user?.role} • {user?.tier}</span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 w-full px-3 py-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-md transition-all text-sm font-medium"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
    </div>
  </div>
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

  const isFullBleed = location.pathname === '/canvas';

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Desktop Sidebar - Absolute/Fixed to prevent layout shift during animation */}
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
              className="absolute left-0 top-0 bottom-0 w-80 bg-zinc-950 shadow-2xl flex flex-col"
            >
              <Sidebar mobile user={user} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen`}>
        {/* Header Action Bar - Hide on full bleed if page has its own */}
        {!isFullBleed && (
          <header className="h-16 border-b border-zinc-800 bg-zinc-950 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="lg:hidden p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-zinc-400">Root</span>
                <ChevronRight size={14} className="text-zinc-700" />
                <span className="text-zinc-200 capitalize">{location.pathname.split('/').pop().replace(/-/g, ' ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-[11px] text-zinc-400 font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  System Active
              </div>
              <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md transition-all">
                  <Search size={18} />
              </button>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-x-hidden relative ${isFullBleed ? '' : 'p-6 md:p-10 lg:p-12'}`}>
          <div className={isFullBleed ? 'h-full' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;