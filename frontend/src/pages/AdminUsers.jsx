import { useEffect, useState, useCallback } from 'react';

import axios from 'axios';
import { UserCog, UserCircle, Search, RefreshCw, ChevronDown, MoreHorizontal } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  const fetchUsers = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`/api/v1/admin/users?search=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await fetchUsers(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleUpdate = async (userId, role, tier) => {
    setUpdating(userId);
    try {
      await axios.post('/api/v1/admin/users/update', { user_id: userId, role, tier });
      await fetchUsers(search);
    } catch {
      console.error('Failed to update user');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Identity Nexus</h1>
          <p className="text-zinc-500 text-xs font-medium mt-1">Manage and audit neural actor privileges and access signatures.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Query ID or Email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pro-input pl-9 w-64 !py-1.5 !text-xs"
              />
           </div>
           <button 
             onClick={() => fetchUsers(search)}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-500 hover:text-white transition-all"
             aria-label="Refresh list"
           >
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </header>

      <div className="pro-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="pro-table-header">
                <th className="px-6 py-4">Neural Actor</th>
                <th className="px-6 py-4">Signature</th>
                <th className="px-6 py-4">Privilege</th>
                <th className="px-6 py-4">Tier</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-32">
                     <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Synchronizing Buffer...</span>
                     </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-32 text-center">
                     <div className="flex flex-col items-center gap-2 opacity-40">
                        <UserCircle size={32} className="text-zinc-600" />
                        <span className="text-xs font-medium text-zinc-500 italic">No matching identities identified.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="pro-table-row group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 group-hover:border-brand-primary/50 transition-all">
                           <UserCircle size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-zinc-100 truncate">{u.email}</span>
                          <span className="text-[10px] text-zinc-500 font-mono tracking-tighter uppercase truncate opacity-60 font-bold tracking-widest">{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] bg-zinc-950 px-2 py-1 rounded border border-zinc-800 text-emerald-500 font-mono tracking-wider">
                          {u.api_key.substring(0, 8)}••••••••
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                      ) : u.role === 'staff' ? (
                        <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                      ) : (
                        <span className="pro-badge bg-zinc-800 border-zinc-700 text-zinc-400">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.tier === 'pro' ? (
                        <span className="pro-badge bg-brand-primary/10 border-brand-primary/20 text-brand-primary">Pro Node</span>
                      ) : (
                        <span className="pro-badge bg-zinc-800 border-zinc-700 text-zinc-500">Lite</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={updating === u.id || u.role === 'admin'}
                          onClick={() => handleUpdate(u.id, u.role === 'user' ? 'staff' : 'user', u.tier)}
                          className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all disabled:opacity-20"
                          title="Toggle Staff Role"
                        >
                          <UserCog size={14} />
                        </button>
                        <button 
                          disabled={updating === u.id || u.role === 'admin'}
                          onClick={() => handleUpdate(u.id, u.role, u.tier === 'free' ? 'pro' : 'free')}
                          className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-brand-primary transition-all disabled:opacity-20"
                          title="Toggle Tier"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all">
                           <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AdminUsers;