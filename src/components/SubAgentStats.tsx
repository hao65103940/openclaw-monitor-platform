import { useEffect, useState } from 'react';

interface SubAgentStat {
  id: string;
  count: number;
  totalTokens: number;
  totalRuntime: number;
  avgTokens: number;
  avgRuntime: number;
  failureRate: number;
  parentAgents: string[];
}

interface SubAgentStatsData {
  success: boolean;
  subAgents: SubAgentStat[];
  totalSubAgents: number;
  totalSessions: number;
}

export default function SubAgentStats() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubAgentStatsData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/subagent-stats');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载子 Agent 统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <div className="animate-spin text-2xl mb-2">🔄</div>
          <div>正在加载...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">❌</div>
          <div>加载失败</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-modern p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">🤖</span>
        子 Agent 统计
      </h3>

      {/* 总览指标 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">子 Agent 数量</div>
          <div className="text-xl font-bold text-purple-400">
            {data.totalSubAgents}
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">总会话数</div>
          <div className="text-xl font-bold text-blue-400">
            {data.totalSessions}
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">平均/Agent</div>
          <div className="text-xl font-bold text-green-400">
            {data.totalSubAgents > 0 ? Math.round(data.totalSessions / data.totalSubAgents) : 0}
          </div>
        </div>
      </div>

      {/* 子 Agent 列表 */}
      {data.subAgents.length > 0 ? (
        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {data.subAgents.map((subAgent, index) => (
            <div
              key={subAgent.id}
              className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded ${
                  index < 3 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-gray-300">
                    {subAgent.id}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
                    <span>📊 {subAgent.count} 会话</span>
                    <span className="text-gray-600">|</span>
                    <span>⚡ 失败率 {subAgent.failureRate}%</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-400">
                  {(subAgent.totalTokens / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-gray-500">
                  {(subAgent.avgRuntime / 1000).toFixed(1)}s 平均
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  父 Agent: {subAgent.parentAgents.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12">
          <div className="text-4xl mb-2">🤖</div>
          <div>暂无子 Agent 会话</div>
          <div className="text-sm text-gray-500 mt-2">
            子 Agent 会话格式：agent:main:sub1
          </div>
        </div>
      )}
    </div>
  );
}
