const STATUS_CONFIG = {
  // Task statuses
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  processing: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  error: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  halted: 'bg-rose-500/20 text-rose-400 border-rose-500/30',

  // Roles
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  staff: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',

  // Tiers
  pro: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  plus: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  free: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',

  // Other specific usages
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failure: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  default: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const StatusBadge = ({ status, type = 'default', className = '' }) => {
  const normalizedStatus = (status || '').toString().toLowerCase();
  
  // Try to match exact status, then fallback to type if provided, else default
  const configKey = STATUS_CONFIG[normalizedStatus] ? normalizedStatus : 
                    STATUS_CONFIG[type] ? type : 'default';
  
  const colorClasses = STATUS_CONFIG[configKey];

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border ${colorClasses} ${className}`}>
      {status || type}
    </span>
  );
};

export default StatusBadge;
