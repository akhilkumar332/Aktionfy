import { Link } from 'react-router-dom';
import { Globe, Shield, Mail, ArrowRight, Zap, Activity } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-obsidian-900 text-white pt-32 pb-12 border-t border-white/5 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-primary/5 blur-[120px] rounded-full -z-0"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
          {/* Brand & Mission */}
          <div className="space-y-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-brand-primary/10 p-2 rounded-xl border border-brand-primary/20 group-hover:scale-110 transition-transform">
                <img src="/logo-icon.svg" className="w-8 h-8" alt="Aktionfy Logo" />
              </div>
              <span className="font-black text-2xl tracking-tighter text-white">Aktionfy</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs font-medium">
              The neural backbone for persistent task orchestration. Engineered for the future of decentralized AI intelligence.
            </p>
            <div className="flex gap-4">
              {[Globe, Shield, Mail].map((Icon, i) => (
                <a key={i} href="#" className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group">
                  <Icon size={18} className="text-slate-400 group-hover:text-brand-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Deep Links */}
          <div className="space-y-8">
            <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] opacity-50">Infrastructure</h4>
            <ul className="space-y-5">
              {['Features', 'Intelligence', 'Protocol', 'Dashboard', 'Security'].map((link) => (
                <li key={link}>
                  <Link to={`/#${link.toLowerCase()}`} className="text-slate-400 hover:text-white transition-all text-[13px] font-bold flex items-center gap-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary scale-0 group-hover:scale-100 transition-transform"></div>
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Knowledge Base */}
          <div className="space-y-8">
            <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] opacity-50">Resources</h4>
            <ul className="space-y-5">
              {['Documentation', 'API Guide', 'Architecture', 'Status', 'Research'].map((link) => (
                <li key={link}>
                  <Link to="/docs/overview" className="text-slate-400 hover:text-white transition-all text-[13px] font-bold flex items-center gap-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary scale-0 group-hover:scale-100 transition-transform"></div>
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter Terminal */}
          <div className="space-y-8">
            <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] opacity-50">Neural Updates</h4>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">Join 20k+ engineers receiving weekly insights into AI automation.</p>
            <form className="relative group">
              <input 
                type="email" 
                placeholder="Enter Identity (Email)" 
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-sm outline-none focus:border-brand-primary/50 transition-all font-mono placeholder:text-slate-700"
              />
              <button className="absolute right-2 top-2 bottom-2 bg-brand-primary text-white px-4 rounded-xl hover:brightness-110 transition-all active:scale-95 flex items-center justify-center">
                <ArrowRight size={20} />
              </button>
            </form>
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 px-4 py-3 rounded-2xl">
               <div className="relative">
                  <Activity size={14} className="text-emerald-500" />
                  <div className="absolute inset-0 bg-emerald-500 blur-md opacity-50 animate-pulse"></div>
               </div>
               <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Core Status: Nominal</span>
            </div>
          </div>
        </div>

        {/* Legal & Meta */}
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Aktionfy Labs.
            </p>
            <div className="h-4 w-px bg-white/5 hidden md:block"></div>
            <div className="flex items-center gap-2 text-slate-600 text-[10px] font-bold">
               <Zap size={10} className="text-brand-primary" /> Distributed via Global Reaper Network
            </div>
          </div>
          
          <div className="flex gap-10">
            {['Privacy', 'Terms', 'SLA', 'Cookies'].map((link) => (
              <a key={link} href="#" className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors relative group">
                {link}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-slate-500 group-hover:w-full transition-all"></span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;