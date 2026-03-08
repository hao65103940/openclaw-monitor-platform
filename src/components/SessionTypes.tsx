import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

interface SessionType {
  type: string;
  count: number;
  totalTokens: number;
  totalRuntime: number;
  avgTokens: number;
  avgRuntime: number;
}

interface SessionTypesData {
  success: boolean;
  types: SessionType[];
  totalSessions: number;
}

export default function SessionTypes() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionTypesData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/session-types');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载会话类型失败:', err);
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

  if (!data || data.types.length === 0) {
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
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#9CA3AF' },
    },
    series: [
      {
        name: '会话类型',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#1F2937',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            color: '#fff',
          },
        },
        labelLine: {
          show: false,
        },
        data: data.types.map((t, index) => ({
          value: t.count,
          name: t.type,
          itemStyle: {
            color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'][index % 5],
          },
        })),
      },
    ],
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      direct: '💬',
      cron: '⏰',
      feishu: '📝',
      wecom: '💼',
      subagent: '🤖',
    };
    return icons[type] || '📊';
  };

  return (
    <div className="card-modern p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
        <span className="text-xl mr-2">📊</span>
        会话类型分布
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 饼图 */}
        <div className="h-[250px]">
          <ReactECharts option={option} style={{ height: '100%' }} />
        </div>

        {/* 类型列表 */}
        <div className="space-y-3">
          {data.types.map((type) => (
            <div
              key={type.type}
              className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getTypeIcon(type.type)}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-300 capitalize">
                    {type.type}
                  </div>
                  <div className="text-xs text-gray-500">
                    平均 {(type.avgTokens / 1000).toFixed(1)}k tokens
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-400">
                  {type.count}
                </div>
                <div className="text-xs text-gray-500">
                  {data.totalSessions > 0 ? Math.round((type.count / data.totalSessions) * 100) : 0}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
