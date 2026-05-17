import { Link } from 'react-router-dom';
import { Globe, Shield, Mail, Zap, Activity, Command } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-zinc-950 text-zinc-400 py-12 border-t border-zinc-800 mt-auto">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center transition-all group-hover:border-brand-primary/50">
                <Command size={14} className="text-brand-primary" />
              </div>
              <span className="font-bold text-white tracking-tight">Aktionfy</span>
            </Link>
            <p className="text-xs leading-relaxed max-w-xs font-medium">
              Precision orchestration for high-performance AI task delivery and swarm synchronization.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Platform</h4>
            <ul className="space-y-2">
              {['Infrastructure', 'Pricing', 'Security', 'Enterprise'].map((item) => (
                <li key={item}>
                  <Link to={`/#${item.toLowerCase()}`} className="text-xs hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Documentation</h4>
            <ul className="space-y-2">
              {['Overview', 'API Guide', 'Concepts', 'Reaper Spec'].map((item) => (
                <li key={item}>
                  <Link to="/docs/overview" className="text-xs hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">System Pulse</h4>
            <div className="flex flex-col gap-3">
               <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-lg w-fit">
                  <div className="relative">
                     <Activity size={14} className="text-emerald-500" />
                     <div className="absolute inset-0 bg-emerald-500 blur-md opacity-20 animate-pulse"></div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">Core Status: Nominal</span>
               </div>
               <div className="flex gap-2">
                  {[Globe, Shield, Mail].map((Icon, i) => (
                    <a key={i} href="#" className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all text-zinc-500 hover:text-white">
                      <Icon size={14} />
                    </a>
                  ))}
                </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
              &copy; {new Date().getFullYear()} Aktionfy Labs
            </p>
            <div className="hidden md:flex items-center gap-2 text-zinc-600 text-[9px] font-bold uppercase tracking-widest">
               <Zap size={10} className="text-brand-primary" /> Multi-Region Deployment Active
            </div>
          </div>
          
          <div className="flex gap-8">
            {['Privacy', 'Terms', 'Legal'].map((link) => (
              <a key={link} href="#" className="text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;