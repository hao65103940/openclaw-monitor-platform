import { useEffect, useState } from 'react';

interface ModelCost {
  model: string;
  cost: number;
  tokens: number;
}

interface CostEstimateData {
  success: boolean;
  totalCost: number;
  estimatedMonthlyCost: number;
  modelCosts: ModelCost[];
  sessionCount: number;
}

export default function CostEstimate() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CostEstimateData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/cost-estimate');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载成本估算失败:', err);
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
        <span className="text-xl mr-2">💰</span>
        成本估算
      </h3>

      {/* 成本指标 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-700 rounded-lg p-4">
          <div className="text-xs text-green-400 mb-2">当前总成本</div>
          <div className="text-2xl font-bold text-green-300">
            ${data.totalCost.toFixed(4)}
          </div>
          <div className="text-xs text-green-500 mt-1">
            {data.sessionCount} 个会话
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-700 rounded-lg p-4">
          <div className="text-xs text-blue-400 mb-2">预估月度成本</div>
          <div className="text-2xl font-bold text-blue-300">
            ${data.estimatedMonthlyCost.toFixed(2)}
          </div>
          <div className="text-xs text-blue-500 mt-1">
            基于当前使用率
          </div>
        </div>
      </div>

      {/* 模型成本分布 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 模型成本分布</h4>
        <div className="space-y-3">
          {data.modelCosts.map((item) => (
            <div key={item.model} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">{item.model}</span>
                <span className="text-sm font-bold text-green-400">
                  ${item.cost.toFixed(4)}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full transition-all"
                  style={{
                    width: `${data.totalCost > 0 ? (item.cost / data.totalCost) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(item.tokens / 1000).toFixed(1)}k tokens
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 定价说明 */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
        <div className="mb-1">💡 定价参考（每 1M tokens）：</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>qwen3.5-plus: $0.004 输入 / $0.012 输出</div>
          <div>glm-4.7: $0.001 输入 / $0.001 输出</div>
        </div>
      </div>
    </div>
  );
}
