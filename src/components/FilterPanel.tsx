import React, { useState } from 'react';

interface FilterState {
  sessionTypes: string[];
  statuses: string[];
  channels: string[];
  keyword: string;
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

const SESSION_TYPES = [
  { value: 'direct', label: '直接', icon: '💬' },
  { value: 'cron', label: '定时', icon: '⏰' },
  { value: 'feishu', label: '飞书', icon: '📝' },
  { value: 'wecom', label: '企微', icon: '💼' },
  { value: 'subagent', label: '子 Agent', icon: '🤖' },
];

const STATUSES = [
  { value: 'running', label: '运行中', icon: '🟢' },
  { value: 'completed', label: '已完成', icon: '✅' },
];

function FilterPanel({ onFilterChange, onReset }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    sessionTypes: [],
    statuses: [],
    channels: [],
    keyword: '',
  });

  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (
    category: keyof FilterState,
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => {
      const current = prev[category] as string[];
      const updated = checked
        ? [...current, value]
        : current.filter((v) => v !== value);

      const newFilters = { ...prev, [category]: updated };
      onFilterChange(newFilters);
      return newFilters;
    });
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, keyword: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters: FilterState = {
      sessionTypes: [],
      statuses: [],
      channels: [],
      keyword: '',
    };
    setFilters(emptyFilters);
    onReset();
  };

  const activeFilterCount =
    filters.sessionTypes.length +
    filters.statuses.length +
    (filters.keyword ? 1 : 0);

  return (
    <div className="relative">
      {/* 筛选按钮 */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-1.5 ${
            isOpen || activeFilterCount > 0
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <span>🔍</span>
          <span>筛选</span>
          {activeFilterCount > 0 && (
            <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-full text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-red-600/30"
            title="重置筛选"
          >
            ✕
          </button>
        )}
      </div>

      {/* 筛选面板 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[480px] bg-gray-800 rounded-xl border border-gray-700 shadow-2xl shadow-black/50 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 面板头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white text-sm">🔍 筛选条件</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors text-lg"
            >
              ×
            </button>
          </div>

          {/* 面板内容 */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {/* 关键词搜索 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                🔎 关键词搜索
              </label>
              <input
                type="text"
                value={filters.keyword}
                onChange={handleKeywordChange}
                placeholder="搜索任务描述、Agent ID..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* 会话类型 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                📝 会话类型
              </label>
              <div className="flex flex-wrap gap-2">
                {SESSION_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center space-x-1.5 text-sm ${
                      filters.sessionTypes.includes(type.value)
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.sessionTypes.includes(type.value)}
                      onChange={(e) =>
                        handleFilterChange('sessionTypes', type.value, e.target.checked)
                      }
                      className="hidden"
                    />
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                📊 状态
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <label
                    key={status.value}
                    className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center space-x-1.5 text-sm ${
                      filters.statuses.includes(status.value)
                        ? status.value === 'running'
                          ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/30'
                          : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status.value)}
                      onChange={(e) =>
                        handleFilterChange('statuses', status.value, e.target.checked)
                      }
                      className="hidden"
                    />
                    <span>{status.icon}</span>
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 面板底部 */}
          <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50 rounded-b-xl">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>已选择 {activeFilterCount} 个筛选条件</span>
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-white transition-colors"
              >
                重置所有
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
