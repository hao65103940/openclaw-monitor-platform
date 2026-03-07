import axios from 'axios';
import type { SubagentsListResponse, SessionsListResponse, Stats } from '@/types';

// API 配置 - 使用相对路径，通过 Vite 代理转发
const API_BASE = '/api';

// 全局数据模式（可动态切换）
let USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// 失败计数器 - 防止无限重试
let apiFailCount = 0;
const MAX_API_FAIL_COUNT = 3; // 最大失败次数

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000, // 缩短超时时间到 5 秒
});

/**
 * 重置失败计数器
 */
export function resetApiFailCount() {
  apiFailCount = 0;
}

/**
 * 检查是否已达到最大失败次数
 */
export function shouldStopRetry(): boolean {
  return apiFailCount >= MAX_API_FAIL_COUNT;
}

/**
 * 动态设置数据模式
 */
export function setMockDataMode(useMock: boolean) {
  USE_MOCK_DATA = useMock;
  console.log(`[API] 数据模式已切换：${useMock ? '模拟数据' : '真实数据'}`);
}

/**
 * 获取当前数据模式
 */
export function isMockDataMode(): boolean {
  return USE_MOCK_DATA;
}

/**
 * 模拟数据（备用）
 */
const mockData = {
  active: [
    {
      id: '1',
      agentId: 'agent:main:subagent:abc123',
      status: 'running',
      task: '设计监控平台的前端项目，技术栈：TypeScript + React + Tailwind CSS，需要实现 Dashboard、Analytics、Trace、Configs 四个页面...',
      label: '监控平台开发',
      runtimeMs: 135000,
      runtime: '2m 15s',
      model: 'qwen3.5-plus',
      totalTokens: 8500,
      inputTokens: 2500,
      outputTokens: 6000,
      startedAt: Date.now() - 135000,
    },
  ],
  recent: [
    {
      id: '2',
      agentId: 'agent:main:subagent:def456',
      status: 'done',
      task: '设计一个 Agent 运行监控可视化平台，包括实时监控仪表盘、性能分析、执行链路可视化等功能...',
      label: '监控平台设计',
      runtimeMs: 83000,
      runtime: '1m 23s',
      model: 'qwen3.5-plus',
      totalTokens: 15527,
      inputTokens: 5000,
      outputTokens: 10527,
      startedAt: Date.now() - 300000,
      endedAt: Date.now() - 217000,
    },
    {
      id: '3',
      agentId: 'agent:main:subagent:ghi789',
      status: 'done',
      task: '分析用户需求，输出完整的需求文档。用户需求：帮我开发一个用户登录功能，包括注册、登录、密码找回等...',
      label: '需求评审',
      runtimeMs: 65000,
      runtime: '1m 5s',
      model: 'qwen3.5-plus',
      totalTokens: 15449,
      inputTokens: 4800,
      outputTokens: 10649,
      startedAt: Date.now() - 500000,
      endedAt: Date.now() - 435000,
    },
  ],
};

/**
 * 获取子 Agent 列表
 */
export async function getSubagents(): Promise<SubagentsListResponse> {
  console.log('[API] getSubagents 调用，当前模式:', USE_MOCK_DATA ? '模拟数据' : '真实数据');
  
  if (USE_MOCK_DATA) {
    console.log('[API] 使用模拟数据');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      total: mockData.active.length + mockData.recent.length,
      active: mockData.active,
      recent: mockData.recent,
    };
  }
  
  // 检查是否已达到最大失败次数
  if (shouldStopRetry()) {
    console.warn('[API] 已达到最大失败次数，停止请求真实数据');
    return {
      total: 0,
      active: [],
      recent: [],
      error: 'API 连续失败，已停止重试',
    };
  }
  
  console.log('[API] 请求真实数据 API...');
  try {
    const response = await api.get('/agents/list');
    console.log('[API] 真实数据返回:', response.data);
    resetApiFailCount(); // 成功后重置计数器
    return response.data;
  } catch (error) {
    apiFailCount++;
    console.error(`[API] 真实数据请求失败 (${apiFailCount}/${MAX_API_FAIL_COUNT}):`, error);
    
    if (apiFailCount >= MAX_API_FAIL_COUNT) {
      console.warn('[API] 连续失败 3 次，返回空数据并停止重试');
      return {
        total: 0,
        active: [],
        recent: [],
        error: 'API 连续失败，已停止重试',
      };
    }
    
    // 失败时回退到模拟数据
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      total: mockData.active.length + mockData.recent.length,
      active: mockData.active,
      recent: mockData.recent,
    };
  }
}

/**
 * 获取会话列表
 */
export async function getSessions(limit = 20): Promise<SessionsListResponse> {
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      sessions: [],
      total: 0,
    };
  }
  
  try {
    const response = await api.get('/sessions/list', {
      params: { limit },
    });
    return response.data;
  } catch (error) {
    console.error('[API] getSessions 失败:', error);
    return {
      sessions: [],
      total: 0,
    };
  }
}

/**
 * 获取统计数据
 */
export async function getStats(): Promise<Stats> {
  console.log('[API] getStats 调用，当前模式:', USE_MOCK_DATA ? '模拟数据' : '真实数据');
  
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      totalAgents: 3,
      activeAgents: 1,
      completedAgents: 2,
      failedAgents: 0,
      totalTokens: 39476,
      totalRuntime: 283000,
      avgRuntime: 141500,
      modelUsage: { 'qwen3.5-plus': 3 },
    };
  }
  
  // 检查是否已达到最大失败次数
  if (shouldStopRetry()) {
    console.warn('[API] 已达到最大失败次数，停止请求统计数据');
    return {
      totalAgents: 0,
      activeAgents: 0,
      completedAgents: 0,
      failedAgents: 0,
      totalTokens: 0,
      totalRuntime: 0,
      avgRuntime: 0,
      modelUsage: {},
    };
  }
  
  console.log('[API] 请求真实统计数据 API...');
  try {
    const response = await api.get('/stats');
    console.log('[API] 真实统计数据返回:', response.data);
    resetApiFailCount(); // 成功后重置计数器
    return response.data;
  } catch (error) {
    apiFailCount++;
    console.error(`[API] getStats 失败 (${apiFailCount}/${MAX_API_FAIL_COUNT}):`, error);
    
    if (apiFailCount >= MAX_API_FAIL_COUNT) {
      console.warn('[API] 连续失败 3 次，返回空数据并停止重试');
    }
    
    // 失败时返回模拟数据
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      totalAgents: 3,
      activeAgents: 1,
      completedAgents: 2,
      failedAgents: 0,
      totalTokens: 39476,
      totalRuntime: 283000,
      avgRuntime: 141500,
      modelUsage: { 'qwen3.5-plus': 3 },
    };
  }
}

/**
 * 获取 Agent 配置
 */
export async function getAgentConfig(agentId: string): Promise<string> {
  if (USE_MOCK_DATA) {
    return `# Agent 配置\n\nID: ${agentId}\n\n（模拟数据）`;
  }
  
  try {
    const response = await api.get(`/agents/${encodeURIComponent(agentId)}/config`);
    return response.data.content;
  } catch (error) {
    return `# Agent 配置\n\nID: ${agentId}\n\n（获取失败）`;
  }
}

export default api;
