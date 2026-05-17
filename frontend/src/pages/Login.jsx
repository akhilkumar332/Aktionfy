import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Command } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(email, password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-950 relative overflow-hidden px-6">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-[160px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="glass-card p-12 md:p-16 rounded-[4rem] border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="flex flex-col items-center mb-16">
            <Link to="/" className="group relative mb-10">
               <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
               <div className="bg-brand-primary p-4 rounded-3xl text-white relative z-10 shadow-2xl group-hover:rotate-[360deg] transition-transform duration-1000">
                 <Command size={32} />
               </div>
            </Link>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-3 text-center">Welcome Back.</h1>
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] text-center">Initialize Neural Connection</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 text-red-400 p-5 rounded-2xl mb-10 text-[10px] font-black border border-red-500/20 text-center uppercase tracking-[0.2em]"
            >
              Authentication Failed: {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Neural Identity</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 px-8 py-6 rounded-[2rem] border border-white/5 text-white focus:border-brand-primary/50 outline-none transition-all placeholder:text-slate-800 font-medium"
                placeholder="identity@network.io"
                required
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Access Key</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 px-8 py-6 rounded-[2rem] border border-white/5 text-white focus:border-brand-primary/50 outline-none transition-all placeholder:text-slate-800 font-medium"
                placeholder="••••••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              className="shimmer-button w-full bg-white text-obsidian-950 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              Establish Connection <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-16 pt-10 border-t border-white/5 flex flex-col items-center gap-6">
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
               New to the network?{' '}
               <Link to="/signup" className="text-brand-primary hover:text-white transition-colors underline underline-offset-8">
                 Request Access
               </Link>
             </p>
             <div className="flex items-center gap-2 text-slate-700 text-[9px] font-bold uppercase tracking-widest bg-white/[0.02] px-4 py-2 rounded-full border border-white/5">
                <ShieldCheck size={12} className="text-brand-primary" /> End-to-End Encrypted
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;