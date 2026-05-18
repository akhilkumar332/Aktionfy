import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Command, ChevronRight } from 'lucide-react';
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
    { name: 'Docs', href: '/docs/overview' },
    { name: 'Pricing', href: '/#pricing' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b ${
      isScrolled 
        ? 'py-3 bg-zinc-950/80 backdrop-blur-md border-zinc-800' 
        : 'py-5 bg-transparent border-transparent'
    }`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center transition-all group-hover:border-brand-primary/50">
              <Command size={18} className="text-brand-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Aktionfy</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
            
            <div className="h-4 w-px bg-zinc-800"></div>

            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="pro-button-primary !py-2 !px-5"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="pro-button-primary !py-2 !px-5"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute top-full left-0 right-0 bg-zinc-950 border-b border-zinc-800 p-6 shadow-lg"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-lg font-semibold text-zinc-300 hover:text-white flex items-center justify-between"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                  <ChevronRight size={18} className="text-zinc-300" />
                </Link>
              ))}
              <div className="h-px bg-zinc-800 my-2"></div>
              {user ? (
                <Link
                  to="/dashboard"
                  className="pro-button-primary !py-4 text-center text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                   <Link
                    to="/login"
                    className="pro-button-secondary !py-4 text-center text-base"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="pro-button-primary !py-4 text-center text-base"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
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