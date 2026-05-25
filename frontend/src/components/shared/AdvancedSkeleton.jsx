import { motion } from 'framer-motion';

export const Shimmer = ({ className = "" }) => (
  <div className={`relative overflow-hidden bg-zinc-900 rounded ${className}`}>
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: '100%' }}
      transition={{
        repeat: Infinity,
        duration: 1.5,
        ease: 'linear',
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
    />
  </div>
);

export const SkeletonMetric = () => (
  <div className="bg-zinc-950 border border-zinc-800/50 rounded-2xl p-10 relative overflow-hidden">
    <div className="flex items-start justify-between mb-8">
      <Shimmer className="w-12 h-12 rounded-2xl" />
      <Shimmer className="w-16 h-6 rounded-full" />
    </div>
    <div className="space-y-3">
      <Shimmer className="w-24 h-3 rounded ml-1" />
      <Shimmer className="w-32 h-10 rounded" />
    </div>
  </div>
);

export const SkeletonChart = ({ height = "h-72" }) => (
  <div className="bg-zinc-950 border border-zinc-800/50 rounded-3xl p-10 relative overflow-hidden">
    <div className="flex items-center gap-4 mb-12">
      <Shimmer className="w-10 h-10 rounded-xl" />
      <div className="space-y-2">
        <Shimmer className="w-40 h-6 rounded" />
        <Shimmer className="w-32 h-3 rounded" />
      </div>
    </div>
    <Shimmer className={`w-full ${height} rounded-xl`} />
  </div>
);

export const AdvancedSkeleton = {
  Metric: SkeletonMetric,
  Chart: SkeletonChart,
  Shimmer: Shimmer
};

export default AdvancedSkeleton;
