import { Terminal, Globe, Monitor, History, RefreshCw } from 'lucide-react';

const AccessLogsViewer = ({ 
  loginHistory, 
  historyLoading, 
  parseUserAgent 
}) => {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="pro-table-header border-b border-zinc-800">
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Actor Account</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Timestamp</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Network IP Address</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Client Signature</th>
            <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {historyLoading && loginHistory.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-32">
                 <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing Access Ledgers...</span>
                 </div>
              </td>
            </tr>
          ) : loginHistory.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-32 text-center">
                 <div className="flex flex-col items-center gap-2 opacity-40">
                    <History size={32} className="text-zinc-850 mx-auto mb-2" />
                    <span className="text-xs font-medium text-zinc-400 italic">No access events logged.</span>
                 </div>
              </td>
            </tr>
          ) : (
            loginHistory.map((lh, index) => (
              <tr key={lh.id?.String || lh.id || `access-log-${index}`} className="pro-table-row hover:bg-zinc-900/10">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                       <Terminal size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-zinc-200 truncate">{lh.user_email?.String || lh.user_email || 'Autonomous Node'}</span>
                      <span className="text-[9px] text-zinc-500 font-mono truncate">{lh.user_id}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-300 font-semibold">
                  {lh.login_time?.Time ? new Date(lh.login_time.Time).toLocaleString() : 'Unknown Cycle'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <Globe size={12} className="text-zinc-600" />
                    {lh.ip_address?.String || lh.ip_address || 'Local Socket'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                    <Monitor size={12} className="text-zinc-600" />
                    {parseUserAgent(lh.user_agent?.String || lh.user_agent)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {lh.status === 'success' ? (
                    <span className="pro-badge bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Granted</span>
                  ) : (
                    <span className="pro-badge bg-red-500/10 border-red-500/20 text-red-400">Denied</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AccessLogsViewer;
