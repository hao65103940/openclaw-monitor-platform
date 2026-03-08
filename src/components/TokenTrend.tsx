import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface TokenSession {
  id: string;
  sessionId: string;
  label: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  status: string;
  updatedAt: number;
}

interface TokenSummary {
  total: number;
  avgPerSession: number;
  maxSession: number;
  sessionCount: number;
}

interface TokenTrendData {
  success: boolean;
  sessions: TokenSession[];
  summary: TokenSummary;
}

export default function TokenTrend() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenTrendData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/token-trends');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
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
          <div>正在加载 Token 数据...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">❌</div>
          <div>{error || '加载失败'}</div>
        </div>
      </div>
    );
  }

  const { sessions, summary } = data;

  // ECharts 配置
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
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
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sessions.map(s => {
        const label = s.label.length > 15 ? s.label.substring(0, 15) + '...' : s.label;
        return label;
      }),
      axisLabel: {
        color: '#9CA3AF',
        rotate: 45,
        interval: 0,
        fontSize: 11,
      },
      axisTick: { show: false },
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
        type: 'bar',
        stack: 'total',
        barMaxWidth: 40,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3B82F6' },
            { offset: 1, color: '#1D4ED8' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: sessions.map(s => Math.round(s.inputTokens / 1000)),
      },
      {
        name: '输出',
        type: 'bar',
        stack: 'total',
        barMaxWidth: 40,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#10B981' },
            { offset: 1, color: '#059669' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: sessions.map(s => Math.round(s.outputTokens / 1000)),
      },
      {
        name: '上下文',
        type: 'bar',
        stack: 'total',
        barMaxWidth: 40,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#8B5CF6' },
            { offset: 1, color: '#7C3AED' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: sessions.map(s => Math.round(s.contextTokens / 1000)),
      },
    ],
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      {/* 标题和统计 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <span className="text-xl mr-2">📊</span>
          Token 使用分布（Top 20 会话）
        </h3>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">总会话数</div>
            <div className="text-xl font-bold text-white">
              {summary.sessionCount}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">累计 Token</div>
            <div className="text-xl font-bold text-blue-400">
              {(summary.total / 1000).toFixed(1)}k
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">平均 Token</div>
            <div className="text-xl font-bold text-green-400">
              {(summary.avgPerSession / 1000).toFixed(1)}k
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">最高 Token</div>
            <div className="text-xl font-bold text-purple-400">
              {(summary.maxSession / 1000).toFixed(1)}k
            </div>
          </div>
        </div>
      </div>

      {/* 图表 */}
      <div className="h-[400px]">
        {sessions.length > 0 ? (
          <ReactECharts option={option} style={{ height: '100%' }} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📉</div>
              <div>暂无 Token 数据</div>
            </div>
          </div>
        )}
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
          数据来源：sessions.json
        </div>
      </div>
    </div>
  );
}
