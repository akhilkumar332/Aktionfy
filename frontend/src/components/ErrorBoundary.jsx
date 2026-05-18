import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical UI Failure:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center font-sans">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
          
          <div className="max-w-md w-full p-10 bg-zinc-900 border border-zinc-800 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex flex-col items-center gap-8 relative z-10">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shadow-lg">
                <AlertTriangle size={32} />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Protocol Violation</h1>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Neural Interface encountered a critical exception.</p>
              </div>

              <div className="grid grid-cols-1 w-full gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-100 text-zinc-950 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-white transition-all active:scale-95 shadow-lg shadow-white/5"
                >
                  <RefreshCw size={16} /> Re-Initialize Session
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 text-zinc-300 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all border border-zinc-800"
                >
                  <Home size={16} /> Return to Root
                </button>
              </div>

              {import.meta.env.DEV && (
                <div className="mt-8 p-4 bg-black/40 border border-zinc-800 rounded-xl text-left w-full overflow-hidden shadow-inner">
                  <p className="text-[10px] font-mono text-red-400/80 break-all leading-relaxed uppercase tracking-tighter">
                    {this.state.error?.toString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;