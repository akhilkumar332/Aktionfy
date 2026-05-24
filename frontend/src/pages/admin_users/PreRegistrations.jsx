import { Trash2, UserPlus, RefreshCw } from 'lucide-react';

const PreRegistrations = ({ 
  invitations, 
  invitationsLoading, 
  handleDeleteInvitation 
}) => {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="pro-table-header border-b border-zinc-800">
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Pre-Registered Email</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Assigned Privilege</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Assigned Tier</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Invitation Token</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Expires At</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {invitationsLoading && invitations.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-6 py-32">
                 <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Invitations...</span>
                 </div>
              </td>
            </tr>
          ) : invitations.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-6 py-32 text-center">
                 <div className="flex flex-col items-center gap-2 opacity-40">
                    <UserPlus size={32} className="text-zinc-600" />
                    <span className="text-xs font-medium text-zinc-400 italic">No pending invitations pre-registered.</span>
                 </div>
              </td>
            </tr>
          ) : (
            invitations.map((inv) => (
              <tr key={inv.id?.String || inv.id || Math.random().toString()} className="pro-table-row hover:bg-zinc-900/10">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-zinc-200">{inv.email}</span>
                </td>
                <td className="px-6 py-4">
                  {inv.role === 'admin' ? (
                    <span className="pro-badge bg-purple-500/10 border-purple-500/20 text-purple-400">Root</span>
                  ) : inv.role === 'staff' ? (
                    <span className="pro-badge bg-blue-500/10 border-blue-500/20 text-blue-400">Staff</span>
                  ) : (
                    <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">User</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {inv.tier === 'pro' ? (
                    <span className="pro-badge bg-indigo-600/10 border-brand-primary/20 text-indigo-400">Pro Node</span>
                  ) : inv.tier === 'plus' ? (
                    <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Plus</span>
                  ) : (
                    <span className="pro-badge bg-zinc-900 border-zinc-800 text-zinc-400">Lite</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <code className="text-[10px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 text-indigo-400 font-mono tracking-wider">
                    {inv.invite_token}
                  </code>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-400 font-medium">
                  {inv.expires_at?.Time ? new Date(inv.expires_at.Time).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDeleteInvitation(inv.id?.String || inv.id)}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-400 transition-all pro-focus cursor-pointer"
                    title="Delete Invitation"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PreRegistrations;
