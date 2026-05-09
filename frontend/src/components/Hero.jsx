import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Terminal, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Scene3D from './Scene3D';

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden bg-paper-50 min-h-screen flex items-center">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Content */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-start text-left max-w-2xl"
          >
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center gap-2 py-1.5 px-4 mb-8 text-xs font-bold tracking-widest text-accent-orange uppercase bg-orange-100/50 border border-orange-200 rounded-full"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-orange"></span>
              </span>
              Enterprise-Grade Scheduling for MCP
            </motion.div>

            {/* Headline */}
            <h1 className="mb-8 text-6xl md:text-7xl font-bold font-sans text-ink-900 tracking-tighter leading-[0.95]">
              Master <span className="text-accent-orange italic underline decoration-orange-200 underline-offset-8">Time</span> in the AI Era.
            </h1>

            {/* Subheadline */}
            <p className="mb-10 text-xl text-slate-600 font-medium leading-relaxed">
              Schedule tasks, set durable reminders, and orchestrate complex AI workflows that survive node failures and client drops.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-5 mb-12">
              <Link 
                to="/signup" 
                className="group px-10 py-5 text-white font-bold bg-ink-900 rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center gap-3 active:scale-95"
              >
                Get Started Free <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a 
                href="#installation" 
                className="px-10 py-5 text-ink-900 font-bold bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-3 shadow-sm active:scale-95"
              >
                <Terminal size={20} /> View Setup
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center gap-8 opacity-40 grayscale group-hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-2 font-bold text-sm">
                 <ShieldCheck size={18} /> SOC2 Compliant
               </div>
               <div className="flex items-center gap-2 font-bold text-sm">
                 <Clock size={18} /> 99.9% Uptime
               </div>
            </div>
          </motion.div>

          {/* Right Column: 3D Scene */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
            className="relative hidden lg:block"
          >
            <Scene3D />
          </motion.div>
        </div>

        {/* Visual Element: Terminal Mockup (Floating) */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="w-full max-w-6xl mx-auto mt-20 relative group"
        >
          <div className="absolute inset-0 bg-accent-orange/10 blur-[120px] rounded-full group-hover:bg-accent-orange/20 transition-colors duration-700"></div>
          <div className="relative bg-[#141413] rounded-3xl border border-white/10 shadow-2xl overflow-hidden aspect-video md:aspect-[21/9] flex flex-col">
            <div className="flex items-center gap-1.5 px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
              <div className="ml-4 text-xs font-mono text-slate-500 tracking-widest uppercase">system_log --stream</div>
            </div>
            <div className="flex-1 p-8 font-mono text-sm text-slate-400 overflow-hidden">
              <div className="space-y-1">
                <div className="flex gap-4">
                  <span className="text-emerald-500">[08:00:00]</span>
                  <span>Triggering "Daily Market Analysis" (task_id: 8f2a...)</span>
                </div>
                <div className="flex gap-4 text-blue-400">
                  <span className="text-blue-500">[08:00:02]</span>
                  <span>Sampling LLM via Claude Desktop session...</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-blue-500">[08:00:15]</span>
                  <span>LLM Response received: "Market trend is bullish based on current indicators..."</span>
                </div>
                <div className="flex gap-4 text-emerald-400 font-bold">
                  <span className="text-emerald-500">[08:00:16]</span>
                  <span>Task success. Next run scheduled for tomorrow.</span>
                </div>
                <div className="flex gap-4 mt-4 text-amber-500">
                  <span className="text-amber-500">[09:30:00]</span>
                  <span>Retrying "System Backup" (Attempt 2/3)...</span>
                </div>
                <div className="flex gap-4 opacity-50 italic">
                  <span>... monitoring node cluster node-01-a ...</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Decorative Blur */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-orange/5 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-ink-900/5 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2"></div>
    </section>
  );
};

export default Hero;
