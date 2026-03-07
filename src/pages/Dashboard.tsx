import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useAgentStore } from '../store/useAgentStore';
import type { Agent, Stats } from '../types';
import LogDetailModal from '../components/LogDetailModal';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

function StatCard({ title, value, icon, color, subtext }: { 
  title: string; 
  value: string | number; 
  icon: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-6 border-l-4 ${color} shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2 text-white">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className="text-4xl opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function AgentStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; bg: string; icon: string }> = {
    running: { color: 'text-green-300', bg: 'bg-green-900/50', icon: '🟢' },
    done: { color: 'text-blue-300', bg: 'bg-blue-900/50', icon: '✅' },
    failed: { color: 'text-red-300', bg: 'bg-red-900/50', icon: '❌' },
    pending: { color: 'text-yellow-300', bg: 'bg-yellow-900/50', icon: '🟡' },
  };

  const config = statusConfig[status] || { color: 'text-gray-300', bg: 'bg-gray-900/50', icon: '⚪' };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} border border-${config.color.split('-')[1]}-700`}>
      <span className="mr-1.5">{config.icon}</span>
      {status === 'running' ? '运行中' : status === 'done' ? '已完成' : status === 'failed' ? '失败' : status}
    </span>
  );
}

function AgentTable({ agents, title, emptyMessage, onViewLog }: { 
  agents: Agent[]; 
  title: string; 
  emptyMessage?: string;
  onViewLog?: (agent: Agent) => void;
}) {
  if (!agents || agents.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
        <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
        <p className="text-gray-400 text-center py-8">{emptyMessage || '暂无数据'}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                任务
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                耗时
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                模型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                时间
              </th>
              {onViewLog && (
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4">
                  <div className="max-w-xl">
                    <div className="text-sm text-white font-medium mb-1">{agent.label || '未命名任务'}</div>
                    <div className="text-xs text-gray-400 truncate" title={agent.task}>
                      {(agent.task || '').substring(0, 100)}{agent.task && agent.task.length > 100 ? '...' : ''}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <AgentStatusBadge status={agent.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono">
                  {agent.runtime || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono">
                  {agent.totalTokens ? (
                    <span className="text-purple-400">{(agent.totalTokens / 1000).toFixed(1)}k</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {agent.model || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {agent.startedAt ? (
                    <div>
                      <div>{dayjs(agent.startedAt).format('HH:mm:ss')}</div>
                      <div className="text-xs text-gray-500">{dayjs(agent.startedAt).fromNow()}</div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                {onViewLog && (
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onViewLog(agent)}
                      className="px-3 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      📋 查看
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaginatedAgentTable({ agents, title, pageSize = 10, onViewLog }: { 
  agents: Agent[]; 
  title: string; 
  pageSize?: number;
  onViewLog?: (agent: Agent) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(agents.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentAgents = agents.slice(startIndex, endIndex);

  // 重置页码当数据变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [agents]);

  if (!agents || agents.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
        <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
        <p className="text-gray-400 text-center py-8">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-850 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-gray-400">{agents.length} 条记录</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                任务
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                耗时
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                模型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                时间
              </th>
              {onViewLog && (
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {currentAgents.map((agent, index) => (
              <tr key={`${agent.id}-${index}-${agent.startedAt || Date.now()}`} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4">
                  <div className="max-w-xl">
                    <div className="text-sm text-white font-medium mb-1">{agent.label || '未命名任务'}</div>
                    <div className="text-xs text-gray-400 truncate" title={agent.task}>
                      {(agent.task || '').substring(0, 100)}{agent.task && agent.task.length > 100 ? '...' : ''}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <AgentStatusBadge status={agent.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono">
                  {agent.runtime || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono">
                  {agent.totalTokens ? (
                    <span className="text-purple-400">{(agent.totalTokens / 1000).toFixed(1)}k</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {agent.model || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {agent.startedAt ? (
                    <div>
                      <div>{dayjs(agent.startedAt).format('HH:mm:ss')}</div>
                      <div className="text-xs text-gray-500">{dayjs(agent.startedAt).fromNow()}</div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                {onViewLog && (
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onViewLog(agent)}
                      className="px-3 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      📋 查看
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-850 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { activeAgents, recentAgents, stats, loading, error, refreshAll, lastUpdated, apiStopped, resetApiRetry } = useAgentStore();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // 动态更新时间（每秒）
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 初始加载和定时刷新（30 秒）
  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      // 如果 API 已停止，不再自动刷新
      if (!apiStopped) {
        refreshAll();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshAll, apiStopped]);

  const currentStats = stats || {
    activeAgents: 0,
    completedAgents: 0,
    failedAgents: 0,
    totalTokens: 0,
  };

  return (
    <div className="space-y-6">
      {/* 状态提示 */}
      {apiStopped ? (
        <div className="rounded-lg p-4 border bg-red-900/30 border-red-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-300">
                  API 已停止自动刷新
                </p>
                <p className="text-sm text-gray-400">
                  🚫 后端服务不可用，已连续失败 3 次
                </p>
              </div>
            </div>
            <button
              onClick={resetApiRetry}
              className="px-4 py-2 rounded-md text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors flex items-center space-x-2"
            >
              <span>🔄</span>
              <span>重试连接</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg p-4 border bg-green-900/30 border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔌</span>
              <div>
                <p className="font-semibold text-green-300">
                  实时数据模式
                </p>
                <p className="text-sm text-gray-400">
                  📊 正在从 OpenClaw 获取真实 Agent 数据
                  {lastUpdated && (
                    <span className="ml-2 text-xs">
                      • 最后更新：{dayjs(lastUpdated).format('HH:mm:ss')}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={refreshAll}
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">🔄</span>
                  <span>刷新中...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>刷新数据</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 加载提示 */}
      {loading && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-center">
          <p className="text-blue-300">🔄 正在加载数据...</p>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="活跃 Agent"
          value={currentStats.activeAgents || 0}
          icon="🟢"
          color="border-green-500"
          subtext="正在运行中"
        />
        <StatCard
          title="已完成"
          value={currentStats.completedAgents || 0}
          icon="✅"
          color="border-blue-500"
          subtext="成功完成任务"
        />
        <StatCard
          title="失败"
          value={currentStats.failedAgents || 0}
          icon="❌"
          color="border-red-500"
          subtext="需要检查"
        />
        <StatCard
          title="总 Token"
          value={`${((currentStats.totalTokens || 0) / 1000).toFixed(1)}k`}
          icon="📊"
          color="border-purple-500"
          subtext="累计消耗"
        />
      </div>

      {/* 活跃 Agent */}
      <AgentTable 
        agents={activeAgents || []} 
        title="🟢 活跃 Agent" 
        emptyMessage="当前没有正在运行的 Agent"
        onViewLog={setSelectedAgent}
      />

      {/* 最近完成 - 分页展示 */}
      <PaginatedAgentTable 
        agents={recentAgents || []} 
        title="✅ 最近完成" 
        pageSize={10}
        onViewLog={setSelectedAgent}
      />

      {/* 日志详情弹窗 */}
      {selectedAgent && (
        <LogDetailModal 
          agent={selectedAgent} 
          onClose={() => setSelectedAgent(null)} 
        />
      )}
    </div>
  );
}

export default Dashboard;
