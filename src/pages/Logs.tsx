import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface LogFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  label?: string;
}

function Logs() {
  const [logs, setLogs] = useState<LogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<string>('server.log');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [linesCount, setLinesCount] = useState(200);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载日志文件列表
  useEffect(() => {
    async function loadLogsList() {
      try {
        const response = await api.get('/logs/list');
        setLogs(response.data.logs || []);
      } catch (error) {
        console.error('加载日志列表失败:', error);
      }
    }
    
    loadLogsList();
  }, []);

  // 读取日志内容
  useEffect(() => {
    if (!selectedLog || isPaused) return;

    async function loadLogs() {
      setLoading(true);
      try {
        const response = await api.get('/logs/read', {
          params: {
            file: selectedLog,
            lines: linesCount,
            filter: filterText,
          },
        });
        
        setLogLines(response.data.lines || []);
        setLastFetchTime(Date.now());
      } catch (error) {
        console.error('加载日志失败:', error);
        setLogLines(['❌ 加载失败：' + (error as Error).message]);
      } finally {
        setLoading(false);
      }
    }

    // 立即加载一次
    loadLogs();

    // 定时刷新（每 2 秒）
    const interval = setInterval(loadLogs, 2000);

    return () => clearInterval(interval);
  }, [selectedLog, isPaused, filterText, linesCount]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && !isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines, autoScroll, isPaused]);

  // 手动滚动时暂停自动滚动
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isNearBottom);
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleClear = () => {
    setLogLines([]);
  };

  const handleDownload = () => {
    const content = logLines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedLog.replace('.log', '')}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogLevel = (line: string) => {
    if (line.includes('ERROR') || line.includes('❌') || line.includes('error')) {
      return 'error';
    }
    if (line.includes('WARN') || line.includes('⚠️') || line.includes('warn')) {
      return 'warn';
    }
    if (line.includes('✅') || line.includes('success')) {
      return 'success';
    }
    if (line.includes('🔄') || line.includes('loading')) {
      return 'info';
    }
    return 'default';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* 顶部控制栏 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 日志文件选择 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">📄 日志文件:</label>
            <select
              value={selectedLog}
              onChange={(e) => setSelectedLog(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {logs.map((log) => (
                <option key={log.name} value={log.name}>
                  {log.label || log.name}
                </option>
              ))}
            </select>
          </div>

          {/* 行数选择 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">📊 显示行数:</label>
            <select
              value={linesCount}
              onChange={(e) => setLinesCount(Number(e.target.value))}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={50}>50 行</option>
              <option value={100}>100 行</option>
              <option value={200}>200 行</option>
              <option value={500}>500 行</option>
              <option value={1000}>1000 行</option>
            </select>
          </div>

          {/* 搜索过滤 */}
          <div className="flex items-center space-x-2 flex-1">
            <label className="text-sm text-gray-400">🔍 过滤:</label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="关键词过滤..."
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePause}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                isPaused
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isPaused ? '▶️ 继续' : '⏸️ 暂停'}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              🗑️ 清空
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            >
              💾 下载
            </button>
          </div>
        </div>

        {/* 状态信息 */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>
              {loading ? '🔄 加载中...' : '✅ 已更新'}
            </span>
            <span>
              共 {logLines.length} 行
            </span>
            <span>
              最后更新：{formatTimestamp(lastFetchTime)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span>自动滚动:</span>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-0.5 text-xs rounded ${
                autoScroll ? 'bg-green-600' : 'bg-gray-700'
              }`}
            >
              {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* 日志内容显示区 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-850 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">📝 {selectedLog}</h3>
          <span className="text-xs text-gray-400">
            每 2 秒自动刷新
          </span>
        </div>
        
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[600px] overflow-y-auto bg-gray-900 p-4 font-mono text-xs"
        >
          {loading && logLines.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              🔄 正在加载日志...
            </div>
          ) : logLines.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              📭 暂无日志
            </div>
          ) : (
            <div className="space-y-0.5">
              {logLines.map((line, idx) => {
                const level = getLogLevel(line);
                const levelColors = {
                  error: 'text-red-400 bg-red-900/20',
                  warn: 'text-yellow-400 bg-yellow-900/20',
                  success: 'text-green-400 bg-green-900/20',
                  info: 'text-blue-400 bg-blue-900/20',
                  default: 'text-gray-300',
                };
                
                return (
                  <div
                    key={idx}
                    className={`px-2 py-1 rounded ${levelColors[level]} hover:bg-gray-800 transition-colors`}
                  >
                    <pre className="whitespace-pre-wrap break-all">{line}</pre>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h4 className="text-sm font-semibold text-white mb-2">💡 使用说明</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• 自动刷新：每 2 秒自动获取最新日志</li>
          <li>• 暂停功能：点击"暂停"按钮可停止自动刷新</li>
          <li>• 关键词过滤：输入关键词快速定位相关日志</li>
          <li>• 自动滚动：默认自动滚动到最新日志，可手动关闭</li>
          <li>• 下载日志：点击"下载"按钮保存当前日志</li>
        </ul>
      </div>
    </div>
  );
}

export default Logs;
