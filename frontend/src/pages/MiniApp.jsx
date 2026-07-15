import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, CheckCircle, Zap, LayoutGrid } from 'lucide-react';
import axios from 'axios';
import { useNotify } from '../context/NotificationContext';

export default function MiniApp() {
  const { taskId } = useParams();
  const { notify } = useNotify();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [inputs, setInputs] = useState('');

  useEffect(() => {
    // In a real app, this would be a public endpoint. For now, we fetch as authenticated user.
    const fetchTask = async () => {
      try {
        const res = await axios.get(`/api/v1/tasks`);
        if (res.data.success) {
          const found = res.data.data.find(t => t.id === taskId);
          if (found) setTask(found);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  const handleExecute = async (e) => {
    e.preventDefault();
    setExecuting(true);
    setResult(null);

    try {
      let payload = {};
      if (inputs) {
        try {
          payload = JSON.parse(inputs);
        } catch {
          payload = { raw_input: inputs };
        }
      }

      const res = await axios.post(`/api/v1/tasks/${taskId}/execute`, payload);
      
      // Simulate processing time for UX
      setTimeout(() => {
        setResult(res.data);
        notify('SUCCESS', 'Execution Complete');
        setExecuting(false);
      }, 1500);
      
    } catch (err) {
      notify('ERROR', 'Execution failed', err.response?.data?.error || err.message);
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-brand-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] text-zinc-400 font-black uppercase tracking-[0.3em] animate-pulse">Initializing App...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <p>App not found or unavailable.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[500px] bg-brand-primary/10 blur-[120px] pointer-events-none rounded-full -translate-y-1/2"></div>
      
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 relative z-10 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <LayoutGrid className="text-brand-primary" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-widest">{task.name}</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Powered by Aktionfy</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl"
        >
          <div className="pro-glass-panel p-8 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.6)] border-white/5">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                <Zap size={28} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">Execute Workflow</h2>
              <p className="text-sm text-zinc-400 font-medium">Provide the necessary parameters to initialize this sequence.</p>
            </div>

            <form onSubmit={handleExecute} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Input Payload (JSON or Text)</label>
                <textarea 
                  value={inputs}
                  onChange={(e) => setInputs(e.target.value)}
                  placeholder="Enter input data here..."
                  className="w-full pro-input !py-4 h-32 font-mono !text-xs shadow-inner resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={executing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-4 font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(79,70,229,0.3)] disabled:opacity-50"
              >
                {executing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run App
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 bg-zinc-900 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="text-emerald-500" size={18} />
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Execution Result</h3>
                    </div>
                    <pre className="text-xs text-zinc-300 font-mono bg-black/40 p-4 rounded-xl overflow-x-auto border border-white/5">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
