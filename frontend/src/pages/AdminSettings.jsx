import { useEffect, useState, useCallback, useRef } from 'react';

import axios from 'axios';
import { Settings, Save, Trash2, RefreshCw, Zap, Shield, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotify } from '../context/NotificationContext';
import { useSSE } from '../context/SSEContext';

const AdminSettings = () => {
  const { notify } = useNotify();
  const { addListener, removeListener } = useSSE();
  const isMounted = useRef(true);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/public/maintenance');
      if (res.data.success && isMounted.current) {
        setMaintenanceEnabled(res.data.data.enabled);
      }
    } catch (err) {
      notify('ERROR', 'Failed to fetch maintenance status', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setMaintenanceLoading(false);
    }
  }, [notify]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/admin/settings');
      if (res.data.success && isMounted.current && res.data.data) {
        setSettings(res.data.data);
      }
      await fetchMaintenanceStatus();
    } catch (err) {
      notify('ERROR', 'Failed to load system settings', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify, fetchMaintenanceStatus]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchSettings();
    };
    addListener('settings_updated', handleUpdate);
    return () => removeListener('settings_updated', handleUpdate);
  }, [addListener, removeListener, fetchSettings]);

  useEffect(() => {
    const handleMaintenanceChange = (payload) => {
      if (payload && isMounted.current) {
        setMaintenanceEnabled(payload.status === 'enabled');
      }
    };
    addListener('maintenance_mode_changed', handleMaintenanceChange);
    return () => removeListener('maintenance_mode_changed', handleMaintenanceChange);
  }, [addListener, removeListener]);

  useEffect(() => {
    const init = async () => {
      await fetchSettings();
    };
    init();
  }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (settings.worker_prune_days <= 0 || settings.js_timeout_ms <= 0 || 
        settings.reaper_stuck_threshold_minutes <= 0 || settings.scheduler_poll_interval_seconds <= 0) {
      notify('ERROR', 'Validation Failed', 'All configuration values must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await axios.post('/api/v1/admin/settings', settings);
      notify('SUCCESS', 'System configuration synchronized successfully');
    } catch (err) {
      notify('ERROR', 'Failed to synchronize configuration', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleToggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      const targetState = !maintenanceEnabled;
      const res = await axios.post('/api/v1/admin/maintenance', { enabled: targetState });
      if (res.data.success) {
        setMaintenanceEnabled(targetState);
        notify('SUCCESS', targetState ? 'System set to Maintenance Mode. Non-admin routes are now restricted.' : 'System maintenance mode deactivated.');
      }
    } catch (err) {
      notify('ERROR', 'Failed to toggle maintenance mode', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) setTogglingMaintenance(false);
    }
  };

  const handlePrune = async () => {
    setPruning(true);
    try {
      const res = await axios.post('/api/v1/admin/workers/prune');
      if (res.data.success) {
        notify('SUCCESS', `Cleanup complete. ${res.data.data.pruned_count} zombie nodes terminated.`);
      }
    } catch (err) {
      notify('ERROR', 'Failed to execute node termination protocol', err.response?.data?.error || err.message);
    } finally {
      if (isMounted.current) {
        setPruning(false);
        setConfirmPrune(false);
      }
    }
  };

  return (
    <>
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-4"
          >
             <div className="w-8 h-8 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center text-brand-primary">
                <Shield size={16} />
             </div>
             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Operational Plane</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            Control Center.
          </motion.h1>
          <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 ml-1">System-Wide Protocol & Node Governance</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={fetchSettings}
             disabled={loading || maintenanceLoading}
             className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all disabled:opacity-50"
             aria-label="Refresh settings"
           >
             <RefreshCw size={16} className={(loading || maintenanceLoading) ? 'animate-spin' : ''} />
           </button>
        </div>
      </header>

      <div className="max-w-4xl">
        <AnimatePresence mode="wait">
          {(loading || maintenanceLoading || !settings) ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40"
            >
              <RefreshCw size={32} className="animate-spin text-brand-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-6 animate-pulse">Syncing Kernel Configurations...</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              <form onSubmit={handleSave} className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-12 shadow-lg relative overflow-hidden backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-12">
                   <div className="p-3 bg-zinc-100/5 rounded-xl border border-zinc-800/50 text-zinc-400">
                      <Settings size={20} />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter">Infrastructure Tuning</h2>
                      <p className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest mt-0.5">Core Performance Parameters</p>
                   </div>
                </div>

                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Node Pruning Lease (Days)</label>
                    <input 
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={settings.worker_prune_days}
                      onChange={(e) => setSettings({ ...settings, worker_prune_days: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner invalid:border-red-500/50"
                    />
                    <p className="text-[10px] text-zinc-300 font-medium ml-4 leading-relaxed max-w-lg">
                      Inactive workers are permanently deregistered from the pool after remaining silent for this period.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Sandbox JS Timeout (Milliseconds)</label>
                    <input 
                      type="number"
                      min="100"
                      max="60000"
                      required
                      value={settings.js_timeout_ms}
                      onChange={(e) => setSettings({ ...settings, js_timeout_ms: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner invalid:border-red-500/50"
                    />
                    <p className="text-[10px] text-zinc-300 font-medium ml-4 leading-relaxed max-w-lg">
                      Maximum execution duration permitted for native JS actions before halting the task with a timeout error.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Stuck Task Reaper Lease (Minutes)</label>
                    <input 
                      type="number"
                      min="1"
                      max="1440"
                      required
                      value={settings.reaper_stuck_threshold_minutes}
                      onChange={(e) => setSettings({ ...settings, reaper_stuck_threshold_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner invalid:border-red-500/50"
                    />
                    <p className="text-[10px] text-zinc-300 font-medium ml-4 leading-relaxed max-w-lg">
                      Tasks left in the processing state for longer than this limit are reaped and returned to active queue.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-2">Scheduler Poll Interval (Seconds)</label>
                    <input 
                      type="number"
                      min="5"
                      max="3600"
                      required
                      value={settings.scheduler_poll_interval_seconds}
                      onChange={(e) => setSettings({ ...settings, scheduler_poll_interval_seconds: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-xl p-6 text-white font-mono text-sm focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner invalid:border-red-500/50"
                    />
                    <p className="text-[10px] text-zinc-300 font-medium ml-4 leading-relaxed max-w-lg">
                      The default interval at which the background database schedulers check for due/runnable schedules.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={saving}
                    className=" bg-brand-primary text-white px-12 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Sync Configuration
                  </button>
                </div>
              </form>

              <div className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-12 shadow-lg relative overflow-hidden backdrop-blur-xl group hover:border-zinc-800 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-xl border transition-colors ${
                      maintenanceEnabled ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-zinc-800/50 text-zinc-400 border-zinc-800'
                    }`}>
                      <Settings size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Global Maintenance Mode</h2>
                      <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                        {maintenanceEnabled ? 'Restricting traffic: only administrators can access APIs' : 'Deactivated: all clients can connect normally'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={handleToggleMaintenance}
                      disabled={togglingMaintenance || maintenanceLoading}
                      className={`px-10 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 whitespace-nowrap ${
                        maintenanceEnabled 
                          ? 'bg-amber-600 text-white shadow-[0_20px_50px_rgba(245,158,11,0.2)] hover:bg-amber-500' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {togglingMaintenance ? <RefreshCw size={16} className="animate-spin" /> : <Settings size={16} />}
                      {maintenanceEnabled ? 'Deactivate Maintenance' : 'Activate Maintenance'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-12 shadow-lg relative overflow-hidden backdrop-blur-xl group hover:border-red-500/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                  <div className="flex items-center gap-6">
                    <div className="bg-red-500/10 p-5 rounded-xl text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform">
                      <Trash2 size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-1 text-red-500/80">Manual Node Reaper</h2>
                      <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Execute instantaneous cluster cleanup</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {confirmPrune ? (
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-2">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest px-2">Authorize?</span>
                        <button 
                          onClick={handlePrune}
                          disabled={pruning}
                          className="p-3 bg-red-500 text-white rounded-lg hover:brightness-110 transition-all"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmPrune(false)}
                          className="p-3 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmPrune(true)}
                        disabled={pruning}
                        className="bg-red-500 text-white px-10 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(239,68,68,0.2)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 whitespace-nowrap"
                      >
                        {pruning ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                        Initialize Purge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default AdminSettings;