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
    console.error('Aktionfy Neural Error Captured:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-10 bg-zinc-100/5 border border-zinc-800 rounded-2xl backdrop-blur-xl shadow-lg relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full -translate-x-[-20%] -translate-y-[20%] blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-inner">
                <AlertTriangle className="text-red-400" size={32} />
              </div>
              
              <h1 className="text-3xl font-black text-white mb-4 tracking-tighter italic">NEURAL_FAULT_DETECTED</h1>
              <p className="text-zinc-400 text-sm leading-relaxed mb-10 font-medium">
                The orchestration interface encountered a critical state error. 
                System stability has been maintained, but this view requires a reset.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-100 text-zinc-950 font-bold rounded-2xl hover:bg-zinc-100 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                >
                  <RefreshCw size={18} />
                  Re-initialize Interface
                </button>
                
                <a
                  href="/"
                  className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-100/5 text-zinc-300 font-bold rounded-2xl hover:bg-zinc-100/10 transition-all border border-zinc-800/50"
                >
                  <Home size={18} />
                  Return to Origin
                </a>
              </div>
              
              {import.meta.env.DEV && (
                <div className="mt-8 pt-8 border-t border-zinc-800/50">
                  <p className="text-[10px] font-mono text-red-400/50 break-words text-left overflow-hidden uppercase tracking-widest">
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
