import { create } from 'zustand';
import type { Agent, Stats } from '@/types';
import { getSubagents, getStats } from '@/services/api';

interface AgentState {
  // 数据
  activeAgents: Agent[];
  recentAgents: Agent[];
  stats: Stats | null;
  
  // 状态
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // WebSocket 连接
  wsConnected: boolean;
  
  // 刷新控制
  refreshInterval: number; // 刷新间隔（毫秒）
  autoRefresh: boolean; // 是否自动刷新
  apiStopped: boolean; // API 是否已停止（连续失败后）
  
  // 操作
  fetchAgents: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setWsConnected: (connected: boolean) => void;
  clearError: () => void;
  setRefreshInterval: (interval: number) => void;
  toggleAutoRefresh: () => void;
  resetApiRetry: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  // 初始状态
  activeAgents: [],
  recentAgents: [],
  stats: null,
  loading: false,
  error: null,
  lastUpdated: null,
  wsConnected: false,
  refreshInterval: 30000, // 默认 30 秒
  autoRefresh: true, // 默认开启自动刷新
  apiStopped: false, // API 未停止

  // 获取 Agent 列表
  fetchAgents: async () => {
    // 如果 API 已停止，不再请求
    if (get().apiStopped) {
      console.warn('[Store] API 已停止，跳过 fetchAgents');
      return;
    }
    
    try {
      set({ loading: true, error: null });
      const data = await getSubagents();
      
      // 检查是否返回了错误（API 停止标志）
      if ((data as any).error) {
        set({
          apiStopped: true,
          error: 'API 连续失败，已停止重试。请检查后端服务。',
          loading: false,
        });
        console.warn('[Store] API 已停止自动刷新');
        return;
      }
      
      set({
        activeAgents: data.active || [],
        recentAgents: data.recent || [],
        loading: false,
        lastUpdated: Date.now(),
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取 Agent 列表失败',
        loading: false,
      });
    }
  },

  // 获取统计数据
  fetchStats: async () => {
    // 如果 API 已停止，不再请求
    if (get().apiStopped) {
      console.warn('[Store] API 已停止，跳过 fetchStats');
      return;
    }
    
    try {
      const stats = await getStats();
      set({ stats });
    } catch (error) {
      // 静默失败，不影响 UI 显示
      console.debug('获取统计数据失败（使用模拟数据）:', error instanceof Error ? error.message : error);
    }
  },

  // 刷新所有数据
  refreshAll: async () => {
    // 如果 API 已停止，不再刷新
    if (get().apiStopped) {
      console.warn('[Store] API 已停止，跳过 refreshAll');
      return;
    }
    
    await Promise.all([
      get().fetchAgents(),
      get().fetchStats(),
    ]);
  },

  // 设置 WebSocket 连接状态
  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 设置刷新间隔
  setRefreshInterval: (interval: number) => {
    set({ refreshInterval: interval });
  },

  // 切换自动刷新
  toggleAutoRefresh: () => {
    set({ autoRefresh: !get().autoRefresh });
  },

  // 重置 API 重试（手动触发）
  resetApiRetry: () => {
    set({ apiStopped: false });
    // 调用 API 模块的重置函数
    import('@/services/api').then(({ resetApiFailCount }) => {
      resetApiFailCount();
      console.log('[Store] API 重试计数器已重置');
    });
  },
}));
