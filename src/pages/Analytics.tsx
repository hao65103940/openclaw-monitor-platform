import React from 'react';
import { useAgentStore } from '../store/useAgentStore';

function Analytics() {
  const { stats } = useAgentStore();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📈 性能分析</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token 消耗排行 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Token 消耗排行</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>agent:main</span>
              <span className="text-primary-400">45.2k</span>
            </div>
            <div className="flex items-center justify-between">
              <span>agent:sub1</span>
              <span className="text-primary-400">23.1k</span>
            </div>
            <div className="flex items-center justify-between">
              <span>agent:sub2</span>
              <span className="text-primary-400">18.7k</span>
            </div>
          </div>
        </div>

        {/* 模型使用分布 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">模型使用分布</h3>
          <div className="space-y-3">
            {stats?.modelUsage && Object.entries(stats.modelUsage).map(([model, count]) => (
              <div key={model}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{model}</span>
                  <span>{count} 次</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full"
                    style={{ width: `${(count / (stats.totalAgents || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
