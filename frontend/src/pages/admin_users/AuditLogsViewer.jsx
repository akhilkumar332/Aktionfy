import { RefreshCw, Info, Activity, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AuditLogsViewer = ({
  auditLoading,
  auditLimit,
  setAuditLimit,
  filteredAuditLogs,
  expandedLogId,
  setExpandedLogId,
  resolveAuditVisuals
}) => {
  return (
    <div className="space-y-4">
      <div className="pro-card p-6 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium">
            Displaying up to <strong className="text-zinc-200">{auditLimit}</strong> recent system audit actions. Use search to filter surgically.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="audit-limit-select" className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Limit:</label>
          <select
            id="audit-limit-select"
            value={auditLimit}
            onChange={(e) => setAuditLimit(parseInt(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 font-mono focus:border-brand-primary outline-none"
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>
      </div>

      <div className="pro-card divide-y divide-zinc-800/60 overflow-hidden">
        {auditLoading && filteredAuditLogs.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-zinc-700 animate-spin" />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest animate-pulse">Syncing System Activity Ledgers...</span>
          </div>
        ) : filteredAuditLogs.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-2">
            <Activity size={32} className="text-zinc-700 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 italic">No matching activities found.</span>
          </div>
        ) : (
          filteredAuditLogs.map((log) => {
            const visuals = resolveAuditVisuals(log.action);
            const Icon = visuals.icon;
            const isExpanded = expandedLogId === log.id;
            
            return (
              <div key={log.id} className="p-5 hover:bg-zinc-900/10 transition-colors flex flex-col gap-3 group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${visuals.color}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-300 font-mono">{log.action}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md font-bold">{log.resource_type}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Actor: <strong className="text-zinc-200">{log.user_id || 'Autonomous Engine'}</strong></span>
                        {log.resource_id && (
                          <>
                            <span className="text-zinc-600 font-bold">•</span>
                            <span>Target: <strong className="text-zinc-300 font-mono">{log.resource_id}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <span className="text-[10px] text-zinc-500 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                    {Object.keys(log.metadata || {}).length > 0 && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-all cursor-pointer"
                        title="Toggle metadata payload"
                      >
                        <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90 text-brand-primary' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && log.metadata && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-1"
                    >
                      <pre className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg text-[10px] font-mono text-zinc-300 overflow-x-auto custom-scrollbar leading-relaxed">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditLogsViewer;
