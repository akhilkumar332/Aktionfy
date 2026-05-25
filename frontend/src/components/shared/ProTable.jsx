import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const ProTable = ({ 
  columns, 
  data, 
  isLoading, 
  emptyStateMessage = "No records found.",
  emptyStateIcon = null,
  pagination = null, // { page, limit, total, onPageChange, onLimitChange }
  onRowClick = null,
  className = ""
}) => {
  return (
    <div className={`pro-card overflow-hidden flex flex-col ${className}`}>
      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`pro-table-header px-6 py-3 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {isLoading ? (
              // Skeleton Loading State
              Array.from({ length: Math.min(pagination?.limit || 5, 5) }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="pro-table-row">
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-${rowIndex}-${colIndex}`} className="px-6 py-4">
                      <div className="h-4 bg-zinc-800/50 rounded animate-pulse w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr 
                  key={row.id || rowIndex} 
                  className={`pro-table-row ${onRowClick ? 'cursor-pointer hover:bg-zinc-800/40' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col, colIndex) => (
                    <td key={`${rowIndex}-${colIndex}`} className={`px-6 py-4 text-sm text-zinc-300 ${col.cellClassName || ''}`}>
                      {col.render ? col.render(row) : row[col.accessorKey]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    {emptyStateIcon && (
                      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full">
                        {emptyStateIcon}
                      </div>
                    )}
                    <p className="text-sm">{emptyStateMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && data && data.length > 0 && !isLoading && (
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-900/80 border-t border-zinc-800">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </span>
            <select 
              value={pagination.limit}
              onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              aria-label="Rows per page"
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => pagination.onPageChange(1)}
              disabled={pagination.page === 1}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button 
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="px-3 py-1 text-xs font-medium text-white bg-zinc-800 rounded">
              Page {pagination.page}
            </span>
            
            <button 
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              onClick={() => pagination.onPageChange(Math.ceil(pagination.total / pagination.limit))}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProTable;
