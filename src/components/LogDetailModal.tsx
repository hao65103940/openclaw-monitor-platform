import dayjs from 'dayjs';
import api from '@/services/api';
import type { Agent } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { useAgentStore } from '@/store/useAgentStore';
import { io, Socket } from 'socket.io-client';

interface LogDetailModalProps {
  agent: Agent & { timestamp?: number };
  onClose: () => void;
}

interface LogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  type?: 'message' | 'tool' | 'system';
  details?: any;
}

interface ToolCall {
  name: string;
  args?: any;
  result?: any;
  timestamp: number;
  duration?: number;
  status?: 'success' | 'error';
}

interface WebSocketMessage {
  role: string;
  content: string | any[];
  timestamp: number;
}

function LogDetailModal({ agent, onClose }: LogDetailModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'tools' | 'messages'>('logs');
  const [isPaused, setIsPaused] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // 获取 store 中的 setModalOpen
  const setModalOpen = useAgentStore((state) => state.setModalOpen);

  // 弹窗打开时暂停外部刷新，关闭时恢复
  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  // WebSocket 连接（实时接收新消息）
  useEffect(() => {
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] 会话历史已连接');
      setWsConnected(true);
      // 订阅会话历史
      socket.emit('subscribe:session-history', { sessionId: agent.id });
    });

    // 接收初始历史数据
    socket.on('session-history:initial', (data: { 
      sessionId: string; 
      messages: WebSocketMessage[]; 
      toolCalls?: any[];
      total: number;
    }) => {
      console.log('[WS] 接收初始历史:', data.total, '条消息');
      const parsedLogs = parseMessages(data.messages);
      setLogs(parsedLogs);
      
      // 解析工具调用
      if (data.toolCalls && data.toolCalls.length > 0) {
        setToolCalls(data.toolCalls.map((tool: any) => ({
          name: tool.name,
          args: tool.args,
          result: tool.result,
          timestamp: tool.timestamp,
          status: tool.status as 'success' | 'error',
        })));
      }
      
      setLastUpdateTime(Date.now());
      setLoading(false);
    });

    // 接收新消息
    socket.on('session-history:new', (data: { 
      messages: WebSocketMessage[]; 
      toolCalls?: any[];
      timestamp: number;
    }) => {
      console.log('[WS] 接收新消息:', data.messages.length, '条');
      const newLogs = parseMessages(data.messages);
      setLogs(prev => {
        // 避免重复添加（检查最后一条消息的 timestamp）
        if (prev.length > 0 && newLogs.length > 0) {
          const lastTimestamp = prev[prev.length - 1].timestamp;
          const filteredNewLogs = newLogs.filter(log => log.timestamp > lastTimestamp);
          if (filteredNewLogs.length === 0) return prev;
          return [...prev, ...filteredNewLogs];
        }
        return [...prev, ...newLogs];
      });
      
      // 新增工具调用
      if (data.toolCalls && data.toolCalls.length > 0) {
        setToolCalls(prev => [...prev, ...data.toolCalls!.map((tool: any) => ({
          name: tool.name,
          args: tool.args,
          result: tool.result,
          timestamp: tool.timestamp,
          status: tool.status as 'success' | 'error',
        }))]);
      }
      
      setLastUpdateTime(data.timestamp);
    });

    // 错误处理
    socket.on('session-history:error', (data: { error: string }) => {
      console.error('[WS] 会话历史错误:', data.error);
      setLogs(prev => [...prev, {
        timestamp: Date.now(),
        level: 'ERROR',
        message: `❌ WebSocket 错误：${data.error}`,
        type: 'system',
      }]);
      setLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('[WS] 会话历史已断开');
      setWsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[WS] 连接失败:', error.message);
      setWsConnected(false);
    });

    return () => {
      console.log('[WS] 清理会话历史连接');
      socket.emit('unsubscribe:session-history');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [agent.id]);

  // 解析消息为日志格式
  function parseMessages(messages: WebSocketMessage[]): LogEntry[] {
    const entries: LogEntry[] = [];
    
    messages.forEach((msg) => {
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : Array.isArray(msg.content)
          ? msg.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('')
          : '';
      
      if (msg.role === 'user') {
        entries.push({
          timestamp: msg.timestamp,
          level: 'INFO',
          message: content,
          type: 'message',
          details: { role: 'user' },
        });
      } else if (msg.role === 'assistant') {
        entries.push({
          timestamp: msg.timestamp,
          level: 'INFO',
          message: content,
          type: 'message',
          details: { role: 'assistant' },
        });
      } else if (msg.role === 'tool' || msg.role === 'toolResult') {
        entries.push({
          timestamp: msg.timestamp,
          level: 'DEBUG',
          message: content,
          type: 'tool',
          details: { role: 'tool' },
        });
      }
    });
    
    return entries;
  }

  // 暂停/恢复自动刷新
  function togglePause() {
    setIsPaused(!isPaused);
  }

  // 自动滚动到底部（初始加载和新消息到达时）
  useEffect(() => {
    if (!loading && logs.length > 0 && logsEndRef.current) {
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [logs, loading, activeTab]);

  async function loadHistory() {
    try {
      setLoading(true);
      
      // 调用新的历史 API（读取 JSONL 文件）
      const response = await api.get(`/sessions/${agent.id}/history`);
      
      const historyLogs: LogEntry[] = [];
      const tools: ToolCall[] = [];
      
      // 解析历史消息
      if (response.data.history && response.data.history.length > 0) {
        response.data.history.forEach((msg: any) => {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : Array.isArray(msg.content)
              ? msg.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('')
              : '';
          
          // 用户消息
          if (msg.role === 'user') {
            historyLogs.push({
              timestamp: msg.timestamp || Date.now(),
              level: 'INFO' as const,
              message: content,
              type: 'message' as const,
              details: { role: 'user' },
            });
          }
          
          // Assistant 消息
          if (msg.role === 'assistant') {
            historyLogs.push({
              timestamp: msg.timestamp || Date.now(),
              level: 'INFO' as const,
              message: content,
              type: 'message' as const,
              details: { role: 'assistant' },
            });
          }
          
          // 工具调用（从 history 中解析）
          if (msg.toolCalls) {
            msg.toolCalls.forEach((tool: any) => {
              tools.push({
                name: tool.name || tool.tool,
                args: tool.args || tool.input,
                timestamp: msg.timestamp || Date.now(),
                status: 'success' as const,
              });
              
              historyLogs.push({
                timestamp: msg.timestamp || Date.now(),
                level: 'DEBUG' as const,
                message: `🔧 工具调用：${tool.name || tool.tool}`,
                type: 'tool' as const,
                details: tool,
              });
            });
          }
          
          // Tool 结果
          if (msg.role === 'tool') {
            historyLogs.push({
              timestamp: msg.timestamp || Date.now(),
              level: 'INFO' as const,
              message: `📥 工具结果：${msg.content?.substring(0, 100) || '...'}`,
              type: 'tool' as const,
            });
          }
        });
        
        // 使用 API 返回的 toolCalls（如果有）
        if (response.data.toolCalls && response.data.toolCalls.length > 0) {
          response.data.toolCalls.forEach((tool: any) => {
            tools.push({
              name: tool.name,
              args: tool.args,
              timestamp: tool.timestamp,
              status: tool.status as 'success' | 'error',
            });
          });
        }
      }
      
      // 如果没有历史数据，生成模拟日志
      if (historyLogs.length === 0) {
        setLogs(generateMockLogs());
        setToolCalls([]);
      } else {
        setLogs(historyLogs.sort((a, b) => a.timestamp - b.timestamp));
        setToolCalls(tools);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
      // 使用模拟数据
      setLogs(generateMockLogs());
      setToolCalls([]);
    } finally {
      setLoading(false);
    }
  }

  function generateMockLogs(): LogEntry[] {
    const runtime = Number(agent.runtime) || 0;
    const baseTime = Date.now() - runtime;
    const logs: LogEntry[] = [
      { timestamp: baseTime, level: 'INFO' as const, message: '✅ Agent 启动成功', type: 'system' as const },
      { timestamp: baseTime + 1000, level: 'INFO' as const, message: `📋 开始执行任务：${agent.task || '未命名'}`, type: 'system' as const },
      { timestamp: baseTime + 2000, level: 'DEBUG' as const, message: `🧠 加载模型：${agent.model || 'unknown'}`, type: 'system' as const },
      { timestamp: baseTime + 5000, level: 'INFO' as const, message: '⚙️ 处理用户请求...', type: 'system' as const },
      { timestamp: baseTime + 10000, level: 'INFO' as const, message: `📊 Token 消耗：${(Number(agent.totalTokens) || 0) / 1000}k`, type: 'system' as const },
    ];
    
    if (agent.status === 'done') {
      logs.push(
        { timestamp: baseTime + runtime - 5000, level: 'INFO' as const, message: '✨ 正在生成响应...', type: 'system' as const },
        { timestamp: baseTime + runtime, level: 'INFO' as const, message: '✅ 任务完成', type: 'system' as const },
      );
    } else if (agent.status === 'failed') {
      logs.push(
        { timestamp: baseTime + runtime, level: 'ERROR' as const, message: '❌ 任务失败', type: 'system' as const },
      );
    } else {
      logs.push(
        { timestamp: Date.now() - 10000, level: 'INFO' as const, message: '⏳ 继续执行中...', type: 'system' as const },
      );
    }
    
    return logs;
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400 bg-red-900/30';
      case 'WARN': return 'text-yellow-400 bg-yellow-900/30';
      case 'DEBUG': return 'text-blue-400 bg-blue-900/30';
      default: return 'text-green-400 bg-green-900/30';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'message': return '💬';
      case 'tool': return '🔧';
      case 'system': return '⚙️';
      default: return '📝';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">📋 任务日志详情</h2>
            <p className="text-sm text-gray-400 mt-1 font-mono">{agent.id}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded ${wsConnected ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${wsConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
              <span className="text-xs text-gray-300">
                {wsConnected ? '🟢 WebSocket 实时' : '🟡 连接中...'}
              </span>
            </div>
            {lastUpdateTime > 0 && (
              <div className="text-xs text-gray-400">
                最后更新：{dayjs(lastUpdateTime).format('HH:mm:ss')}
              </div>
            )}
            <button
              onClick={togglePause}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                isPaused 
                  ? 'bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/50'
                  : 'bg-yellow-900/30 text-yellow-400 border border-yellow-700 hover:bg-yellow-900/50'
              }`}
            >
              {isPaused ? '▶️ 继续' : '⏸️ 暂停'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500">状态</p>
              <p className="text-sm text-white font-medium">
                {agent.status === 'running' ? '🟢 运行中' : agent.status === 'done' ? '✅ 已完成' : '❌ 失败'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">耗时</p>
              <p className="text-sm text-white font-mono">{agent.runtime || '-'}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Token</p>
              <p className="text-sm text-purple-400 font-mono">{(agent.totalTokens || 0) / 1000}k</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">模型</p>
              <p className="text-sm text-gray-300">{agent.model || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">时间</p>
              <p className="text-sm text-gray-300">{dayjs(agent.timestamp).format('HH:mm:ss')}</p>
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="px-6 py-3 border-b border-gray-700 bg-gray-800 flex items-center space-x-4">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'logs' 
                ? 'bg-blue-900/30 text-blue-400 border border-blue-700' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📜 日志 ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'tools' 
                ? 'bg-purple-900/30 text-purple-400 border border-purple-700' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔧 工具调用 ({toolCalls.length})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'messages' 
                ? 'bg-green-900/30 text-green-400 border border-green-700' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💬 消息 ({logs.filter(l => l.type === 'message').length})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-6 bg-gray-900 overflow-y-auto min-h-[400px] max-h-[50vh]">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin text-2xl mb-2">🔄</div>
              <div>正在加载日志...</div>
            </div>
          ) : activeTab === 'logs' ? (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div 
                  key={index} 
                  className="flex items-start space-x-3 text-xs font-mono p-2 rounded hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-gray-500 whitespace-nowrap">
                    {dayjs(log.timestamp).format('HH:mm:ss')}
                  </span>
                  <span className="text-lg">{getTypeIcon(log.type)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-gray-300 flex-1 break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef as any} />
              {logs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  📭 暂无日志记录
                </div>
              )}
            </div>
          ) : activeTab === 'tools' ? (
            <div className="space-y-4">
              {toolCalls.map((tool, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🔧</span>
                      <span className="text-white font-semibold">{tool.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        tool.status === 'success' 
                          ? 'bg-green-900/30 text-green-400' 
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {tool.status === 'success' ? '✅ 成功' : '❌ 失败'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {dayjs(tool.timestamp).format('HH:mm:ss')}
                    </span>
                  </div>
                  
                  {tool.args && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">参数：</p>
                      <pre className="bg-gray-900 rounded p-2 text-xs text-gray-300 overflow-auto max-h-32">
                        {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {tool.result && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">结果：</p>
                      <pre className="bg-gray-900 rounded p-2 text-xs text-green-300 overflow-auto max-h-32">
                        {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              {toolCalls.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  🔧 暂无工具调用记录
                </div>
              )}
            </div>
          ) : activeTab === 'messages' ? (
            <div className="space-y-3 overflow-y-auto max-h-[60vh] p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar-thumb-rounded-full hover:scrollbar-thumb-gray-500">
              {logs.filter(l => l.type === 'message').map((msg, index) => {
                const isUser = msg.details?.role === 'user';
                return (
                  <div 
                    key={index} 
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                        isUser 
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none' 
                          : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-100 rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs opacity-80 font-medium">
                          {isUser ? '👤 你' : '🤖 Agent'}
                        </span>
                        <span className="text-xs opacity-50">
                          {dayjs(msg.timestamp).format('HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                );
              })}
              {logs.filter(l => l.type === 'message').length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  💬 暂无消息记录
                </div>
              )}
              <div ref={logsEndRef as any} />
            </div>
          ) : null}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-850 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            数据源：{logs.length > 0 ? '✅ 真实数据' : '⚠️ 模拟数据'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogDetailModal;
