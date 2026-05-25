import { motion } from 'framer-motion';

export const SkeletonRow = ({ columns = 4 }) => (
  <tr className="border-b border-zinc-800/50">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className={`h-4 bg-zinc-800/50 rounded animate-pulse ${i === 0 ? 'w-full' : 'w-2/3'}`}></div>
      </td>
    ))}
  </tr>
);

export const SkeletonCard = () => (
  <motion.div 
    className="p-6 bg-gray-900 rounded-xl border border-gray-800"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="flex justify-between items-start mb-4">
      <div className="h-5 w-1/3 bg-gray-800 rounded animate-pulse"></div>
      <div className="h-8 w-8 bg-gray-800 rounded-full animate-pulse"></div>
    </div>
    <div className="h-10 w-1/2 bg-gray-800 rounded animate-pulse mb-2"></div>
    <div className="h-3 w-1/4 bg-gray-800 rounded animate-pulse"></div>
  </motion.div>
);

export const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="w-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
    <div className="flex items-center space-x-4 p-4 border-b border-gray-800 bg-gray-800/50">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={`th-${i}`} className={`h-4 bg-gray-700 rounded animate-pulse ${i === 0 ? 'w-1/4' : 'w-1/6'}`}></div>
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={`tr-${i}`} columns={columns} />
    ))}
  </div>
);
