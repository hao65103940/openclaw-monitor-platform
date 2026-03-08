import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface SessionLifecycleData {
  success: boolean;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  completionRate: number;
  avgRuntime: number;
  hourDistribution: number[];
}

export default function SessionLifecycle() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionLifecycleData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/session-lifecycle');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载会话生命周期失败:', err);
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

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),
      axisLabel: {
        color: '#9CA3AF',
        rotate: 45,
        fontSize: 10,
        interval: 1,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: '会话数',
      nameTextStyle: { color: '#9CA3AF' },
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: '活跃时段',
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3B82F6' },
            { offset: 1, color: '#1D4ED8' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: data.hourDistribution,
      },
    ],
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">⏱️</span>
        会话生命周期分析
      </h3>

      {/* 指标卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">平均时长</div>
          <div className="text-xl font-bold text-blue-400">
            {(data.avgRuntime / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">完成率</div>
          <div className="text-xl font-bold text-green-400">
            {data.completionRate}%
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">总会话</div>
          <div className="text-xl font-bold text-purple-400">
            {data.totalSessions}
          </div>
        </div>
      </div>

      {/* 活跃时段热力图 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 24 小时活跃分布</h4>
        <div className="h-[200px]">
          <ReactECharts option={option} style={{ height: '100%' }} />
        </div>
      </div>

      {/* 状态分布 */}
      <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">{data.completedSessions}</div>
          <div className="text-xs text-gray-500">✅ 已完成</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">{data.activeSessions}</div>
          <div className="text-xs text-gray-500">🟢 进行中</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">{data.failedSessions}</div>
          <div className="text-xs text-gray-500">❌ 失败</div>
        </div>
      </div>
    </div>
  );
}
