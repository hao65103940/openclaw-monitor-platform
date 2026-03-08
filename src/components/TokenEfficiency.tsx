import { useEffect, useState } from 'react';

interface TopSession {
  id: string;
  label: string;
  totalTokens: number;
  runtimeMs: number;
}

interface TokenEfficiencyData {
  success: boolean;
  avgTokensPerSession: number;
  tokenRate: number;
  topSessions: TopSession[];
  totalTokens: number;
  sessionCount: number;
}

export default function TokenEfficiency() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenEfficiencyData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/token-efficiency');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载 Token 效率失败:', err);
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
        <span className="text-xl mr-2">⚡</span>
        Token 效率分析
      </h3>

      {/* 指标卡片 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">平均每会话 Token</div>
          <div className="text-2xl font-bold text-blue-400">
            {(data.avgTokensPerSession / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.sessionCount} 个会话
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">Token 消耗速率</div>
          <div className="text-2xl font-bold text-green-400">
            {(data.tokenRate / 1000).toFixed(1)}k/s
          </div>
          <div className="text-xs text-gray-500 mt-1">
            总计 {(data.totalTokens / 1000000).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* Top 10 高消耗会话 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">🔝 Top 10 高消耗会话</h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {data.topSessions.map((session, index) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded ${
                  index < 3 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  {index + 1}
                </span>
                <span className="text-sm text-gray-300 max-w-[200px] truncate" title={session.label}>
                  {session.label}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-400">
                  {(session.totalTokens / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-gray-500">
                  {(session.runtimeMs / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
