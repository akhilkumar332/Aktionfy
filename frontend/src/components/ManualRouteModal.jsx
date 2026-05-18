import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ArrowRight, Play } from 'lucide-react';

const ManualRouteModal = ({ isOpen, onClose, task, tasks, onRouted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (isOpen && task?.id && tasks) {
      // Find all tasks that depend on this task
      const dependentTasks = tasks.filter(t => t.depends_on_task_id === task.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBranches(dependentTasks);
    }
  }, [isOpen, task?.id, tasks]);

  if (!isOpen) return null;

  const handleRoute = async (targetTaskId) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`/api/v1/tasks/${task.id}/route`, {
        target_task_id: targetTaskId
      });
      if (onRouted) onRouted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to route task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-8 py-6 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Manual Resolution</h3>
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Routing required</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100/5 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            {task?.task_type === 'swarm_router' ? 'Swarm' : 'Decision'} Node <span className={`font-bold ${task?.task_type === 'swarm_router' ? 'text-purple-400' : 'text-indigo-400'}`}>"{task?.name}"</span> could not automatically determine the next path. Please select a branch to continue execution.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl uppercase tracking-wider">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {branches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-300 italic">No downstream branches found.</div>
              </div>
            ) : (
              branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => handleRoute(branch.id)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-5 bg-zinc-100/5 border border-zinc-800 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <ArrowRight size={18} />
                    </div>
                    <div>
                      <span className="block font-bold text-white text-sm">{branch.name}</span>
                      <span className="block text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">Trigger manually</span>
                    </div>
                  </div>
                  <Play size={18} className="text-zinc-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="px-8 py-6 bg-black/20 border-t border-zinc-800/50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-xs font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualRouteModal;
