import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import api from '../services/api';

interface AgentConfig {
  id: string;
  name: string;
  path: string;
  files: ConfigFile[];
}

interface ConfigFile {
  name: string;
  path: string;
  content?: string;
}

function ConfigCard({ config, onExpand, isExpanded }: { 
  config: AgentConfig; 
  onExpand: (id: string) => void;
  isExpanded: boolean;
}) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleFileClick = async (file: ConfigFile) => {
    if (fileContents[file.path]) {
      // 已加载，折叠
      const newContents = { ...fileContents };
      delete newContents[file.path];
      setFileContents(newContents);
      setEditingFile(null);
      return;
    }

    // 加载文件内容
    try {
      const response = await api.get(`/agents/${config.id}/config/${file.name}`);
      const content = response.data.content;
      
      setFileContents(prev => ({ ...prev, [file.path]: content }));
      setEditContent(content);
      console.log('[Config] 已加载文件:', file.path);
    } catch (error) {
      console.error('加载文件失败:', error);
      setMessage({ type: 'error', text: `加载失败：${error instanceof Error ? error.message : '未知错误'}` });
    }
  };

  const handleEdit = (file: ConfigFile) => {
    setEditingFile(file.path);
    setEditContent(fileContents[file.path] || '');
  };

  const handleSave = async (file: ConfigFile) => {
    setSaving(true);
    try {
      const response = await api.put(`/agents/${config.id}/config/${file.name}`, {
        content: editContent,
      });
      
      if (response.data.success) {
        setFileContents(prev => ({ ...prev, [file.path]: editContent }));
        setEditingFile(null);
        setMessage({ type: 'success', text: `✅ ${file.name} 已保存到服务器` });
        setTimeout(() => setMessage(null), 3000);
        console.log('[Config] 文件已保存:', file.path);
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      setMessage({ type: 'error', text: `保存失败：${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingFile(null);
    setEditContent(fileContents[editingFile || ''] || '');
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      <div 
        className="px-6 py-4 border-b border-gray-700 bg-gray-850 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => onExpand(config.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              ▶️
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">{config.name}</h3>
              <p className="text-sm text-gray-400">{config.path}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">{config.files.length} 个文件</span>
            <span className="text-xs text-gray-500">{config.id}</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 bg-gray-800">
          {/* 消息提示 */}
          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
              {message.text}
            </div>
          )}

          <h4 className="text-sm font-semibold text-gray-300 mb-3">配置文件</h4>
          <div className="space-y-2">
            {config.files.map((file) => (
              <div key={file.path} className="border border-gray-700 rounded">
                <button
                  onClick={() => handleFileClick(file)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-750 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {file.name.endsWith('.md') ? '📝' : file.name.endsWith('.json') ? '📊' : '📄'}
                    </span>
                    <div>
                      <div className="text-white font-mono text-sm">{file.name}</div>
                      <div className="text-xs text-gray-500">{file.path}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {fileContents[file.path] && !editingFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(file); }}
                        className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
                      >
                        ✏️ 编辑
                      </button>
                    )}
                    {editingFile === file.path ? (
                      <span className="text-xs text-green-400">▼ 编辑中</span>
                    ) : fileContents[file.path] ? (
                      <span className="text-xs text-blue-400">▼ 收起</span>
                    ) : (
                      <span className="text-xs text-blue-400">▶ 查看</span>
                    )}
                  </div>
                </button>

                {fileContents[file.path] && (
                  <div className="px-4 py-3 bg-gray-900 border-t border-gray-700">
                    {editingFile === file.path ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-64 bg-gray-800 text-gray-300 font-mono text-xs p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none whitespace-pre-wrap"
                          spellCheck={false}
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSave(file)}
                            disabled={saving}
                            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white rounded text-sm transition-colors flex items-center space-x-2"
                          >
                            {saving ? (
                              <>
                                <span className="animate-spin">🔄</span>
                                <span>保存中...</span>
                              </>
                            ) : (
                              <>
                                <span>💾</span>
                                <span>保存</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto p-2">
                        {fileContents[file.path]}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Configs() {
  const { activeAgents } = useAgentStore();
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载 Agent 配置列表
  useEffect(() => {
    async function loadAgentConfigs() {
      try {
        const response = await api.get('/agents/config/list');
        const agents = response.data.agents || [];
        
        const formattedConfigs: AgentConfig[] = agents.map(agent => ({
          id: agent.id,
          name: formatAgentName(agent.id),
          path: agent.path,
          files: agent.files,
        }));
        
        setAgentConfigs(formattedConfigs);
        setLoading(false);
        console.log('[Config] 已加载', formattedConfigs.length, '个 Agent 配置');
      } catch (error) {
        console.error('加载 Agent 配置列表失败:', error);
        setLoading(false);
      }
    }
    
    loadAgentConfigs();
  }, []);

  function formatAgentName(id: string): string {
    const names: Record<string, string> = {
      'main': '主 Agent (夏娃 Eve ✨)',
      'feishu-agent': '飞书助手 📝',
      'wecom-agent': '企微助手 💼',
      'requirement-agent': '需求分析师 📋',
      'design-agent': '系统架构师 🏗️',
      'coding-agent': '高级开发工程师 💻',
      'review-agent': '代码审查员 🔍',
    };
    if (names[id]) return names[id];
    return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ' 🤖';
  }

  const totalAgents = agentConfigs.length;
  const activeCount = activeAgents?.length || 0;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-blue-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Agent 总数</p>
              <p className="text-3xl font-bold mt-2 text-white">{totalAgents}</p>
            </div>
            <div className="text-4xl opacity-80">🤖</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-green-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">活跃 Agent</p>
              <p className="text-3xl font-bold mt-2 text-white">{activeCount}</p>
            </div>
            <div className="text-4xl opacity-80">🟢</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-purple-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">配置文件</p>
              <p className="text-3xl font-bold mt-2 text-white">
                {agentConfigs.reduce((sum, c) => sum + c.files.length, 0)}
              </p>
            </div>
            <div className="text-4xl opacity-80">📁</div>
          </div>
        </div>
      </div>

      {/* Agent 配置列表 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-semibold text-white">⚙️ Agent 配置管理</h2>
          <p className="text-sm text-gray-400 mt-1">点击 Agent 卡片展开查看和编辑配置文件</p>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              🔄 正在加载配置...
            </div>
          ) : (
            agentConfigs.map((config) => (
              <ConfigCard
                key={config.id}
                config={config}
                isExpanded={expandedConfig === config.id}
                onExpand={(id) => setExpandedConfig(expandedConfig === id ? null : id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Configs;
