import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Activity, Command, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/#pricing' },
    { name: 'Docs', href: '/docs/overview' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled ? 'py-4 nexus-blur bg-obsidian-950/60 border-b border-white/5' : 'py-8 bg-transparent'
    }`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group relative">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full group-hover:bg-brand-primary/40 transition-all"></div>
              <img src="/logo-icon.svg" className="w-10 h-10 relative z-10 group-hover:rotate-[360deg] transition-transform duration-700" alt="Aktionfy Logo" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl text-white tracking-tighter leading-tight group-hover:text-brand-primary transition-colors">Aktionfy</span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] leading-tight">Neural Engine</span>
            </div>
          </Link>

          {/* Premium Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <div className="flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-[11px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-all relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-300"></span>
                </Link>
              ))}
            </div>
            
            <div className="h-6 w-px bg-white/10"></div>

            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="group relative text-[11px] font-black uppercase tracking-widest text-white bg-white/5 border border-white/10 px-8 py-3 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3 shadow-2xl overflow-hidden"
                >
                   <div className="absolute inset-0 bg-brand-primary/5 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <Activity size={14} className="text-brand-primary animate-pulse relative z-10" />
                  <span className="relative z-10">Command Hub</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[11px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-colors"
                  >
                    Identity
                  </Link>
                  <Link
                    to="/signup"
                    className="shimmer-button relative px-10 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white bg-brand-primary rounded-2xl hover:brightness-110 transition-all shadow-[0_10px_40px_rgba(217,119,6,0.3)] active:scale-95"
                  >
                    Initialize
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-3 bg-white/5 rounded-2xl border border-white/10 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 z-[60] bg-obsidian-950/95 backdrop-blur-3xl flex flex-col p-10"
          >
            <div className="flex justify-between items-center mb-20">
               <div className="flex items-center gap-3">
                  <img src="/logo-icon.svg" className="w-10 h-10" alt="Aktionfy Logo" />
                  <span className="font-black text-2xl tracking-tighter">Aktionfy</span>
               </div>
               <button 
                 onClick={() => setIsMobileMenuOpen(false)} 
                 className="p-3 bg-white/5 rounded-2xl"
                 aria-label="Close menu"
               >
                  <X size={24} />
               </button>
            </div>

            <div className="flex flex-col gap-10">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-4xl font-black text-white tracking-tighter flex items-center justify-between group"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                  <ChevronRight className="text-brand-primary group-hover:translate-x-2 transition-transform" />
                </Link>
              ))}
            </div>

            <div className="mt-auto space-y-6">
              <div className="h-px bg-white/5"></div>
              {user ? (
                <Link
                  to="/dashboard"
                  className="w-full flex items-center justify-center gap-4 bg-brand-primary text-white py-6 rounded-[2rem] font-black uppercase tracking-widest"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Command size={20} />
                  Command Hub
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                   <Link
                    to="/login"
                    className="flex items-center justify-center border border-white/10 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Identity
                  </Link>
                  <Link
                    to="/signup"
                    className="flex items-center justify-center bg-brand-primary text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px]"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Initialize
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;