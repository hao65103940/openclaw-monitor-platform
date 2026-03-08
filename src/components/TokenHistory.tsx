import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface TimelineData {
  date: string;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  totalTokens: number;
  count: number;
}

interface TokenHistoryData {
  success: boolean;
  timeline: TimelineData[];
  range: string;
  groupBy: string;
}

export default function TokenHistory() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenHistoryData | null>(null);
  const [range, setRange] = useState('7d');

  const fetchData = async (selectedRange = range) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/token-history?range=${selectedRange}&groupBy=day`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载 Token 历史失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    fetchData(newRange);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <div className="animate-spin text-2xl mb-2">🔄</div>
          <div>正在加载 Token 历史...</div>
        </div>
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">📉</div>
          <div>暂无历史数据</div>
        </div>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const total = params.reduce((sum: number, p: any) => sum + p.value, 0);
        return `${params[0].name}<br/>
                ${params[0].marker} 输入：${(params[0].value * 1000).toLocaleString()}<br/>
                ${params[1].marker} 输出：${(params[1].value * 1000).toLocaleString()}<br/>
                ${params[2].marker} 上下文：${(params[2].value * 1000).toLocaleString()}<br/>
                <strong>总计：${(total * 1000).toLocaleString()}</strong>`;
      },
    },
    legend: {
      data: ['输入', '输出', '上下文'],
      textStyle: { color: '#9CA3AF' },
      top: 30,
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
      boundaryGap: false,
      data: data.timeline.map(t => t.date.substring(5)), // 显示 MM-DD
      axisLabel: {
        color: '#9CA3AF',
        rotate: 0,
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Token (k)',
      nameTextStyle: { color: '#9CA3AF' },
      axisLabel: {
        color: '#9CA3AF',
        formatter: '{value}k',
      },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: '输入',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.1)' },
          ]),
        },
        itemStyle: { color: '#3B82F6' },
        data: data.timeline.map(t => Math.round(t.inputTokens / 1000)),
      },
      {
        name: '输出',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.5)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.1)' },
          ]),
        },
        itemStyle: { color: '#10B981' },
        data: data.timeline.map(t => Math.round(t.outputTokens / 1000)),
      },
      {
        name: '上下文',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.5)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.1)' },
          ]),
        },
        itemStyle: { color: '#8B5CF6' },
        data: data.timeline.map(t => Math.round(t.contextTokens / 1000)),
      },
    ],
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      {/* 标题和范围选择 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <span className="text-xl mr-2">📈</span>
          Token 使用趋势
        </h3>
        <div className="flex space-x-2">
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {r === '7d' ? '最近 7 天' : r === '30d' ? '最近 30 天' : '最近 90 天'}
            </button>
          ))}
        </div>
      </div>

      {/* 图表 */}
      <div className="h-[350px]">
        <ReactECharts option={option} style={{ height: '100%' }} />
      </div>

      {/* 图例说明 */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-3 h-3 bg-blue-600 rounded mr-1"></span>
            输入 Token
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 bg-green-600 rounded mr-1"></span>
            输出 Token
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 bg-purple-600 rounded mr-1"></span>
            上下文 Token
          </span>
        </div>
        <div className="text-gray-500">
          按天统计
        </div>
      </div>
    </div>
  );
}
