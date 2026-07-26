import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNotify } from '../context/NotificationContext';
import { Database, Table, Code2, Search, Play, Loader2, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

const AdminDatabase = () => {
  const { notify } = useNotify();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for table view
  const [page, setPage] = useState(0);
  const limit = 50;

  // Query editor state
  const [activeTab, setActiveTab] = useState('tables'); // 'tables' or 'query'
  const [rawQuery, setRawQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');

  const tableRequestVersion = useRef(0);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable && activeTab === 'tables') {
      fetchTableData(selectedTable, page);
    }
  }, [selectedTable, page, activeTab]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/v1/admin/database/tables');
      if (res.data.success) {
        setTables(res.data.data);
      }
    } catch (err) {
      notify('Failed to load tables', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName, pageIndex) => {
    const currentVersion = ++tableRequestVersion.current;
    setDataLoading(true);
    if (pageIndex === 0) setTableData(null);
    try {
      const offset = pageIndex * limit;
      const res = await axios.get(`/api/v1/admin/database/tables/${tableName}?limit=${limit}&offset=${offset}`);
      if (currentVersion === tableRequestVersion.current && res.data.success) {
        setTableData(res.data.data);
      }
    } catch (err) {
      if (currentVersion === tableRequestVersion.current) {
        notify('Failed to load table data', 'error');
      }
    } finally {
      if (currentVersion === tableRequestVersion.current) {
        setDataLoading(false);
      }
    }
  };

  const executeQuery = async () => {
    if (!rawQuery.trim()) {
      notify('Query cannot be empty', 'error');
      return;
    }
    setQueryLoading(true);
    setQueryError('');
    try {
      const res = await axios.post('/api/v1/admin/database/query', { query: rawQuery });
      if (res.data.success) {
        setQueryResult(res.data.data);
        notify('Query executed successfully', 'success');
      }
    } catch (err) {
      setQueryError(err.response?.data?.error || 'Failed to execute query');
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  };

  const filteredTables = tables.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-primary/20 to-brand-primary/5 rounded-xl border border-brand-primary/20">
              <Database className="w-6 h-6 text-brand-primary" />
            </div>
            Database Manager
          </h1>
          <p className="mt-2 text-zinc-400">View and query the raw PostgreSQL database.</p>
        </div>
        
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button 
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'tables' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Table className="w-4 h-4" /> Tables View
          </button>
          <button 
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'query' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Code2 className="w-4 h-4" /> SQL Editor
          </button>
        </div>
      </div>

      {activeTab === 'tables' ? (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Tables Sidebar */}
          <div className="w-64 shrink-0 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>
              <button 
                onClick={fetchTables} 
                disabled={loading}
                className="p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
                title="Refresh Tables"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTables.map(tableName => (
                <button
                  key={tableName}
                  onClick={() => { setSelectedTable(tableName); setPage(0); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 mb-1 ${
                    selectedTable === tableName 
                      ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' 
                      : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'
                  }`}
                >
                  <Table className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tableName}</span>
                </button>
              ))}
              {filteredTables.length === 0 && (
                <div className="text-center py-4 text-sm text-zinc-500">No tables found.</div>
              )}
            </div>
          </div>

          {/* Table Data Viewer */}
          <div className="flex-1 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
            {selectedTable ? (
              <>
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-white">{selectedTable}</h3>
                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {tableData ? tableData.total : 0} rows
                    </span>
                  </div>
                  <button onClick={() => fetchTableData(selectedTable, page)} className="text-zinc-400 hover:text-white transition-colors" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto bg-zinc-950/50">
                  {dataLoading && !tableData ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                    </div>
                  ) : tableData ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-black/20">
                      <div className="flex-1 overflow-auto relative">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 shadow-sm z-10">
                            <tr>
                              {tableData.columns.map(col => (
                                <th key={col} className="px-4 py-3 font-medium text-zinc-300 whitespace-nowrap border-r border-zinc-800/50 last:border-0">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {tableData.rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                                {tableData.columns.map(col => (
                                  <td key={col} className="px-4 py-2 text-zinc-400 whitespace-nowrap max-w-xs truncate border-r border-zinc-800/50 last:border-0" title={row[col]?.toString() || 'null'}>
                                    {row[col] === null ? <span className="text-zinc-600 italic">null</span> : row[col].toString()}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {tableData.rows.length === 0 && (
                              <tr>
                                <td colSpan={tableData.columns.length || 1} className="px-4 py-8 text-center text-zinc-500">No data in this table.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination */}
                      {tableData.total > limit && (
                        <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                          <div className="text-xs text-zinc-400">
                            Showing {page * limit + 1} to {Math.min((page + 1) * limit, tableData.total)} of {tableData.total}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              disabled={page === 0 || dataLoading}
                              onClick={() => setPage(p => p - 1)}
                              className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button 
                              disabled={(page + 1) * limit >= tableData.total || dataLoading}
                              onClick={() => setPage(p => p + 1)}
                              className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 transition-colors"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : selectedTable ? (
                    <div className="flex h-full items-center justify-center text-zinc-500 flex-col gap-4">
                      <AlertCircle className="w-12 h-12 opacity-20 text-red-500" />
                      <p>Failed to load data for {selectedTable}.</p>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-500 flex-col gap-4">
                      <Database className="w-12 h-12 opacity-20" />
                      <p>Select a table from the sidebar to view its data</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <Database className="w-12 h-12 text-zinc-700 mb-4" />
                <p>Select a table to view its contents</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="h-64 shrink-0 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm relative group">
            <div className="absolute right-4 top-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={executeQuery}
                disabled={queryLoading}
                className="px-3 py-1.5 bg-brand-primary text-zinc-950 font-medium rounded-md text-xs flex items-center gap-1.5 hover:bg-brand-secondary transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.3)]"
              >
                {queryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Run Query
              </button>
            </div>
            <textarea
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              disabled={queryLoading}
              placeholder="SELECT * FROM tasks WHERE status = 'error' LIMIT 10;"
              className="w-full h-full bg-zinc-950 text-zinc-300 font-mono text-sm p-4 focus:outline-none resize-none"
              spellCheck="false"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!queryLoading) executeQuery();
                  return;
                }
                if (e.key === 'Tab') {
                  if (e.target.selectionStart === e.target.selectionEnd) {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    setRawQuery(rawQuery.substring(0, start) + '  ' + rawQuery.substring(start));
                    setTimeout(() => {
                      e.target.selectionStart = e.target.selectionEnd = start + 2;
                    }, 0);
                  }
                }
              }}
            />
          </div>

          {queryError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex gap-3 shrink-0 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="font-mono text-sm break-all">{queryError}</div>
            </div>
          )}

          <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col min-h-0 relative">
            {queryLoading && (
              <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              </div>
            )}
            {queryResult ? (
              <div className="flex-1 overflow-x-auto min-h-0 relative bg-black/20 rounded-lg border border-zinc-800">
                {queryResult.limit_reached && (
                  <div className="m-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-4 py-3 rounded-md flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm">
                      <strong>Memory Protection Limit Reached:</strong> Results have been safely truncated to the first 500 rows to prevent server exhaustion. Please use a LIMIT clause.
                    </span>
                  </div>
                )}
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 shadow-sm z-10">
                    <tr>
                      {queryResult.columns.map(col => (
                        <th key={col} className="px-4 py-3 font-medium text-zinc-300 whitespace-nowrap border-r border-zinc-800/50 last:border-0">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                        {queryResult.columns.map(col => (
                          <td key={col} className="px-4 py-2 text-zinc-400 whitespace-nowrap max-w-[400px] truncate border-r border-zinc-800/50 last:border-0" title={row[col]?.toString() || 'null'}>
                            {row[col] === null ? <span className="text-zinc-600 italic">null</span> : row[col].toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {queryResult.rows.length === 0 && (
                      <tr>
                        <td colSpan={queryResult.columns.length || 1} className="px-4 py-8 text-center text-zinc-500">
                          {queryResult.command_tag && queryResult.command_tag.startsWith('SELECT') && queryResult.rows.length === 0 
                            ? 'Query executed successfully, but returned no rows.' 
                            : `Query executed successfully. ${queryResult.rows_affected !== undefined ? queryResult.rows_affected : 0} rows affected.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <Code2 className="w-12 h-12 text-zinc-800 mb-4" />
                <p>Run a SQL query to see results here</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDatabase;
