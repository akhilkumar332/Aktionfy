import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthForm = ({ 
  title, 
  subtitle, 
  onSubmit, 
  isSubmitting, 
  error, 
  children, 
  submitText, 
  alternateLinkText, 
  alternateLinkTo,
  alternateLinkMessage
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-secondary/10 blur-[120px]" />

      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 mb-4 shadow-lg">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-brand-primary to-brand-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-400 mt-2">{subtitle}</p>
        </div>

        <div className="glass-surface rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {error && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {children}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-primary/20 mt-6"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {isSubmitting ? 'Processing...' : submitText}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-sm text-zinc-400">
              {alternateLinkMessage}{' '}
              <Link to={alternateLinkTo} className="text-brand-primary font-medium hover:text-indigo-400 transition-colors">
                {alternateLinkText}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthForm;
