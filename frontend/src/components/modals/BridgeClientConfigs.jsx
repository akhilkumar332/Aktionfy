import { Copy, Check, Zap, EyeOff, Eye, ExternalLink } from 'lucide-react';

export const ClaudeConfig = ({ claudeConfig, preventSleep, setPreventSleep, handleCopy }) => (
  <div className="space-y-6">
    <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Step 1: Update Config JSON</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-400 italic">Edit claude_desktop_config.json</span>
        <button 
          onClick={() => handleCopy(JSON.stringify(claudeConfig, null, 2))}
          className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-400"
        >
          Copy Config <Copy size={12} />
        </button>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <pre className="text-[11px] text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(claudeConfig, null, 2)}
        </pre>
      </div>
    </div>

    <div className="space-y-4 pt-4 border-t border-zinc-800">
       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Advanced Tuning</p>
       <div className="grid grid-cols-1">
          <button 
            onClick={() => setPreventSleep(!preventSleep)}
            className={`p-3 rounded-xl border text-left transition-all ${preventSleep ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className={preventSleep ? 'text-indigo-400' : 'text-zinc-500'} />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Stay Awake</span>
            </div>
            <p className="text-[9px] text-zinc-500 leading-tight">Prevent local computer from sleeping during long-running tasks.</p>
          </button>
       </div>
    </div>
  </div>
);

export const LobeChatConfig = ({ handleCopy }) => (
  <div className="space-y-6">
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Skill Integration</p>
      <ul className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
        <li>Go to <span className="text-zinc-200">Settings</span> → <span className="text-zinc-200">Skill Settings</span></li>
        <li>Select <span className="text-zinc-200">Custom Skills</span> tab</li>
        <li>Click <span className="text-zinc-200">Quick Import JSON</span></li>
        <li className="list-none pt-2">
          <button 
            onClick={() => handleCopy(JSON.stringify({
              "identifier": "aktionfy",
              "api": `${window.location.origin}/sse`,
              "type": "mcp"
            }, null, 2))}
            className="w-full py-2 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/20 transition-all"
          >
            Copy LobeChat Manifest
          </button>
        </li>
      </ul>
    </div>
    <p className="text-[10px] text-zinc-500 italic text-center">Note: LobeChat uses direct SSE connection to this dashboard.</p>
  </div>
);

export const AntigravityConfig = ({ getArgs, handleCopy }) => (
  <div className="space-y-6">
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Explorer Integration</p>
      <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
        <li>Open <span className="text-zinc-200">Antigravity</span> Settings</li>
        <li>Add New <span className="text-zinc-200">Bridge Tool</span></li>
        <li>Configure with Command: <span className="text-zinc-200 font-mono text-[10px]">npx</span></li>
        <li>
          Args: <span className="text-zinc-200 font-mono text-[10px]">{getArgs().join(' ')}</span>
          <button 
            onClick={() => handleCopy(getArgs().join(' '))}
            className="ml-2 text-zinc-500 hover:text-white transition-all align-middle"
            title="Copy Args"
          >
            <Copy size={12} />
          </button>
        </li>
      </ul>
    </div>
    <p className="text-[10px] text-zinc-500 italic text-center">Antigravity will securely route neural requests via your local process.</p>
  </div>
);

export const CodexDesktopConfig = ({ installCommand, handleCopy, copied }) => (
  <div className="space-y-6">
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Desktop Proxy</p>
      <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
        <li>Open <span className="text-zinc-200">Codex Desktop</span></li>
        <li>Navigate to <span className="text-zinc-200">Protocol Settings</span></li>
        <li>Inject Neural Stream with command:</li>
        <li className="list-none pt-2">
           <div className="bg-black/40 border border-zinc-800 rounded-md p-3 flex items-center gap-3">
             <code className="text-[10px] text-emerald-500 font-mono flex-1">
               {installCommand}
             </code>
             <button onClick={() => handleCopy(installCommand)} className="text-zinc-500 hover:text-white transition-all">
               {copied ? <Check size={14} /> : <Copy size={14} />}
             </button>
           </div>
        </li>
      </ul>
    </div>
  </div>
);

export const CursorConfig = ({ vsCodeConfig, getArgs, preventSleep, setPreventSleep, handleCopy, copied }) => (
  <div className="space-y-6">
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Option 1: Add to settings.json (Recommended)</h4>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 italic">Merge into your VS Code or Cursor settings.json</span>
          <button 
            onClick={() => handleCopy(JSON.stringify(vsCodeConfig, null, 2))}
            className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
          >
            {copied ? 'Copied' : 'Copy Config'} <Copy size={12} />
          </button>
        </div>
        <div className="bg-black/40 border border-zinc-800/50 rounded-xl p-5 shadow-inner">
          <pre className="text-[11px] text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(vsCodeConfig, null, 2)}
          </pre>
        </div>
      </div>
    </div>

    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Option 2: Add via Settings UI</h4>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
        <ul className="text-xs text-zinc-400 space-y-3 list-disc list-inside">
          <li>Open <span className="text-zinc-200 font-medium">Settings</span> → <span className="text-zinc-200 font-medium">Features</span> → <span className="text-zinc-200 font-medium">MCP</span></li>
          <li>Click <span className="text-zinc-200 font-medium">Add New MCP Server</span>:</li>
          <li className="list-none pl-4 space-y-3 mt-2 border-l border-zinc-800/80">
            <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-[11px] font-mono">
              <div className="text-zinc-500 font-bold uppercase tracking-wider">Name:</div>
              <div className="col-span-3 text-zinc-300 flex items-center gap-2">
                <span>Aktionfy</span>
                <button onClick={() => handleCopy('Aktionfy')} className="text-zinc-600 hover:text-white transition-colors" title="Copy Name">
                  <Copy size={10} />
                </button>
              </div>
              
              <div className="text-zinc-500 font-bold uppercase tracking-wider">Type:</div>
              <div className="col-span-3 text-zinc-300">command</div>

              <div className="text-zinc-500 font-bold uppercase tracking-wider">Command:</div>
              <div className="col-span-3 text-zinc-300 flex items-center gap-2">
                <span>npx</span>
                <button onClick={() => handleCopy('npx')} className="text-zinc-600 hover:text-white transition-colors" title="Copy Command">
                  <Copy size={10} />
                </button>
              </div>

              <div className="text-zinc-500 font-bold uppercase tracking-wider">Args:</div>
              <div className="col-span-3 text-zinc-300 flex items-start gap-2 break-all bg-black/30 border border-zinc-800/50 rounded-lg p-3">
                <span className="flex-1">{getArgs().join(' ')}</span>
                <button onClick={() => handleCopy(getArgs().join(' '))} className="text-zinc-600 hover:text-white transition-colors pt-0.5" title="Copy Args">
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Advanced Tuning</p>
       <div className="grid grid-cols-1">
          <button 
            onClick={() => setPreventSleep(!preventSleep)}
            className={`p-4 rounded-xl border text-left transition-all ${preventSleep ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className={preventSleep ? 'text-indigo-400 animate-pulse' : 'text-zinc-500'} />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Stay Awake</span>
            </div>
            <p className="text-[9px] text-zinc-500 leading-tight">Prevent local computer from sleeping during long-running tasks.</p>
          </button>
       </div>
    </div>
  </div>
);

export const GeminiCliConfig = ({ installCommand, showKey, setShowKey, handleCopy, copied }) => (
  <div className="space-y-6">
     <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Neural Proxy Setup</p>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <p className="text-xs text-zinc-300">Authorize the Gemini CLI to access your neural streams by establishing a process proxy:</p>
        <div className="bg-black/40 border border-zinc-800 rounded-md p-3 flex items-center gap-3">
           <code className="text-xs text-emerald-500 font-mono flex-1">
             {showKey ? `${installCommand} --proxy gemini` : `npx @aktionfy/mcp install --api-key ${'•'.repeat(24)} --proxy gemini`}
           </code>
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setShowKey(!showKey)}
               className="text-zinc-500 hover:text-white transition-all"
               title={showKey ? "Hide Signature" : "Show Signature"}
             >
               {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
             </button>
             <button onClick={() => handleCopy(`${installCommand} --proxy gemini`)} className="text-zinc-500 hover:text-white transition-all">
               {copied ? <Check size={14} /> : <Copy size={14} />}
             </button>
           </div>
        </div>
        <p className="text-[10px] text-zinc-500 italic">This establishes a secure IPC bridge between the Gemini runtime and the Aktionfy engine.</p>
      </div>
    </div>
  </div>
);

export const CodexConfig = ({ installCommand, showKey, setShowKey, handleCopy, copied }) => (
  <div className="space-y-6">
     <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Codex Protocol</p>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        <p className="text-xs text-zinc-300">Inject the Aktionfy bridge into your Codex/Copilot CLI environment:</p>
        <div className="bg-black/40 border border-zinc-800 rounded-md p-3 flex items-center gap-3">
           <code className="text-xs text-emerald-500 font-mono flex-1">
             {showKey ? `copilot-cli mcp link -- ${installCommand}` : `copilot-cli mcp link -- npx @aktionfy/mcp install --api-key ${'•'.repeat(24)}`}
           </code>
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setShowKey(!showKey)}
               className="text-zinc-500 hover:text-white transition-all"
               title={showKey ? "Hide Signature" : "Show Signature"}
             >
               {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
             </button>
             <button onClick={() => handleCopy(`copilot-cli mcp link -- ${installCommand}`)} className="text-zinc-500 hover:text-white transition-all">
               {copied ? <Check size={14} /> : <Copy size={14} />}
             </button>
           </div>
        </div>
      </div>
    </div>
  </div>
);

export const CustomConfig = () => (
  <div className="space-y-6">
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center space-y-4">
      <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto">
        <ExternalLink className="text-emerald-500" size={24} />
      </div>
      <h4 className="text-sm font-bold text-white uppercase tracking-widest">Manual Neural Link</h4>
      <p className="text-xs text-zinc-400">Integrate the Aktionfy MCP SDK directly into your custom neural client.</p>
      <div className="flex justify-center">
        <a href="https://github.com/aktionfy/mcp-sdk" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2 hover:text-emerald-400">
          VIEW SDK DOCS <ExternalLink size={12} />
        </a>
      </div>
    </div>
  </div>
);
