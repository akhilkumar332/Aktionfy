import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, Users, LogOut, Clock } from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['user', 'staff', 'admin'] },
    { icon: Activity, label: 'System Monitor', path: '/monitor', roles: ['staff', 'admin'] },
    { icon: Users, label: 'User Management', path: '/admin/users', roles: ['admin'] },
  ];

  return (
    <div className="flex min-h-screen bg-[#faf9f5]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-[#d97706] p-2 rounded-lg text-white">
            <Clock className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-[#141413]">Schedule MCP</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            item.roles.includes(user?.role) && (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                  location.pathname === item.path
                    ? 'bg-[#d97706]/10 text-[#d97706] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="px-4 py-3 bg-slate-50 rounded-xl mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-[10px] font-bold rounded uppercase">
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
