import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface ModelStat {
  model: string;
  count: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

interface ModelStatsData {
  success: boolean;
  models: ModelStat[];
  totalSessions: number;
}

export default function ModelStats() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ModelStatsData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/model-stats');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载模型统计失败:', err);
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

  if (!data || data.models.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">📉</div>
          <div>暂无数据</div>
        </div>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['调用次数', 'Token 消耗'],
      textStyle: { color: '#9CA3AF' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.models.map(m => m.model.substring(0, 15)),
      axisLabel: {
        color: '#9CA3AF',
        rotate: 45,
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '调用次数',
        nameTextStyle: { color: '#9CA3AF' },
        axisLabel: { color: '#9CA3AF' },
        splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
      },
      {
        type: 'value',
        name: 'Token (k)',
        nameTextStyle: { color: '#9CA3AF' },
        axisLabel: {
          color: '#9CA3AF',
          formatter: '{value}k',
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '调用次数',
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3B82F6' },
            { offset: 1, color: '#1D4ED8' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: data.models.map(m => m.count),
      },
      {
        name: 'Token 消耗',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: '#10B981' },
        data: data.models.map(m => Math.round(m.totalTokens / 1000)),
      },
    ],
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">🤖</span>
        模型使用统计
      </h3>

      {/* 图表 */}
      <div className="h-[350px] mb-6">
        <ReactECharts option={option} style={{ height: '100%' }} />
      </div>

      {/* 模型列表 */}
      <div className="space-y-3">
        {data.models.map((model, index) => (
          <div
            key={model.model}
            className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg font-bold text-gray-400 w-6">
                {index + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-300">
                  {model.model}
                </div>
                <div className="text-xs text-gray-500">
                  输入 {(model.inputTokens / 1000).toFixed(1)}k | 输出 {(model.outputTokens / 1000).toFixed(1)}k
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-400">
                {model.count} 次
              </div>
              <div className="text-xs text-gray-500">
                {(model.totalTokens / 1000).toFixed(1)}k tokens
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
