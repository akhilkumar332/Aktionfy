import { Link } from 'react-router-dom';
import { Terminal, ArrowRight, ShieldCheck, Sparkles, Command, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import Scene3D from './Scene3D';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-obsidian-950">
      {/* Neural Network Background Decor - Moved outside container */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-primary/5 via-transparent to-obsidian-950"></div>
      
      {/* Side Glows - Moved outside container */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-[160px] animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-1/4 -right-64 w-[800px] h-[800px] bg-brand-secondary/5 rounded-full blur-[160px] animate-pulse duration-[8s] delay-1000"></div>
      </div>

      {/* Immersive 3D/Visual Component - Moved outside container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 2 }}
        className="absolute inset-0 -z-10 opacity-40 pointer-events-none"
      >
         <Scene3D />
      </motion.div>

      <div className="container mx-auto px-6 relative z-20 pt-20">
        <div className="flex flex-col items-center text-center">
          
          {/* AI Badge - Staggered Entry */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="inline-flex items-center gap-3 py-2.5 px-6 mb-12 text-[10px] font-black tracking-[0.4em] text-brand-primary uppercase bg-white/[0.03] border border-white/10 rounded-full backdrop-blur-xl shadow-2xl"
          >
            <div className="relative">
               <Sparkles size={14} className="animate-pulse" />
               <div className="absolute inset-0 bg-brand-primary blur-md opacity-50 animate-pulse"></div>
            </div>
            The Neural Backbone of Autonomous AI
          </motion.div>

          {/* Epic Headline - High-Impact Typography */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 text-7xl md:text-[10rem] font-black text-white tracking-tighter leading-[0.8] max-w-7xl"
          >
            Automate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-white to-brand-secondary animate-gradient-x">Everything.</span>
          </motion.h1>

          {/* Visionary Subheadline */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1.5 }}
            className="mb-16 text-xl md:text-3xl text-slate-500 font-bold leading-relaxed max-w-4xl text-balance tracking-tight"
          >
            A world-class state machine for Model Context Protocol. <br className="hidden md:block" />
            <span className="text-slate-300">Durable scheduling. High-fidelity observability. Autonomous swarm logic.</span>
          </motion.p>

          {/* Premium CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="flex flex-col sm:flex-row justify-center gap-6 mb-32"
          >
            <Link 
              to="/signup" 
              className="shimmer-button group relative px-14 py-6 text-white font-black uppercase tracking-[0.2em] text-xs bg-brand-primary rounded-[2rem] hover:brightness-110 transition-all shadow-[0_20px_60px_rgba(217,119,6,0.4)] flex items-center gap-4 active:scale-95 overflow-hidden"
            >
              Initialize Node <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#installation" 
              className="px-14 py-6 text-slate-400 font-black uppercase tracking-[0.2em] text-xs bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 hover:text-white transition-all flex items-center gap-4 backdrop-blur-xl active:scale-95 shadow-2xl"
            >
              <Terminal size={18} className="text-brand-primary" /> Integration Guide
            </a>
          </motion.div>
        </div>

        {/* Immersive 3D/Visual Component */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-40 pointer-events-none"
        >
           <Scene3D />
        </motion.div>
      </div>

      {/* Real-time Telemetry Bar */}
      <div className="absolute bottom-12 left-0 right-0 z-30">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24">
             <div className="flex items-center gap-4 text-[10px] font-black tracking-[0.3em] text-slate-600 uppercase group hover:text-white transition-colors">
               <ShieldCheck size={16} className="text-brand-primary group-hover:animate-pulse" /> Distributed Consensus
             </div>
             <div className="h-4 w-px bg-white/5 hidden md:block"></div>
             <div className="flex items-center gap-4 text-[10px] font-black tracking-[0.3em] text-slate-600 uppercase group hover:text-white transition-colors">
                <Command size={16} className="text-brand-primary group-hover:rotate-90 transition-transform" /> Model Agnostic
             </div>
             <div className="h-4 w-px bg-white/5 hidden md:block"></div>
             <div className="flex items-center gap-4 text-[10px] font-black tracking-[0.3em] text-slate-600 uppercase group hover:text-white transition-colors">
               <Activity size={16} className="text-brand-primary group-hover:scale-125 transition-transform" /> Real-time Telemetry
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;