import { useState, useMemo } from 'react';
import { UserCircle, UserCheck, KeyRound, TrendingUp, UserCog, ChevronDown, Ban, Unlock, Lock, ShieldAlert, RefreshCw, Layers } from 'lucide-react';

const UserTable = ({ 
  users, 
  loading, 
  updating, 
  handleImpersonate, 
  openDrawer, 
  openOverrideModal, 
  handleUpdate, 
  handleRevokeSessions 
}) => {

  const [selectedUsers, setSelectedUsers] = useState(new Set());

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length && users.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  return (
    <div className="overflow-x-auto custom-scrollbar flex flex-col">
      {selectedUsers.size > 0 && (
        <div className="bg-brand-primary/10 border-b border-brand-primary/20 p-3 flex items-center justify-between shadow-inner">
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-2">
             <Layers size={14} /> {selectedUsers.size} Identity(s) Selected
          </span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-md flex items-center gap-1.5 transition-colors shadow-sm">
               <Lock size={10} /> Bulk Lock
            </button>
            <button className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-md flex items-center gap-1.5 transition-colors shadow-sm">
               <Unlock size={10} /> Bulk Unlock
            </button>
            <button className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md flex items-center gap-1.5 transition-colors shadow-sm">
               <Ban size={10} /> Revoke Sessions
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="pro-table-header border-b border-zinc-800">
            <th className="px-6 py-4 w-12 text-center">
              <input 
                type="checkbox" 
                checked={users.length > 0 && selectedUsers.size === users.length} 
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-brand-primary rounded bg-zinc-900 border-zinc-800 cursor-pointer"
              />
            </th>
            <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Neural Actor</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Signature</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Privilege</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Tier</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Account Status</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {loading && users.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-6 py-32">
                 <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Actors...</span>
                 </div>
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-6 py-32 text-center">
                 <div className="flex flex-col items-center gap-2 opacity-40">
                    <UserCircle size={32} className="text-zinc-300" />
                    <span className="text-xs font-medium text-zinc-400 italic">No matching identities identified.</span>
                 </div>
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <tr key={u.id} className={`pro-table-row group transition-colors duration-250 ${selectedUsers.has(u.id) ? 'bg-brand-primary/5' : ''}`}>
                <td className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleSelectUser(u.id)}
                    className="w-4 h-4 accent-brand-primary rounded bg-zinc-900 border-zinc-800 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:border-brand-primary/50 transition-all">
                       <UserCircle size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-zinc-100 truncate">{u.email?.String || u.email || 'Anonymous'}</span>
                      <span className="text-[9px] text-zinc-500 font-mono tracking-tighter uppercase truncate font-bold">{u.id}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 text-emerald-500 font-mono tracking-wider">
                      {u.api_key ? `${u.api_key.substring(0, 8)}...` : 'N/A'}
                    </code>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {u.role?.String === 'admin' || u.role === 'admin' ? (
                    <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                  ) : u.role?.String === 'staff' || u.role === 'staff' ? (
                    <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                  ) : (
                    <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">User</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div>
                      {u.tier?.String === 'pro' || u.tier === 'pro' ? (
                        <span className="pro-badge bg-indigo-600/10 border-brand-primary/20 text-indigo-400">Pro Node</span>
                      ) : u.tier?.String === 'plus' || u.tier === 'plus' ? (
                        <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Plus</span>
                      ) : (
                        <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">Lite</span>
                      )}
                    </div>
                    {((u.max_tasks_limit?.Valid && u.max_tasks_limit.Int32 >= 0) || (u.rate_limit_override?.Valid && u.rate_limit_override.Int32 >= 0)) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {u.max_tasks_limit?.Valid && u.max_tasks_limit.Int32 >= 0 && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-indigo-950/40 border border-indigo-500/30 text-indigo-400 rounded uppercase font-black">
                            Tasks: {u.max_tasks_limit.Int32}
                          </span>
                        )}
                        {u.rate_limit_override?.Valid && u.rate_limit_override.Int32 >= 0 && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded uppercase font-black">
                            Rate: {u.rate_limit_override.Int32}/m
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {u.is_locked?.Bool || u.is_locked ? (
                    <span className="pro-badge bg-red-500/10 border-red-500/20 text-red-400 flex items-center gap-1.5 w-fit">
                      <ShieldAlert size={10} />
                      Locked
                    </span>
                  ) : (
                    <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 w-fit">
                      <Unlock size={10} className="text-emerald-500" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {/* Impersonate User */}
                    <button 
                      disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                      onClick={() => handleImpersonate(u.id)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-400 transition-all disabled:opacity-20 pro-focus cursor-pointer"
                      title="Impersonate Identity"
                    >
                      <UserCheck size={13} />
                    </button>

                    {/* Open Security Settings Drawer */}
                    <button 
                      onClick={() => openDrawer(u)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-brand-primary transition-all pro-focus cursor-pointer"
                      title="Security Credentials Drawer"
                    >
                      <KeyRound size={13} />
                    </button>

                    {/* Quota Overrides */}
                    <button 
                      onClick={() => openOverrideModal(u)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-400 transition-all pro-focus cursor-pointer"
                      title="Quota Overrides"
                    >
                      <TrendingUp size={13} />
                    </button>

                    {/* Staff Role Toggle */}
                    <button 
                      disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                      onClick={() => handleUpdate(u.id, (u.role === 'user' || u.role?.String === 'user') ? 'staff' : 'user', u.tier?.String || u.tier)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-20 pro-focus cursor-pointer"
                      title="Toggle Staff Role"
                    >
                      <UserCog size={13} />
                    </button>

                    {/* Tier Toggle */}
                    <button 
                      disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                      onClick={() => handleUpdate(u.id, u.role?.String || u.role, (u.tier === 'pro' || u.tier?.String === 'pro') ? 'free' : 'pro')}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 transition-all disabled:opacity-20 pro-focus cursor-pointer"
                      title="Toggle Tier"
                    >
                      <ChevronDown size={13} />
                    </button>

                    {/* Invalidate / Revoke Sessions */}
                    <button 
                      onClick={() => handleRevokeSessions(u.id)}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-400 transition-all pro-focus cursor-pointer"
                      title="Revoke Sessions"
                    >
                      <Ban size={13} />
                    </button>

                    {/* Account Lock Toggle */}
                    <button 
                      disabled={updating === u.id || u.role === 'admin' || u.role?.String === 'admin'}
                      onClick={() => handleUpdate(u.id, u.role?.String || u.role, u.tier?.String || u.tier, !(u.is_locked?.Bool || u.is_locked))}
                      className={`p-2 border rounded-xl transition-all disabled:opacity-20 pro-focus ${
                        (u.is_locked?.Bool || u.is_locked)
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-white' 
                          : 'bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-900/40 hover:text-white'
                      }`}
                      title={(u.is_locked?.Bool || u.is_locked) ? "Unlock Account" : "Lock Account"}
                    >
                      {(u.is_locked?.Bool || u.is_locked) ? <Unlock size={13} /> : <Lock size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
