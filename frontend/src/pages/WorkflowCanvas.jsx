import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import TaskWizard from '../components/TaskWizard';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Save, RefreshCw, Layers, X, Trash2, Play, Pause, FastForward, Rewind, Activity } from 'lucide-react';
import DecisionNode from '../components/DecisionNode';
import ManualRouteModal from '../components/ManualRouteModal';
import GlobalPlaybackBar from '../components/GlobalPlaybackBar';
import { useSSE } from '../hooks/useSSE';

const nodeTypes = {
  decision: DecisionNode,
};

const decodeBase64 = (str) => {
  if (!str) return '';
  try {
    const binary = atob(str);
    try {
      return decodeURIComponent(binary.split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch {
      return binary;
    }
  } catch {
    return str;
  }
};

const safeParseJSON = (data, defaultValue = {}) => {
  if (!data) return defaultValue;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    try {
      const decoded = decodeBase64(data);
      if (decoded.startsWith('{') || decoded.startsWith('[')) {
        return JSON.parse(decoded);
      }
    } catch {
      // ignore
    }
    return defaultValue;
  }
};

const WorkflowCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isManualRouteOpen, setIsManualRouteOpen] = useState(false);
  const [rawTasks, setRawTasks] = useState([]);
  
  // Playback states
  const [playbackMode, setPlaybackMode] = useState(false);
  const [executions, setExecutions] = useState([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState('');
  const [traces, setTraces] = useState([]);
  const [currentTraceIndex, setCurrentTraceIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const playbackTimerRef = useRef(null);

  // Optimized task lookup map
  const taskMap = useMemo(() => {
    return rawTasks.reduce((acc, task) => {
        acc[task.id] = task;
        return acc;
    }, {});
  }, [rawTasks]);
  
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const mapTasksToFlow = useCallback((tasksList) => {
    if (!isMountedRef.current) return;
    // Map tasks to nodes
    const newNodes = tasksList.map((task, index) => {
      let position = { x: index * 250, y: 100 };
      
      if (task.ui_coordinates) {
        try {
          if (typeof task.ui_coordinates === 'string') {
            position = JSON.parse(decodeBase64(task.ui_coordinates));
          } else {
            position = task.ui_coordinates;
          }
        } catch (e) {
          console.warn("Failed to parse coordinates for task", task.id, e);
        }
      }

      const isProcessing = task.status === 'processing';
      const isRouter = task.task_type === 'decision_router' || task.task_type === 'swarm_router';

      return {
        id: task.id,
        position,
        type: isRouter ? 'decision' : undefined,
        data: { 
          task,
          label: isRouter ? undefined : (
            <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${isProcessing ? 'scale-110' : ''}`}>
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 opacity-60">{task.trigger_type}</div>
              <div className="font-black text-white text-xs tracking-tight uppercase">{task.name}</div>
              <div className={`flex items-center gap-2 text-[8px] font-black uppercase px-3 py-1 rounded-full border transition-all ${
                task.status === 'active' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 
                task.status === 'processing' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 animate-pulse' :
                'bg-zinc-900/50 text-zinc-500 border-zinc-800/50'
              }`}>
                <div className={`w-1 h-1 rounded-full ${
                  task.status === 'active' ? 'bg-emerald-500' : 
                  task.status === 'processing' ? 'bg-indigo-600 animate-ping' :
                  'bg-slate-700'
                }`} />
                {task.status}
              </div>
              {isProcessing && (
                <div className="absolute -inset-4 bg-indigo-600/5 rounded-[2rem] -z-10 animate-ping duration-[3000ms]" />
              )}
            </div>
          )
        },
        style: isRouter ? { transition: 'all 0.5s ease-in-out' } : {
          background: isProcessing ? 'rgba(217,119,6,0.05)' : 'rgba(10, 10, 10, 0.8)',
          color: '#fff',
          border: isProcessing ? '2px solid rgba(217,119,6,0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '2rem',
          padding: '1.5rem',
          width: 200,
          backdropFilter: 'blur(16px)',
          boxShadow: isProcessing ? '0 0 40px rgba(217,119,6,0.2)' : '0 10px 30px rgba(0,0,0,0.3)',
          transition: 'all 0.5s ease-in-out'
        },
      };
    });

    // Map dependencies to edges
    const newEdges = tasksList
      .filter(task => task.depends_on_task_id)
      .map(task => {
        const sourceTask = tasksList.find(t => t.id === task.depends_on_task_id);
        const isRouterSource = sourceTask?.task_type === 'decision_router' || sourceTask?.task_type === 'swarm_router';
        
        let label = task.trigger_on_completion ? 'cascade' : 'sync';
        let branchCond = null;
        
        if (task.branch_condition) {
          const rawCond = task.branch_condition;
          if (typeof rawCond === 'object') {
            branchCond = rawCond;
          } else {
            const strCond = String(rawCond);
            try {
              const decoded = decodeBase64(strCond);
              if (decoded.startsWith('{') || decoded.startsWith('[')) {
                branchCond = JSON.parse(decoded);
              }
            } catch { /* ignore */ }

            if (!branchCond) {
              try {
                branchCond = JSON.parse(strCond);
              } catch { /* ignore */ }
            }
          }
        }

        if (isRouterSource) {
          label = branchCond?.key || branchCond?.value || 'route';
        } else if (branchCond?.value) {
          label = `if: ${branchCond.value}`;
        }

        const edgeColor = isRouterSource ? '#818cf8' : (task.trigger_on_completion ? '#d97706' : '#3b82f6');

        return {
          id: `e-${task.depends_on_task_id}-${task.id}`,
          source: task.depends_on_task_id,
          target: task.id,
          type: 'smoothstep',
          animated: task.trigger_on_completion || task.status === 'processing' || isRouterSource,
          label: label,
          labelStyle: { fill: edgeColor, fontWeight: 900, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.2em' },
          labelBgStyle: { fill: 'rgba(5, 5, 5, 0.9)', fillOpacity: 0.9 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 8,
          style: { stroke: edgeColor, strokeWidth: isRouterSource ? 3 : 2, opacity: 0.6 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        };
      });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);


  const fetchTasks = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/tasks');
      if (res.data.success) {
        const tasksData = res.data.data || [];
        setRawTasks(tasksData);
        mapTasksToFlow(tasksData);
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  }, [mapTasksToFlow]);

  const fetchExecutions = useCallback(async (taskId) => {
    try {
      const res = await axios.get(`/api/v1/tasks/${taskId}/executions`);
      if (res.data.success) {
        setExecutions(res.data.data || []);
        if (res.data.data?.length > 0) {
          setSelectedExecutionId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch executions', err);
    }
  }, []);

  const fetchTraces = useCallback(async (taskId, executionId) => {
    try {
      const res = await axios.get(`/api/v1/tasks/${taskId}/traces/${executionId}`);
      if (res.data.success) {
        const tracesData = res.data.data || [];
        setTraces(tracesData);
        setCurrentTraceIndex(0);
        
        // Calculate total duration for the playback bar
        if (tracesData.length > 0) {
          const start = new Date(tracesData[0].start_time);
          const end = new Date(tracesData[tracesData.length - 1].end_time);
          setTotalDuration(Math.max(0, (end - start) / 1000));
          setGlobalTime(0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch traces', err);
    }
  }, []);

  useEffect(() => {
    const loadExecutions = async () => {
      if (playbackMode && selectedTask) {
        await fetchExecutions(selectedTask.id);
      } else {
        setExecutions([]);
        setTraces([]);
        setCurrentTraceIndex(-1);
        setIsPlaying(false);
        setGlobalTime(0);
        setTotalDuration(0);
      }
    };
    loadExecutions();
  }, [playbackMode, selectedTask, fetchExecutions]);

  useEffect(() => {
    const loadTraces = async () => {
      if (selectedExecutionId && selectedTask) {
        await fetchTraces(selectedTask.id, selectedExecutionId);
      }
    };
    loadTraces();
  }, [selectedExecutionId, selectedTask, fetchTraces]);

  // Handle Playback Animation
  useEffect(() => {
    if (isPlaying && traces.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setGlobalTime(prev => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + 0.05; // 50ms steps
        });
      }, 50);
    } else {
      clearInterval(playbackTimerRef.current);
    }
    return () => clearInterval(playbackTimerRef.current);
  }, [isPlaying, traces, totalDuration]);

  // Sync globalTime to currentTraceIndex
  useEffect(() => {
    if (playbackMode && traces.length > 0) {
      const startTime = new Date(traces[0].start_time).getTime();
      const targetTime = startTime + (globalTime * 1000);
      
      let foundIndex = 0;
      for (let i = 0; i < traces.length; i++) {
        const traceStart = new Date(traces[i].start_time).getTime();
        if (traceStart <= targetTime) {
          foundIndex = i;
        } else {
          break;
        }
      }
      // Use setTimeout to avoid synchronous setState inside effect (cascading render)
      setTimeout(() => {
        if (isMountedRef.current) {
          setCurrentTraceIndex(foundIndex);
        }
      }, 0);
    }
  }, [globalTime, playbackMode, traces]);

  // Update visual state (nodes and edges) based on playback time
  useEffect(() => {
    if (playbackMode && traces.length > 0) {
      const executionStartTime = new Date(traces[0].start_time).getTime();
      const currentAbsoluteTime = executionStartTime + (globalTime * 1000);

      const activeTraces = traces.filter(t => {
        const start = new Date(t.start_time).getTime();
        const end = t.end_time ? new Date(t.end_time).getTime() : Infinity; 
        return currentAbsoluteTime >= start && currentAbsoluteTime <= end;
      });

      const activeStepNames = new Set(activeTraces.map(t => t.step_name));

      setNodes(prev => prev.map(node => {
        const isActive = activeStepNames.has(node.data.task.name);
        
        return {
          ...node,
          style: {
            ...node.style,
            border: isActive ? '3px solid #d97706' : '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: isActive ? '0 0 50px rgba(217, 119, 6, 0.4)' : 'none',
            transform: isActive ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }
        };
      }));

      setEdges(prev => prev.map(edge => {
        const targetTask = taskMap[edge.target];
        const isActive = targetTask && activeStepNames.has(targetTask.name);

        return {
          ...edge,
          className: isActive ? 'edge-particle-active' : '',
          animated: isActive || edge.animated,
          style: {
            ...edge.style,
            stroke: isActive ? '#d97706' : (edge.style?.stroke || '#3b82f6'),
            strokeWidth: isActive ? 4 : (edge.style?.strokeWidth || 2),
            opacity: isActive ? 1 : 0.4
          }
        };
      }));
    } else if (!playbackMode && traces.length > 0) {
      // Reset styles when leaving playback mode
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchTasks();
        }
      }, 0);
    }
  }, [playbackMode, globalTime, traces, rawTasks, fetchTasks, setNodes, setEdges, taskMap]);

  const updateTaskStatusLocally = useCallback((taskId, status) => {
    if (!isMountedRef.current) return;
    setNodes(prev => prev.map(node => {
        if (node.id === taskId) {
            const updatedTask = { ...node.data.task, status };
            const isProcessing = status === 'processing';
            return {
                ...node,
                data: {
                    ...node.data,
                    task: updatedTask,
                    label: (
                        <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${isProcessing ? 'scale-110' : ''}`}>
                          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 opacity-60">{updatedTask.trigger_type}</div>
                          <div className="font-black text-white text-xs tracking-tight uppercase">{updatedTask.name}</div>
                          <div className={`flex items-center gap-2 text-[8px] font-black uppercase px-3 py-1 rounded-full border transition-all ${
                            updatedTask.status === 'active' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 
                            updatedTask.status === 'processing' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 animate-pulse' :
                            'bg-zinc-900/50 text-zinc-500 border-zinc-800/50'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${
                              updatedTask.status === 'active' ? 'bg-emerald-500' : 
                              updatedTask.status === 'processing' ? 'bg-indigo-600 animate-ping' :
                              'bg-slate-700'
                            }`} />
                            {updatedTask.status}
                          </div>
                          {isProcessing && (
                            <div className="absolute -inset-4 bg-indigo-600/5 rounded-[2rem] -z-10 animate-ping duration-[3000ms]" />
                          )}
                        </div>
                    )
                },
                style: {
                    ...node.style,
                    background: isProcessing ? 'rgba(217, 119, 6, 0.05)' : 'rgba(10, 10, 10, 0.8)',
                    border: isProcessing ? '2px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: isProcessing ? '0 0 40px rgba(217, 119, 6, 0.2)' : '0 10px 30px rgba(0,0,0,0.3)',
                    transition: 'all 0.5s ease-in-out'
                }
            };
        }
        return node;
    }));

    setEdges(prev => prev.map(edge => {
        if (edge.target === taskId || edge.source === taskId) {
            return {
                ...edge,
                animated: edge.animated || status === 'processing'
            };
        }
        return edge;
    }));
  }, [setNodes, setEdges]);

  useSSE(useCallback((event) => {
    if (event.event_type === 'task_status_changed') {
      try {
        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        updateTaskStatusLocally(payload.task_id, payload.status);
      } catch (err) {
        console.error("Failed to parse task status change", err);
      }
    }
  }, [updateTaskStatusLocally]));

  useEffect(() => {
    const init = async () => {
      await fetchTasks();
    };
    init();
  }, [fetchTasks]);

  const onLayout = useCallback(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR' });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 200, height: 120 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 200 / 2,
          y: nodeWithPosition.y - 120 / 2,
        },
        style: {
          ...node.style,
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        }
      };
    });

    setNodes(newNodes);
  }, [nodes, edges, setNodes]);

  const onConnect = useCallback(async (params) => {
    const { source, target } = params;
    try {
      const res = await axios.post(`/api/v1/tasks/${target}/link`, {
        depends_on_task_id: source,
        trigger_on_completion: true
      });
      if (res.data.success) {
        setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#d97706' } }, eds));
        // Refresh tasks to get updated dependency state
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to link tasks", err);
      alert("Failed to link tasks: " + (err.response?.data?.error || err.message));
    }
  }, [setEdges, fetchTasks]);

  const onNodesDelete = useCallback(async (deletedNodes) => {
    for (const node of deletedNodes) {
      try {
        await axios.delete(`/api/v1/tasks/${node.id}`);
      } catch (err) {
        console.error(`Failed to delete task ${node.id}`, err);
      }
    }
    fetchTasks();
  }, [fetchTasks]);

  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      try {
        // Remove dependency by setting depends_on_task_id to null
        await axios.post(`/api/v1/tasks/${edge.target}/link`, {
          depends_on_task_id: null
        });
      } catch (err) {
        console.error(`Failed to remove dependency for task ${edge.target}`, err);
      }
    }
    fetchTasks();
  }, [fetchTasks]);

  const onNodeClick = useCallback((event, node) => {
    const task = node.data.task;
    setSelectedTask(task);
    
    if (task.task_type === 'decision_router' && task.last_approval_status === 'needs_routing') {
      setIsManualRouteOpen(true);
    } else {
      setIsSidebarOpen(true);
    }
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const res = await axios.delete(`/api/v1/tasks/${taskId}`);
      if (res.data.success) {
        setIsSidebarOpen(false);
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to delete task", err);
      alert("Failed to delete task: " + (err.response?.data?.error || err.message));
    }
  }, [fetchTasks]);

  const saveLayout = async () => {
    setSaving(true);
    try {
      const promises = nodes.map(node => {
        return axios.patch(`/api/v1/tasks/${node.id}`, {
          ui_coordinates: node.position
        });
      });
      await Promise.all(promises);
      alert('Layout saved successfully!');
    } catch (err) {
      console.error('Failed to save layout', err);
      alert('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-950 text-white overflow-hidden selection:bg-indigo-600">
      <header className="px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-950/50 backdrop-blur-3xl border-b border-zinc-800/50 z-20">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black text-white tracking-tighter flex items-center gap-4"
          >
            <div className="p-2 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
               <Layers className="text-indigo-400" size={24} />
            </div>
            Workflow Canvas
          </motion.h1>
          <div className="flex items-center gap-3 mt-1 ml-14">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.2em]">Neural Interconnect Active</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchTasks}
            disabled={loading}
            className="p-4 bg-zinc-900/50 text-slate-400 rounded-2xl border border-zinc-800/50 hover:bg-zinc-100/10 hover:text-white transition-all disabled:opacity-50"
            title="Sync Core"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={onLayout}
            className="bg-zinc-900/50 text-slate-300 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-zinc-800/50 hover:bg-zinc-100/10 hover:text-white transition-all flex items-center gap-3"
          >
            <Activity size={14} className="text-brand-secondary" />
            Auto-Sync
          </button>
          <button 
            onClick={saveLayout}
            disabled={saving || loading || nodes.length === 0}
            className=" bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(217,119,6,0.3)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Commit Layout
          </button>
          <Link 
            to="/dashboard"
            className="p-4 bg-zinc-900/50 text-slate-400 rounded-2xl border border-zinc-800/50 hover:bg-zinc-100/10 hover:text-white transition-all"
          >
            <X size={18} />
          </Link>
        </div>
      </header>

      <div className="flex-1 relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-[0.03] pointer-events-none absolute inset-0"></div>

      <div className="flex-1 relative">
        {loading && nodes.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center bg-zinc-950">
             <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-brand-primary rounded-full animate-spin"></div>
                <div className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Initializing Virtual Workspace...</div>
             </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center bg-zinc-950">
             <div className="text-center max-w-sm">
                <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-800/50">
                   <Layers size={40} className="text-zinc-700" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4">Neural Void</h2>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest leading-relaxed">No orchestration streams identified in this environment.</p>
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="mt-8 px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl"
                >
                  Fire First Orchestration
                </button>
             </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            colorMode="dark"
            fitView
          >
            <Controls className="!bg-zinc-950 !border-zinc-800 !rounded-xl !shadow-2xl" />
            <MiniMap 
              style={{
                backgroundColor: 'rgba(5, 5, 5, 0.9)',
                borderRadius: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
              maskColor="rgba(0, 0, 0, 0.3)"
              nodeColor="rgba(217, 119, 6, 0.3)"
            />
            <Background variant="dots" gap={20} size={1} color="rgba(255, 255, 255, 0.05)" />
          </ReactFlow>
        )}

        <ManualRouteModal 
          isOpen={isManualRouteOpen}
          onClose={() => setIsManualRouteOpen(false)}
          task={selectedTask}
          tasks={rawTasks}
          onRouted={fetchTasks}
        />

        {/* Unified Inspector/Wizard Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md z-40"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800/50 z-50 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
              >
                <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30 shrink-0">
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight uppercase">Neural Inspector</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Core Logic & Telemetry</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setPlaybackMode(!playbackMode)}
                      className={`p-3 rounded-xl transition-all border ${playbackMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950/40' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                      title="Toggle Simulation"
                    >
                      <Activity size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(selectedTask?.id)}
                      className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-500 hover:bg-red-900/40 transition-all"
                      title="Terminate Node"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                   {playbackMode ? (
                     <div className="p-8 space-y-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
                       <div className="space-y-3 shrink-0">
                         <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Historical Lifecycles</label>
                         <select 
                           value={selectedExecutionId}
                           onChange={(e) => setSelectedExecutionId(e.target.value)}
                           className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 shadow-inner appearance-none font-mono"
                         >
                           {executions.map(ex => (
                             <option key={ex.id} value={ex.id} className="bg-zinc-950">
                               {new Date(ex.started_at).toLocaleTimeString()} :: {ex.status.toUpperCase()}
                             </option>
                           ))}
                         </select>
                       </div>

                       {traces.length > 0 ? (
                         <div className="space-y-8 flex-1 flex flex-col min-h-0">
                           <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8 space-y-8 shrink-0">
                             <div className="flex items-center justify-between">
                               <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Telemetry Deck</div>
                               <div className="text-[10px] font-black font-mono text-zinc-500 opacity-60">FRM_{currentTraceIndex + 1} // TOTAL_{traces.length}</div>
                             </div>
                             
                             <div className="flex items-center justify-center gap-6">
                               <button 
                                 onClick={() => setCurrentTraceIndex(prev => Math.max(0, prev - 1))}
                                 className="p-3 bg-zinc-900/50 rounded-xl text-white hover:bg-zinc-800 transition-colors border border-zinc-800/50"
                               >
                                 <Rewind size={20} />
                               </button>
                               <button 
                                 onClick={() => setIsPlaying(!isPlaying)}
                                 className="p-6 bg-indigo-600 rounded-2xl text-white hover:scale-105 transition-transform shadow-xl shadow-indigo-900/20 active:scale-95"
                               >
                                 {isPlaying ? <Pause size={28} /> : <Play size={28} className="translate-x-1" />}
                               </button>
                               <button 
                                 onClick={() => setCurrentTraceIndex(prev => Math.min(traces.length - 1, prev + 1))}
                                 className="p-3 bg-zinc-900/50 rounded-xl text-white hover:bg-zinc-800 transition-colors border border-zinc-800/50"
                               >
                                 <FastForward size={20} />
                               </button>
                             </div>

                             <div className="space-y-4">
                               <input 
                                 type="range" 
                                 min="0" 
                                 max={Math.max(0, traces.length - 1)} 
                                 value={currentTraceIndex}
                                 onChange={(e) => setCurrentTraceIndex(parseInt(e.target.value))}
                                 className="w-full h-1 bg-zinc-900/50 rounded-full appearance-none cursor-pointer accent-brand-primary"
                               />
                             </div>
                           </div>

                           <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                             <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1 shrink-0">Neural Frame Details</div>
                             <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8 space-y-8 flex-1 flex flex-col min-h-0">
                               <div className="shrink-0">
                                 <div className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mb-1.5">Step Designation</div>
                                 <div className="text-xl font-bold text-white tracking-tight italic">{traces[currentTraceIndex].step_name}</div>
                               </div>
                               <div className="grid grid-cols-1 gap-6 flex-1 min-h-0 overflow-hidden">
                                 <div className="flex flex-col min-h-0 overflow-hidden">
                                   <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                                      <div className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Inbound Payload</div>
                                   </div>
                                   <pre className="text-[11px] bg-black/40 p-4 rounded-xl text-emerald-400/80 overflow-auto border border-zinc-800/50 font-mono flex-1 custom-scrollbar">
                                     {traces[currentTraceIndex].input_data ? 
                                       (typeof safeParseJSON(traces[currentTraceIndex].input_data) === 'object' ? 
                                         JSON.stringify(safeParseJSON(traces[currentTraceIndex].input_data), null, 2) : 
                                         traces[currentTraceIndex].input_data) : 'NULL'}
                                   </pre>
                                 </div>
                                 <div className="flex flex-col min-h-0 overflow-hidden">
                                   <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_10px_#d97706]"></div>
                                      <div className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Outbound Result</div>
                                   </div>
                                   <pre className="text-[11px] bg-black/40 p-4 rounded-xl text-indigo-400/80 overflow-auto border border-zinc-800/50 font-mono flex-1 custom-scrollbar">
                                     {traces[currentTraceIndex].output_data ? 
                                       (typeof safeParseJSON(traces[currentTraceIndex].output_data) === 'object' ? 
                                         JSON.stringify(safeParseJSON(traces[currentTraceIndex].output_data), null, 2) : 
                                         traces[currentTraceIndex].output_data) : 'NULL'}
                                   </pre>
                                 </div>
                               </div>
                               <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50 shrink-0">
                                 <div className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Temporal Duration</div>
                                 <div className="text-xs font-black text-white font-mono bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
                                   {((new Date(traces[currentTraceIndex].end_time) - new Date(traces[currentTraceIndex].start_time)) / 1000).toFixed(3)}s
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       ) : (
                         <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-6 opacity-30">
                           <div className="w-20 h-20 bg-zinc-900/50 border border-zinc-800/50 rounded-full flex items-center justify-center">
                              <Activity size={32} className="text-zinc-700 animate-pulse" />
                           </div>
                           <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 max-w-xs leading-relaxed">No telemetry data recorded for this execution cycle.</div>
                         </div>
                       )}
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
                        <TaskWizard 
                            isOpen={isSidebarOpen} 
                            onClose={() => setIsSidebarOpen(false)} 
                            initialData={selectedTask}
                            onTaskCreated={() => {
                              fetchTasks();
                              setIsSidebarOpen(false);
                            }}
                            isInline={true}
                        />
                     </div>
                   )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {playbackMode && (
            <GlobalPlaybackBar 
              currentTime={globalTime}
              duration={totalDuration}
              onTimeChange={setGlobalTime}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorkflowCanvas;