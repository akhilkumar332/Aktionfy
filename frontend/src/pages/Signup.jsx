import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ArrowRight, Command } from 'lucide-react';
import { motion } from 'framer-motion';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await signup(email, password);
    if (res.success) {
      navigate('/login?message=Neural+Identity+Generated');
    } else {
      setError(res.error || 'Failed to initialize identity');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden px-6">
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[160px] pointer-events-none translate-x-1/4 translate-y-1/4"></div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-zinc-900 border border-zinc-800 p-10 md:p-14 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="flex flex-col items-center mb-12">
            <Link to="/" className="group relative mb-8 pro-focus rounded-2xl p-1">
               <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-2xl text-brand-primary relative z-10 shadow-lg group-hover:-rotate-12 transition-transform duration-500">
                 <UserPlus size={28} />
               </div>
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight text-center">Join the Network</h1>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em] text-center mt-2">Neural Identity Initialization</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 text-red-400 p-4 rounded-xl mb-8 text-[11px] font-bold border border-red-500/20 text-center uppercase tracking-widest"
            >
              Initialization Error: {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Desired Identity (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800 shadow-inner"
                placeholder="identity@network.io"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Secure Protocol Key (Password)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800 shadow-inner"
                placeholder="••••••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full pro-button-primary !py-4 uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 shadow-indigo-900/40 disabled:opacity-50"
            >
              {submitting ? 'Initializing...' : 'Request Initialization'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col items-center gap-4">
             <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
               Already provisioned?{' '}
               <Link to="/login" className="text-white hover:text-brand-primary transition-colors underline underline-offset-4">
                 Authenticate
               </Link>
             </p>
             <div className="flex items-center gap-2 text-zinc-700 text-[9px] font-black uppercase tracking-[0.2em]">
                <Command size={12} className="text-brand-primary" /> Multi-Region Deployment
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;