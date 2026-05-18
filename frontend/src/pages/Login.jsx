import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Command } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(email, password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Invalid credentials');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden px-6">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-[160px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-zinc-900 border border-zinc-800 p-10 md:p-14 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col items-center mb-12">
            <Link to="/" className="group relative mb-8 pro-focus rounded-2xl p-1">
               <div className="bg-brand-primary p-3 rounded-2xl text-white relative z-10 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                 <Command size={28} />
               </div>
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight text-center">Welcome Back</h1>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em] text-center mt-2">Neural Identity Authentication</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 text-red-400 p-4 rounded-xl mb-8 text-[11px] font-bold border border-red-500/20 text-center uppercase tracking-widest"
            >
              Access Denied: {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800"
                placeholder="identity@network.io"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Access Key</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800"
                placeholder="••••••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full pro-button-primary !py-4 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 shadow-indigo-900/40 disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : 'Establish Connection'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col items-center gap-4">
             <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
               New Actor?{' '}
               <Link to="/signup" className="text-brand-primary hover:text-white transition-colors underline underline-offset-4">
                 Request Identity
               </Link>
             </p>
             <div className="flex items-center gap-2 text-zinc-700 text-[9px] font-black uppercase tracking-[0.2em]">
                <ShieldCheck size={12} className="text-brand-primary" /> End-to-End Encrypted
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;