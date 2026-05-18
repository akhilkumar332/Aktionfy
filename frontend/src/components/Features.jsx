import { Layers, Shield, Zap, Cpu, Repeat, ExternalLink, GitMerge, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';

const Features = () => {
  const features = [
    {
      title: 'Contextual Chaining',
      description: 'Create multi-step AI pipelines. Completion of one task immediately triggers the next, automatically threading output context between executions.',
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20'
    },
    {
      title: 'Neural Secret Vault',
      description: 'Store API keys once and reuse them across all tasks. AES-256-GCM encrypted persistence ensures your credentials are never exposed.',
      icon: Shield,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    {
      title: 'Persistent Scheduling',
      description: 'Durable task queues with sub-second precision. Even if your entire worker cluster restarts, your schedules resume exactly where they left off.',
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    {
      title: 'Human-in-the-Loop',
      description: 'Optional manual approval workflows for sensitive tasks. Pause execution and approve actions directly from your live command hub.',
      icon: Cpu,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20'
    },
    {
      title: 'Real-time Telemetry',
      description: 'Fully manage tasks, secrets, and webhooks via a beautiful GUI. Monitor AI responses in real-time with high-fidelity operational streams.',
      icon: Zap,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20'
    },
    {
      title: 'Outbound Neural Hooks',
      description: 'Integrate AI results into your own apps. Receive HTTP POST notifications whenever a scheduled task completes or fails.',
      icon: ExternalLink,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
    },
    {
      title: 'Auto-Recovery Reaper',
      description: 'Built-in node reapers and dead letter queues. Failed tasks are automatically recovered or escalated based on custom policies.',
      icon: Repeat,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
    },
    {
      title: 'Multi-Path Branching',
      description: 'Intelligent decision nodes that route execution based on LLM analysis or custom JS logic. Build dynamic self-healing workflows.',
      icon: GitMerge,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20'
    },
    {
       title: 'Encrypted Identity',
       description: 'End-to-end identity verification and RBAC. Secure your neural infrastructure with professional-grade access controls.',
       icon: Fingerprint,
       color: 'text-zinc-400',
       bg: 'bg-zinc-900/50',
       border: 'border-zinc-800'
    }
  ];

  return (
    <section id="features" className="py-40 bg-zinc-950 relative overflow-hidden">
      {/* Dynamic Background decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-primary/10 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-secondary/10 rounded-full blur-[160px] animate-pulse delay-1000"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto text-center mb-32"
        >
          <div className="inline-flex items-center gap-3 py-2 px-6 mb-8 text-[10px] font-black tracking-[0.4em] text-brand-primary uppercase bg-zinc-900/50 border border-zinc-800 rounded-full backdrop-blur-xl">
             Autonomous Capabilities
          </div>
          <h2 className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tighter leading-[0.9]">
            The Backbone of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-400 to-slate-700">Decentralized Intelligence.</span>
          </h2>
          <p className="text-xl md:text-2xl text-zinc-500 font-bold max-w-3xl mx-auto leading-relaxed tracking-tight">
            Industrial-grade orchestration engineered for developers who demand absolute reliability from their AI automation layer.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, index) => (
            <motion.div 
              key={f.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.5 }}
              className={`group relative p-12 rounded-[3.5rem] border bg-zinc-900/30 backdrop-blur-3xl ${f.border} hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-700 overflow-hidden shadow-2xl`}
            >
              {/* Card Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/50 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              <div className="relative z-10">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-12 ${f.bg} border border-zinc-800/50 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl`}>
                  <f.icon className={`w-8 h-8 ${f.color}`} />
                </div>
                <h3 className="text-2xl font-black text-white mb-6 tracking-tight uppercase">{f.title}</h3>
                <p className="text-zinc-400 leading-relaxed font-medium text-base opacity-80 group-hover:opacity-100 transition-opacity">
                  {f.description}
                </p>
              </div>
              
              <div className="mt-12 pt-8 border-t border-zinc-800/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                 <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Protocol V3.4</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Clock = ({ className }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default Features;