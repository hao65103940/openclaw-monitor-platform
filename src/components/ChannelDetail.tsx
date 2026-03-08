import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface ChannelModel {
  model: string;
  count: number;
}

interface ChannelDetail {
  channel: string;
  count: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalRuntime: number;
  failedCount: number;
  avgTokens: number;
  avgRuntime: number;
  failureRate: number;
  models: ChannelModel[];
}

interface ChannelDetailData {
  success: boolean;
  channels: ChannelDetail[];
  totalChannels: number;
}

export default function ChannelDetail() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChannelDetailData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/channel-detail');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载渠道分析失败:', err);
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

  if (!data || data.channels.length === 0) {
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
      data: ['会话数', 'Token 消耗'],
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
      data: data.channels.map(c => {
        const icons: Record<string, string> = {
          direct: '💬',
          cron: '⏰',
          feishu: '📝',
          wecom: '💼',
        };
        return `${icons[c.channel] || '📊'} ${c.channel}`;
      }),
      axisLabel: {
        color: '#9CA3AF',
        rotate: 0,
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '会话数',
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
        name: '会话数',
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3B82F6' },
            { offset: 1, color: '#1D4ED8' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: data.channels.map(c => c.count),
      },
      {
        name: 'Token 消耗',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: '#10B981' },
        data: data.channels.map(c => Math.round(c.totalTokens / 1000)),
      },
    ],
  };

  return (
    <div className="card-modern p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">📱</span>
        渠道详细分析
      </h3>

      {/* 图表 */}
      <div className="h-[300px] mb-6">
        <ReactECharts option={option} style={{ height: '100%' }} />
      </div>

      {/* 渠道列表 */}
      <div className="space-y-4">
        {data.channels.map((channel) => {
          const icons: Record<string, string> = {
            direct: '💬',
            cron: '⏰',
            feishu: '📝',
            wecom: '💼',
          };
          const icon = icons[channel.channel] || '📊';
          
          return (
            <div
              key={channel.channel}
              className="bg-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-300 capitalize">
                      {channel.channel}
                    </div>
                    <div className="text-xs text-gray-500">
                      {channel.count} 会话 | 失败率 {channel.failureRate}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">
                    {(channel.totalTokens / 1000).toFixed(1)}k
                  </div>
                  <div className="text-xs text-gray-500">
                    平均 {(channel.avgRuntime / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
              
              {/* 失败率进度条 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>失败率</span>
                  <span className={channel.failureRate < 5 ? 'text-green-400' : channel.failureRate < 10 ? 'text-yellow-400' : 'text-red-400'}>
                    {channel.failureRate}%
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      channel.failureRate < 5 ? 'bg-green-600' :
                      channel.failureRate < 10 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(100, channel.failureRate * 10)}%` }}
                  />
                </div>
              </div>

              {/* 模型分布 */}
              {channel.models.length > 0 && (
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>模型:</span>
                  {channel.models.map((m) => (
                    <span key={m.model} className="bg-gray-600 px-2 py-1 rounded">
                      {m.model} × {m.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
