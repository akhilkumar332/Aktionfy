import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const DecisionNode = ({ data, selected }) => {
  const { task } = data;
  const isProcessing = task.status === 'processing';
  const isHalted = task.status === 'halted';
  const isSwarm = task.task_type === 'swarm_router';

  return (
    <div className={`relative flex items-center justify-center transition-all duration-500 ${isProcessing ? 'scale-110' : ''}`}>
      {/* Diamond Shape Container */}
      <div 
        className={`
          w-32 h-32 rotate-45 flex items-center justify-center
          backdrop-blur-xl transition-all duration-300
          ${selected ? `ring-2 ${isSwarm ? 'ring-purple-500' : 'ring-indigo-500'} ring-offset-4 ring-offset-zinc-900` : ''}
          ${isProcessing ? (isSwarm ? 'bg-purple-600/30 border-2 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.4)]' : 'bg-indigo-600/30 border-2 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)]') : 'glass-surface'}
          ${isHalted ? 'bg-rose-500/20 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : ''}
          rounded-xl
        `}
      >
        {/* Content Wrapper (Counter-rotated) */}
        <div className="-rotate-45 flex flex-col items-center gap-1 text-center w-full px-2">
          <div className={`text-[8px] font-black uppercase tracking-widest ${isSwarm ? 'text-purple-400' : 'text-indigo-400'}`}>
            {isSwarm ? 'Swarm' : 'Decision'}
          </div>
          <div className="font-bold text-white text-[10px] leading-tight max-w-[80px] truncate" title={task.name}>
            {task.name}
          </div>
          <div className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
            task.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 
            task.status === 'processing' ? (isSwarm ? 'bg-purple-500/20 text-purple-400 animate-pulse' : 'bg-indigo-500/20 text-indigo-400 animate-pulse') :
            task.status === 'halted' ? 'bg-rose-500/20 text-rose-400' :
            'bg-zinc-500/20 text-zinc-400'
          }`}>
            {task.status}
          </div>
        </div>
      </div>

      {/* Pulsing Aura for processing */}
      {isProcessing && (
        <div className={`absolute inset-0 ${isSwarm ? 'bg-purple-500/10' : 'bg-indigo-500/10'} rounded-full -z-10 animate-ping duration-[2000ms]`} />
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!${isSwarm ? 'bg-purple-500' : 'bg-indigo-500'} !w-2 !h-2 !border-none`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!${isSwarm ? 'bg-purple-500' : 'bg-indigo-500'} !w-2 !h-2 !border-none`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!${isSwarm ? 'bg-purple-500' : 'bg-indigo-500'} !w-2 !h-2 !border-none`}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={`!${isSwarm ? 'bg-purple-500' : 'bg-indigo-500'} !w-2 !h-2 !border-none`}
      />
    </div>
  );
};

export default memo(DecisionNode);
