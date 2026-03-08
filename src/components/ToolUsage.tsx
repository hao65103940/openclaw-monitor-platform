import { useEffect, useState } from 'react';

interface ToolUsageData {
  success: boolean;
  tools: any[];
  totalCalls: number;
  note: string;
}

export default function ToolUsage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ToolUsageData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/tool-usage');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error('加载工具调用失败:', err);
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
        <span className="text-xl mr-2">🔧</span>
        工具调用分析
      </h3>

      <div className="text-center text-gray-400 py-12">
        <div className="text-4xl mb-4">🚧</div>
        <div className="text-lg font-semibold mb-2">即将上线</div>
        <div className="text-sm text-gray-500 mb-4">
          工具调用统计需要从 JSONL 文件解析会话日志
        </div>
        <div className="text-xs text-gray-600 bg-gray-700/50 rounded-lg p-3 inline-block">
          {data.note}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">📋 计划支持的工具</h4>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-400">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            web_search
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            browser
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
            exec
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
            read/write
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            feishu_*
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
            sessions_*
          </div>
        </div>
      </div>
    </div>
  );
}
