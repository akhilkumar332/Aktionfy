import { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, Layout, Boxes, Command, ChevronRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Installation = () => {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      title: 'Provision Workspace',
      description: 'Initialize a secure neural sector and generate your cryptographically signed access key.',
      icon: Layout,
    },
    {
      title: 'Deploy CLI Bridge',
      description: 'Execute the global installer to deploy the Model Context Protocol bridge to your environment.',
      icon: Terminal,
    },
    {
      title: 'Authorize Session',
      description: 'Link the Aktionfy engine to your local configuration using the secure protocol handshaking.',
      icon: Boxes,
    }
  ];

  const installCommand = 'npx @aktionfy/mcp install';
  const configSnippet = `{
  "mcpServers": {
    "aktionfy": {
      "command": "aktionfy",
      "args": ["run"],
      "env": {
        "X-API-KEY": "NEURAL_ACCESS_TOKEN"
      }
    }
  }
}`;

  return (
    <section id="installation" className="py-40 bg-zinc-950 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-3 py-2 px-6 mb-8 text-[10px] font-black tracking-[0.4em] text-brand-primary uppercase bg-zinc-900 border border-zinc-800 rounded-full backdrop-blur-xl">
               Integration Protocol
            </div>
            <h2 className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tighter leading-[0.9]">
              Deployment in <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-amber-200 italic">Seconds.</span>
            </h2>
            <p className="text-xl md:text-2xl text-zinc-300 font-bold mb-16 leading-relaxed max-w-xl tracking-tight">
              Optimized for high-frequency synchronization with Claude Desktop, Cursor, and custom neural clients.
            </p>

            <div className="space-y-10">
              {steps.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="flex gap-8 group"
                >
                  <div className="flex-shrink-0 relative">
                     <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <div className="w-16 h-16 bg-zinc-900 border border-zinc-800/50 rounded-xl flex items-center justify-center shadow-lg group-hover:border-brand-primary/30 transition-all duration-500 relative z-10 text-zinc-300 group-hover:text-brand-primary">
                        <step.icon size={28} />
                     </div>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white mb-3 tracking-tight uppercase">{step.title}</h4>
                    <p className="text-zinc-300 font-medium leading-relaxed max-w-sm opacity-80 group-hover:opacity-100 transition-opacity">{step.description}</p>
                    {step.title === 'Deploy CLI Bridge' && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         whileInView={{ opacity: 1, y: 0 }}
                         className="mt-6 bg-black/60 border border-zinc-800/50 rounded-2xl p-5 flex items-center justify-between group/cmd shadow-inner"
                       >
                          <code className="text-emerald-400 font-mono text-xs tracking-wider">{installCommand}</code>
                          <button onClick={() => handleCopy(installCommand, 'install')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-all">
                             {copied === 'install' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                       </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-20 flex flex-wrap gap-10 items-center">
              <a 
                href="/docs/quickstart" 
                className="group inline-flex items-center gap-3 text-xs font-black text-brand-primary uppercase tracking-[0.2em] hover:text-white transition-all"
              >
                Protocol Documentation <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-4 w-px bg-zinc-900"></div>
              <a 
                href="https://modelcontextprotocol.io" 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 text-xs font-black text-zinc-300 uppercase tracking-[0.2em] hover:text-white transition-all"
              >
                Official Spec <ExternalLink size={14} />
              </a>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Terminal Container */}
            <div className="absolute inset-0 bg-brand-primary/5 blur-[120px] rounded-full animate-pulse"></div>
            <div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800/50 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="flex items-center justify-between px-10 py-8 border-b border-zinc-800/50 bg-zinc-900/30">
                <div className="flex gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/20"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/20"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/20"></div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800/50">
                      <Command size={10} className="text-zinc-300" />
                      <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">mcp_config.json</span>
                   </div>
                   <button 
                    onClick={() => handleCopy(configSnippet, 'config')}
                    className="p-2.5 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-xl"
                  >
                    {copied === 'config' ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="p-12 font-mono text-sm leading-relaxed overflow-x-auto min-h-[400px] flex items-center bg-black/40 shadow-inner">
                <pre className="text-emerald-400/80 w-full tracking-wide">
                  <span className="text-zinc-300">{"{"}</span> <br />
                  <span className="text-purple-400">  "mcpServers"</span>: <span className="text-zinc-300">{"{"}</span> <br />
                  <span className="text-purple-400">    "aktionfy"</span>: <span className="text-zinc-300">{"{"}</span> <br />
                  <span className="text-brand-primary">      "command"</span>: <span className="text-emerald-500">"aktionfy"</span>, <br />
                  <span className="text-brand-primary">      "args"</span>: <span className="text-zinc-300">[</span><span className="text-emerald-500">"run"</span><span className="text-zinc-300">]</span>, <br />
                  <span className="text-brand-primary">      "env"</span>: <span className="text-zinc-300">{"{"}</span> <br />
                  <span className="text-blue-400">        "X-API-KEY"</span>: <span className="text-emerald-500">"NEURAL_TOKEN"</span> <br />
                  <span className="text-zinc-300">      {"}"}</span> <br />
                  <span className="text-zinc-300">    {"}"}</span> <br />
                  <span className="text-zinc-300">  {"}"}</span> <br />
                  <span className="text-zinc-300">{"}"}</span>
                </pre>
              </div>

              <div className="px-10 py-6 bg-brand-primary/5 border-t border-zinc-800/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Zap size={14} className="text-brand-primary animate-pulse" />
                    <span className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em]">Neural Sync Enabled</span>
                 </div>
                 <span className="text-[9px] font-mono text-zinc-700">AES_256_GCM_ENCRYPTED</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Installation;