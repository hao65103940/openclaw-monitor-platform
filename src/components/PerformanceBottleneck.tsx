import { useEffect, useState } from 'react';

interface SlowSession {
  id: string;
  label: string;
  runtimeMs: number;
  totalTokens: number;
}

interface PerformanceData {
  success: boolean;
  slowestSessions: SlowSession[];
  percentiles: { p50: number; p90: number; p99: number };
  avgRuntime: number;
}

export default function PerformanceBottleneck() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PerformanceData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/performance-bottleneck');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载性能分析失败:', err);
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
        性能瓶颈分析
      </h3>

      {/* 百分位指标 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">平均耗时</div>
          <div className="text-xl font-bold text-blue-400">
            {(data.avgRuntime / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">P50</div>
          <div className="text-xl font-bold text-green-400">
            {(data.percentiles.p50 / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">P90</div>
          <div className="text-xl font-bold text-yellow-400">
            {(data.percentiles.p90 / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">P99</div>
          <div className="text-xl font-bold text-red-400">
            {(data.percentiles.p99 / 1000).toFixed(1)}s
          </div>
        </div>
      </div>

      {/* 慢会话列表 */}
      {data.slowestSessions.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">🐢 最慢的 10 个会话</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {data.slowestSessions.map((session, index) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded ${
                    index < 3 ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-300 max-w-[200px] truncate" title={session.label}>
                    {session.label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-400">
                    {(session.runtimeMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-gray-500">
                    {(session.totalTokens / 1000).toFixed(1)}k tokens
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8">
          <div className="text-4xl mb-2">✅</div>
          <div>暂无慢会话</div>
        </div>
      )}
    </div>
  );
}