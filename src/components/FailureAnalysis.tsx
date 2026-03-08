import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface FailureRecord {
  id: string;
  label: string;
  updatedAt: number;
  runtimeMs: number;
  totalTokens: number;
}

interface FailureAnalysisData {
  success: boolean;
  failureRate: number;
  totalFailures: number;
  recentFailures: FailureRecord[];
}

export default function FailureAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FailureAnalysisData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/failure-analysis');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载失败分析失败:', err);
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
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">⚠️</span>
        失败会话分析
      </h3>

      {/* 失败率指标 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">失败率</span>
          <span className={`text-2xl font-bold ${
            data.failureRate < 5 ? 'text-green-400' :
            data.failureRate < 10 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {data.failureRate}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              data.failureRate < 5 ? 'bg-green-600' :
              data.failureRate < 10 ? 'bg-yellow-600' : 'bg-red-600'
            }`}
            style={{ width: `${Math.min(100, data.failureRate * 10)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          共 {data.totalFailures} 个失败会话
        </div>
      </div>

      {/* 最近失败记录 */}
      {data.recentFailures.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">📋 最近失败记录</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {data.recentFailures.map((failure) => (
              <div
                key={failure.id}
                className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg hover:bg-red-900/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-red-300 truncate max-w-[200px]" title={failure.label}>
                    {failure.label}
                  </span>
                  <span className="text-xs text-red-400">
                    {dayjs(failure.updatedAt).format('MM-DD HH:mm')}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-red-400/70">
                  <span>⏱️ {(failure.runtimeMs / 1000).toFixed(1)}s</span>
                  <span>📊 {(failure.totalTokens / 1000).toFixed(1)}k tokens</span>
                  <span className="text-gray-500">{dayjs(failure.updatedAt).fromNow()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8">
          <div className="text-4xl mb-2">✅</div>
          <div>暂无失败记录</div>
        </div>
      )}
    </div>
  );
}
