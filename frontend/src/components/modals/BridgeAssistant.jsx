import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Command, Cpu, 
  Activity,
  Globe,
  Wifi, WifiOff, RefreshCw, ChevronLeft, ChevronRight,
  Monitor, Code, Shield
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ClaudeConfig,
  LobeChatConfig,
  AntigravityConfig,
  CodexDesktopConfig,
  CursorConfig,
  GeminiCliConfig,
  CodexConfig,
  CustomConfig
} from './BridgeClientConfigs';

const BridgeAssistant = ({ isOpen, onClose, systemStatus, fetchStatus }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const apiKey = user?.api_key || 'YOUR_API_KEY';

  const handleRefresh = async () => {
    setRefreshing(true);
    if (fetchStatus) await fetchStatus();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const [preventSleep, setPreventSleep] = useState(false);

  const getArgs = () => {
    const args = ["-y", "@aktionfy/mcp", "start", "--api-key", apiKey];
    if (preventSleep) args.push("--prevent-sleep");
    return args;
  };

  const claudeConfig = {
    "mcpServers": {
      "aktionfy": {
        "command": "npx",
        "args": getArgs()
      }
    }
  };

  const installCommand = `npx ${getArgs().join(' ')}`;


  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clients = [
    { 
      id: 'claude_desktop', 
      name: 'Claude Desktop', 
      icon: Monitor, 
      desc: 'Official Anthropic GUI client' 
    },
    { 
      id: 'cursor', 
      name: 'Cursor / VS Code', 
      icon: Code, 
      desc: 'AI-integrated code editors' 
    },
    { 
      id: 'antigravity', 
      name: 'Antigravity', 
      icon: Activity, 
      desc: 'High-performance MCP explorer' 
    },
    { 
      id: 'codex_desktop', 
      name: 'Codex Desktop', 
      icon: Shield, 
      desc: 'Secure local AI workspace' 
    },
    { 
      id: 'lobechat', 
      name: 'LobeChat', 
      icon: Globe, 
      desc: 'Modern web-based LLM UI' 
    }
  ];

  const handleNext = () => {
    if (step === 1 && selectedClient) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  if (!isOpen) return null;

  const getStep2Content = () => {
    switch (selectedClient) {
      case 'claude_desktop':
        return <ClaudeConfig claudeConfig={claudeConfig} preventSleep={preventSleep} setPreventSleep={setPreventSleep} handleCopy={handleCopy} />;
      case 'lobechat':
        return <LobeChatConfig handleCopy={handleCopy} />;
      case 'antigravity':
        return <AntigravityConfig getArgs={getArgs} handleCopy={handleCopy} />;
      case 'codex_desktop':
        return <CodexDesktopConfig installCommand={installCommand} handleCopy={handleCopy} copied={copied} />;
      case 'cursor': {
        const vsCodeConfig = {
          "chat.mcp.servers": {
            "Aktionfy": {
              "command": "npx",
              "args": getArgs()
            }
          }
        };
        return <CursorConfig vsCodeConfig={vsCodeConfig} getArgs={getArgs} preventSleep={preventSleep} setPreventSleep={setPreventSleep} handleCopy={handleCopy} copied={copied} />;
      }
      case 'gemini_cli':
        return <GeminiCliConfig installCommand={installCommand} showKey={showKey} setShowKey={setShowKey} handleCopy={handleCopy} copied={copied} />;
      case 'codex':
        return <CodexConfig installCommand={installCommand} showKey={showKey} setShowKey={setShowKey} handleCopy={handleCopy} copied={copied} />;
      case 'custom':
        return <CustomConfig />;
      default:
        return null;
    }
  };

  const content = (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="bg-zinc-950 border border-zinc-800/50 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
    >
      {/* Header */}
      <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight uppercase">
            Neural Bridge Assistant
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">PROTOCOL: BRIDGE_SETUP_V1</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all p-2 bg-zinc-900 border border-zinc-800 rounded-md">
          <X size={20} />
        </button>
      </div>

      {/* Progress Stepper */}
      <div className="flex px-8 py-6 bg-zinc-950 gap-3 relative z-10">
        {[
          { id: 1, name: 'Selection', icon: Command },
          { id: 2, name: 'Configuration', icon: Cpu },
          { id: 3, name: 'Handshake', icon: Activity }
        ].map((s) => (
          <div key={s.id} className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
               <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all duration-500 ${step >= s.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  <s.icon size={12} />
               </div>
               <span className={`text-[9px] font-black uppercase tracking-widest ${step >= s.id ? 'text-zinc-200' : 'text-zinc-600'} hidden md:inline`}>
                 {s.name}
               </span>
            </div>
            <div className={`h-0.5 rounded-full transition-all duration-700 ${step >= s.id ? 'bg-emerald-600' : 'bg-zinc-900'}`} />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Select your MCP Client</h3>
                <p className="text-sm text-zinc-400">Choose the environment where you want to establish the neural bridge.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client.id)}
                    className={`p-4 rounded-xl border text-left transition-all group ${
                      selectedClient === client.id 
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg border transition-all flex-shrink-0 ${
                        selectedClient === client.id ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 group-hover:text-zinc-200'
                      }`}>
                        <client.icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-xs truncate uppercase tracking-tighter">{client.name}</h4>
                        <p className="text-[9px] text-zinc-500 line-clamp-1">{client.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Configure {clients.find(c => c.id === selectedClient)?.name}</h3>
                <p className="text-sm text-zinc-400">Follow these steps to authorize the neural link.</p>
              </div>

              {getStep2Content()}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center py-10 space-y-8"
            >
              <div className="relative">
                <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-1000 ${
                  systemStatus?.bridge_active 
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' 
                    : 'bg-zinc-900 border-zinc-800'
                }`}>
                  {systemStatus?.bridge_active ? (
                    <Wifi size={40} className="text-emerald-500 animate-pulse" />
                  ) : (
                    <WifiOff size={40} className="text-zinc-700" />
                  )}
                </div>
                {!systemStatus?.bridge_active && (
                   <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full animate-ping" />
                )}
              </div>

              <div className="text-center space-y-2">
                <h3 className={`text-xl font-bold uppercase tracking-widest transition-colors duration-1000 ${
                  systemStatus?.bridge_active ? 'text-emerald-500' : 'text-zinc-200'
                }`}>
                  {systemStatus?.bridge_active ? 'SIGNAL_ESTABLISHED' : 'WAITING_FOR_SIGNAL...'}
                </h3>
                <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  {systemStatus?.bridge_active 
                    ? 'Handshake successful. The neural bridge is now active and ready for orchestration.' 
                    : 'Please ensure your MCP client is running and configured with your API key.'}
                </p>
              </div>

              <div className="flex flex-col items-center gap-4">
                {systemStatus?.bridge_active ? (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={onClose}
                    className="bg-emerald-600 text-white px-10 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all"
                  >
                    Return to Command
                  </motion.button>
                ) : (
                   <button 
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                   >
                     <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> 
                     {refreshing ? 'SYNCHRONIZING...' : 'Force Protocol Sync'}
                   </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 relative z-10">
        <button 
          onClick={handleBack}
          disabled={step === 1}
          className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-white transition-all disabled:opacity-0 group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>
        
        <div className="flex gap-3">
           {step < 3 && (
             <button 
               onClick={handleNext}
               disabled={step === 1 && !selectedClient}
               className="bg-zinc-100 text-zinc-950 px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-white transition-all disabled:opacity-20 flex items-center gap-2"
             >
               {step === 1 ? 'Configure' : 'Verify Link'} <ChevronRight size={14} />
             </button>
           )}
        </div>
      </div>
    </motion.div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      {content}
    </div>,
    document.body
  );
};

export default BridgeAssistant;
