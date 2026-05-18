import { Check, Zap, Rocket, Shield, Crown, Command } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await axios.post('/api/v1/billing/create-checkout-session');
      if (res.data.success && res.data.data.url) {
        window.location.assign(res.data.data.url);
      }
    } catch {
      alert('Failed to initiate upgrade');
    }
  };

  const plans = [
    {
      name: 'Sandbox',
      price: '$0',
      description: 'Ideal for rapid prototyping and individual neural discovery.',
      icon: Zap,
      features: [
        '2 concurrent task streams',
        'Standard delivery latency',
        '100 historical logs',
        'Community access',
      ],
      cta: user ? (user.tier === 'free' ? 'Active Protocol' : 'Baseline') : 'Start Free',
      active: user?.tier === 'free',
      highlight: false,
    },
    {
      name: 'Production',
      price: '$29',
      period: '/mo',
      description: 'For high-availability mission critical AI automation.',
      icon: Rocket,
      features: [
        '50 concurrent task streams',
        'Ultra-low latency priority',
        'Unlimited log persistence',
        'Direct engineer support',
        'Multi-region replication',
      ],
      cta: user?.tier === 'pro' ? 'Active Protocol' : 'Authorize Pro',
      active: user?.tier === 'pro',
      highlight: true,
      onClick: handleUpgrade,
    },
    {
      name: 'Cluster',
      price: 'Custom',
      description: 'For industrial scale and multi-tenant deployments.',
      icon: Shield,
      features: [
        'Unlimited scaling',
        'Dedicated server clusters',
        'White-label dashboard',
        '99.99% uptime SLA',
        'On-premise deployment',
      ],
      cta: 'Contact Logistics',
      active: false,
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-40 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[140px]"></div>
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto text-center mb-32"
        >
          <div className="inline-flex items-center gap-3 py-2 px-6 mb-8 text-[10px] font-black tracking-[0.4em] text-brand-primary uppercase bg-zinc-900 border border-zinc-800 rounded-full backdrop-blur-xl">
             Monetization Protocol
          </div>
          <h2 className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tighter leading-[0.9]">
            Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-amber-200">Scale.</span>
          </h2>
          <p className="text-xl md:text-2xl text-zinc-300 font-bold max-w-2xl mx-auto leading-relaxed tracking-tight">
            Provision the infrastructure required to power your next billion-dollar neural application.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative p-12 rounded-3xl border transition-all duration-700 flex flex-col overflow-hidden shadow-lg ${
                plan.highlight
                  ? 'border-brand-primary/50 bg-zinc-900 shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-10 scale-105'
                  : 'border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-900'
              }`}
            >
              {/* Highlight Glow */}
              {plan.highlight && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              )}

              {plan.highlight && (
                <div className="absolute top-6 right-10 flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg z-20">
                  Recommended
                </div>
              )}

              <div className="mb-12 flex-1">
                <div className={`w-20 h-20 rounded-xl flex items-center justify-center mb-10 bg-black/40 border border-zinc-800/50 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg ${
                  plan.highlight ? 'text-brand-primary shadow-[0_0_40px_rgba(217,119,6,0.3)]' : 'text-zinc-300'
                }`}>
                  <plan.icon size={36} />
                </div>
                
                <h3 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">{plan.name}</h3>
                <div className="flex items-baseline gap-3 mb-8">
                  <span className="text-6xl font-black text-white tracking-tighter">{plan.price}</span>
                  {plan.period && <span className="text-zinc-300 font-black text-sm tracking-widest uppercase">{plan.period}</span>}
                </div>
                <p className="text-zinc-300 text-sm font-medium leading-relaxed mb-12 opacity-80 group-hover:opacity-100 transition-opacity">
                  {plan.description}
                </p>
                
                <ul className="space-y-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-4 text-sm font-bold text-zinc-300 group-hover:text-zinc-200 transition-colors">
                      <div className="p-1 bg-indigo-600/10 rounded-lg mt-0.5">
                         <Check size={14} className="text-brand-primary" strokeWidth={4} />
                      </div>
                      <span className="tracking-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled={plan.active}
                onClick={plan.onClick}
                className={`w-full py-6 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-[0.98] mt-auto shadow-lg border flex items-center justify-center gap-3 overflow-hidden group/btn ${
                  plan.active
                    ? 'bg-zinc-100/5 text-zinc-300 cursor-not-allowed border-zinc-800/50'
                    : plan.highlight
                    ? ' bg-indigo-600 text-white border-brand-primary hover:brightness-110 shadow-indigo-950/40'
                    : 'bg-zinc-100 text-zinc-950 border-white hover:brightness-90 shadow-white/5'
                }`}
              >
                {plan.active ? <Shield size={14} /> : (plan.highlight ? <Crown size={14} /> : <Command size={14} />)}
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;