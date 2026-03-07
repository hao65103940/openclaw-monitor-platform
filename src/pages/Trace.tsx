import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface TraceNode {
  id: string;
  agentId: string;
  channel: string;
  channelId?: string | null;
  kind: string;
  model: string;
  status: 'running' | 'completed' | 'failed' | 'waiting';
  tokens: number;
  runtime: number;
  timestamp: number;
  key: string;
  isActive: boolean;
}

interface ChannelStat {
  channel: string;
  count: number;
  tokens: number;
  runtime: number;
  activeCount: number;
  agents: string[];
  avgTokens: number;
  avgRuntime: number;
}

interface SubAgentLink {
  id: string;
  parentId: string;
  status: 'running' | 'completed' | 'failed' | 'created';
  timestamp: number;
  retries: number;
  error?: string;
}

interface FlowStep {
  step: number;
  agent: string;
  action: string;
  status: TraceNode['status'];
  timestamp: number;
  details: TraceNode;
}

function Trace() {
  const [flow, setFlow] = useState<TraceNode[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
  const [subAgentLinks, setSubAgentLinks] = useState<SubAgentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadAllData();
    // 自动刷新
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadAllData() {
    try {
      setRefreshing(true);
      const [traceResponse, channelResponse, subAgentResponse] = await Promise.all([
        api.get('/trace/flow'),
        api.get('/analytics/channels'),
        api.get('/trace/subagents'),
      ]);
      
      setFlow(traceResponse.data.flow || []);
      setChannelStats(channelResponse.data.channels || []);
      setSubAgentLinks(subAgentResponse.data.subagents || []);
      setLoading(false);
    } catch (error) {
      console.error('加载数据失败:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }

  function formatAgentName(agentId: string): string {
    const names: Record<string, string> = {
      'main': '主 Agent (夏娃 Eve ✨)',
      'feishu-agent': '飞书助手 📝',
      'wecom-agent': '企微助手 💼',
      'requirement-agent': '需求分析师 📋',
      'design-agent': '系统架构师 🏗️',
      'coding-agent': '高级开发工程师 💻',
      'review-agent': '代码审查员 🔍',
    };
    return names[agentId] || agentId;
  }

  function formatKind(kind: string): string {
    const kinds: Record<string, string> = {
      'direct': '直接会话',
      'group': '群组会话',
      'cron': '定时任务',
      'subagent': '子 Agent',
    };
    return kinds[kind] || kind;
  }

  function formatChannel(channel: string): string {
    const channels: Record<string, string> = {
      'feishu': '飞书 📝',
      'wecom': '企业微信 💼',
      'control-ui': 'Control-UI 🖥️',
      'cron': '定时任务 ⏰',
      'subagent': '子 Agent 🤖',
    };
    return channels[channel] || channel;
  }

  function getChannelIcon(channel: string): string {
    const icons: Record<string, string> = {
      'feishu': '📝',
      'wecom': '💼',
      'control-ui': '🖥️',
      'cron': '⏰',
      'subagent': '🤖',
    };
    return icons[channel] || '📊';
  }

  function getStatusBadge(status: TraceNode['status']) {
    const styles = {
      'running': 'bg-green-900/30 border-green-700 text-green-300',
      'completed': 'bg-blue-900/30 border-blue-700 text-blue-300',
      'failed': 'bg-red-900/30 border-red-700 text-red-300',
      'waiting': 'bg-gray-900/30 border-gray-700 text-gray-300',
    };
    const icons = {
      'running': '🟢',
      'completed': '✅',
      'failed': '❌',
      'waiting': '⏳',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs border ${styles[status]}`}>
        {icons[status]} {status}
      </span>
    );
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  const filteredFlow = flow.filter(node => {
    if (filter === 'active') return node.isActive;
    if (filter === 'completed') return !node.isActive;
    return true;
  });

  // 转换为流程步骤
  const steps: FlowStep[] = filteredFlow.map((node, index) => ({
    step: flow.length - index,
    agent: formatAgentName(node.agentId),
    action: formatKind(node.kind),
    status: node.isActive ? 'running' : node.status,
    timestamp: node.timestamp,
    details: node,
  }));

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-blue-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">总会话数</p>
              <p className="text-3xl font-bold mt-2 text-white">{flow.length}</p>
            </div>
            <div className="text-4xl opacity-80">💬</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-green-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">活跃会话</p>
              <p className="text-3xl font-bold mt-2 text-white">
                {flow.filter(s => s.isActive).length}
              </p>
            </div>
            <div className="text-4xl opacity-80">🟢</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-purple-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">总 Token</p>
              <p className="text-3xl font-bold mt-2 text-white">
                {formatNumber(flow.reduce((sum, s) => sum + (s.tokens || 0), 0))}
              </p>
            </div>
            <div className="text-4xl opacity-80">📊</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-yellow-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">平均耗时</p>
              <p className="text-3xl font-bold mt-2 text-white">
                {flow.length > 0 
                  ? formatDuration(flow.reduce((sum, s) => sum + (s.runtime || 0), 0) / flow.length)
                  : '0s'
                }
              </p>
            </div>
            <div className="text-4xl opacity-80">⏱️</div>
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold text-white">🔍 执行流程追踪</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'all' 
                ? 'bg-blue-700 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            全部 ({flow.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'active' 
                ? 'bg-green-700 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🟢 活跃 ({flow.filter(s => s.isActive).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'completed' 
                ? 'bg-gray-700 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ✅ 已完成 ({flow.filter(s => !s.isActive).length})
          </button>
        </div>
        <button
          onClick={loadAllData}
          disabled={refreshing}
          className={`ml-auto px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors flex items-center space-x-2 ${
            refreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
          <span>{refreshing ? '刷新中...' : '刷新'}</span>
        </button>
      </div>

      {/* 执行流程图 - 垂直时间线 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h3 className="text-lg font-semibold text-white">📊 执行流程时间线</h3>
          <p className="text-sm text-gray-400 mt-1">显示最近的 Agent 会话执行记录，点击查看详情</p>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              🔄 正在加载执行流程...
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              📭 暂无执行记录
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={`${step.step}-${step.details.id}`} className="relative">
                  {/* 连接线 */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-700"></div>
                  )}
                  
                  <div 
                    className={`relative flex items-center p-4 rounded-lg border transition-all cursor-pointer ${
                      step.details.isActive 
                        ? 'bg-green-900/20 border-green-700 shadow-lg shadow-green-900/20' 
                        : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedNode(step.details)}
                  >
                    {/* 步骤编号 */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      step.details.isActive 
                        ? 'bg-green-700 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {step.step}
                    </div>

                    {/* 内容 */}
                    <div className="ml-4 flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-white font-semibold">{step.agent}</h3>
                        {getStatusBadge(step.status)}
                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                          {step.action}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-400">
                        <span>📊 {formatNumber(step.details.tokens)} tokens</span>
                        <span>⏱️ {formatDuration(step.details.runtime)}</span>
                        <span>🕐 {formatTime(step.details.timestamp)}</span>
                        <span className="text-xs text-gray-500 font-mono">{step.details.agentId}</span>
                      </div>
                    </div>

                    {/* 模型标识 */}
                    <div className="ml-4 text-right">
                      <div className="text-xs text-gray-400">Model</div>
                      <div className="text-sm text-blue-400 font-mono">{step.details.model}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 子 Agent 链路追踪 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h3 className="text-lg font-semibold text-white">🔗 子 Agent 链路追踪</h3>
          <p className="text-sm text-gray-400 mt-1">从日志中解析的子 Agent 创建和执行情况</p>
        </div>
        
        <div className="p-6">
          {subAgentLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              📭 暂无子 Agent 执行记录
              <div className="text-xs mt-2">提示：子 Agent 由主 Agent 通过 sessions_spawn 创建</div>
            </div>
          ) : (
            <div className="space-y-3">
              {subAgentLinks.map((subagent) => (
                <div 
                  key={subagent.id}
                  className="flex items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  {/* 状态图标 */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    subagent.status === 'running' ? 'bg-green-900/30 text-green-400' :
                    subagent.status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                    subagent.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                    'bg-gray-900/30 text-gray-400'
                  }`}>
                    {subagent.status === 'running' ? '🟢' :
                     subagent.status === 'completed' ? '✅' :
                     subagent.status === 'failed' ? '❌' : '⏳'}
                  </div>
                  
                  {/* 子 Agent 信息 */}
                  <div className="ml-4 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold">🤖 {subagent.id.split(':').pop()}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        subagent.status === 'running' ? 'bg-green-900/30 text-green-300' :
                        subagent.status === 'completed' ? 'bg-blue-900/30 text-blue-300' :
                        subagent.status === 'failed' ? 'bg-red-900/30 text-red-300' :
                        'bg-gray-900/30 text-gray-300'
                      }`}>
                        {subagent.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      ID: <span className="font-mono text-xs">{subagent.id}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      父 Agent: <span className="font-mono text-xs text-blue-400">{subagent.parentId}</span>
                    </div>
                    {subagent.retries > 0 && (
                      <div className="text-sm text-orange-400">
                        ⚠️ 重试次数：{subagent.retries}
                      </div>
                    )}
                    {subagent.error && (
                      <div className="text-sm text-red-400">
                        ❌ 错误：{subagent.error}
                      </div>
                    )}
                  </div>
                  
                  {/* 时间 */}
                  <div className="text-right text-sm text-gray-400">
                    <div>{formatTime(subagent.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 渠道维度分析 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h3 className="text-lg font-semibold text-white">📱 渠道维度分析</h3>
          <p className="text-sm text-gray-400 mt-1">各渠道的会话分布、Token 消耗和活跃 Agent</p>
        </div>
        
        <div className="p-6">
          {channelStats.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              📭 暂无渠道数据
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channelStats.map((channel) => (
                <div 
                  key={channel.channel} 
                  className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="text-3xl">{getChannelIcon(channel.channel)}</div>
                    <div>
                      <div className="text-white font-semibold">{formatChannel(channel.channel)}</div>
                      <div className="text-xs text-gray-400">{channel.count} 次会话</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token 消耗</span>
                      <span className="text-white font-mono">{formatNumber(channel.tokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">平均 Token</span>
                      <span className="text-white font-mono">{formatNumber(channel.avgTokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">总耗时</span>
                      <span className="text-white font-mono">{formatDuration(channel.runtime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">平均耗时</span>
                      <span className="text-white font-mono">{formatDuration(channel.avgRuntime)}</span>
                    </div>
                    {channel.activeCount > 0 && (
                      <div className="flex justify-between pt-2 border-t border-gray-700">
                        <span className="text-gray-400">活跃会话</span>
                        <span className="text-green-400">🟢 {channel.activeCount}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">涉及 Agent</div>
                    <div className="flex flex-wrap gap-1">
                      {channel.agents.slice(0, 5).map(agentId => (
                        <span 
                          key={agentId} 
                          className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded"
                        >
                          {agentId}
                        </span>
                      ))}
                      {channel.agents.length > 5 && (
                        <span className="px-2 py-1 bg-gray-800 text-gray-500 text-xs rounded">
                          +{channel.agents.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent 协作统计 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h3 className="text-lg font-semibold text-white">🤝 Agent 协作统计</h3>
          <p className="text-sm text-gray-400 mt-1">各 Agent 的会话数量和 Token 消耗</p>
        </div>
        
        <div className="p-6">
          {(() => {
            // 按 Agent 分组统计
            const agentStats = flow.reduce((acc, node) => {
              if (!acc[node.agentId]) {
                acc[node.agentId] = { count: 0, tokens: 0, runtime: 0 };
              }
              acc[node.agentId].count += 1;
              acc[node.agentId].tokens += node.tokens || 0;
              acc[node.agentId].runtime += node.runtime || 0;
              return acc;
            }, {} as Record<string, { count: number; tokens: number; runtime: number }>);

            const sortedAgents = Object.entries(agentStats)
              .sort((a, b) => b[1].tokens - a[1].tokens);

            return (
              <div className="space-y-3">
                {sortedAgents.map(([agentId, stats]) => (
                  <div key={agentId} className="flex items-center p-3 bg-gray-900/50 rounded border border-gray-700">
                    <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center text-xl">
                      🤖
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="text-white font-semibold">{formatAgentName(agentId)}</div>
                      <div className="text-sm text-gray-400">
                        {stats.count} 次会话 · {formatNumber(stats.tokens)} tokens · {formatDuration(stats.runtime / stats.count)} 平均
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Token 占比</div>
                      <div className="text-blue-400 font-mono">
                        {((stats.tokens / flow.reduce((sum, s) => sum + s.tokens, 0)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedNode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedNode(null)}
        >
          <div 
            className="bg-gray-800 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">📋 会话详情</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">Agent ID</div>
                  <div className="text-white font-mono">{selectedNode.agentId}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">会话类型</div>
                  <div className="text-white">{formatKind(selectedNode.kind)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">状态</div>
                  <div>{getStatusBadge(selectedNode.status)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">模型</div>
                  <div className="text-blue-400 font-mono">{selectedNode.model}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Token 消耗</div>
                  <div className="text-white">{formatNumber(selectedNode.tokens)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">执行耗时</div>
                  <div className="text-white">{formatDuration(selectedNode.runtime)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">开始时间</div>
                  <div className="text-white">{formatTime(selectedNode.timestamp)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">活跃状态</div>
                  <div className={selectedNode.isActive ? 'text-green-400' : 'text-gray-400'}>
                    {selectedNode.isActive ? '🟢 进行中' : '⏸️ 已完成'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm mb-2">会话 Key</div>
                <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-300 break-all">
                  {selectedNode.key}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm mb-2">会话 ID</div>
                <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-300 break-all">
                  {selectedNode.id}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700">
              <button
                onClick={() => setSelectedNode(null)}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trace;
