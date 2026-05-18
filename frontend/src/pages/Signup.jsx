import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ArrowRight, Command } from 'lucide-react';
import { motion } from 'framer-motion';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await signup(email, password);
    if (res.success) {
      navigate('/login?message=Account+created+successfully');
    } else {
      setError(res.error || 'Failed to create account');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden px-6">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-[160px] pointer-events-none translate-x-1/4 translate-y-1/4"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="glass-card p-12 md:p-16 rounded-[4rem] border-zinc-800/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="flex flex-col items-center mb-16">
            <Link to="/" className="group relative mb-10">
               <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
               <div className="bg-brand-primary/10 border border-brand-primary/20 p-4 rounded-3xl text-brand-primary relative z-10 shadow-2xl group-hover:rotate-[360deg] transition-transform duration-1000">
                 <UserPlus size={32} />
               </div>
            </Link>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-3 text-center">Join the Network.</h1>
            <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px] text-center">Initialize Neural Identity</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 text-red-400 p-5 rounded-2xl mb-10 text-[10px] font-black border border-red-500/20 text-center uppercase tracking-[0.2em]"
            >
              Initialization Failed: {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Desired Identity</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 px-8 py-6 rounded-[2rem] border border-zinc-800/50 text-white focus:border-brand-primary/50 outline-none transition-all placeholder:text-zinc-800 font-medium shadow-inner"
                placeholder="identity@network.io"
                required
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Generate Key</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 px-8 py-6 rounded-[2rem] border border-zinc-800/50 text-white focus:border-brand-primary/50 outline-none transition-all placeholder:text-zinc-800 font-medium shadow-inner"
                placeholder="••••••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              className="shimmer-button w-full bg-brand-primary text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-[0_20px_50px_rgba(217,119,6,0.3)] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              Request Initialization <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-16 pt-10 border-t border-zinc-800/50 flex flex-col items-center gap-6">
             <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em]">
               Already initialized?{' '}
               <Link to="/login" className="text-white hover:text-brand-primary transition-colors underline underline-offset-8">
                 Authenticate
               </Link>
             </p>
             <div className="flex items-center gap-2 text-zinc-700 text-[9px] font-bold uppercase tracking-widest bg-zinc-100/[0.02] px-4 py-2 rounded-full border border-zinc-800/50">
                <Command size={12} className="text-brand-primary" /> Multi-Region Deployment
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;