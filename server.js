/**
 * Agent 监控平台 - API 桥接服务
 * 
 * 这个服务桥接 OpenClaw 的工具调用，提供 REST API 给前端
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 模拟数据（用于演示）
const mockData = {
  active: [
    {
      id: 'agent:main:subagent:abc123',
      status: 'running',
      task: '设计监控平台的前端项目，技术栈：TypeScript + React + Tailwind CSS...',
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
      id: 'agent:main:subagent:def456',
      status: 'done',
      task: '设计一个 Agent 运行监控可视化平台...',
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
      id: 'agent:main:subagent:ghi789',
      status: 'done',
      task: '分析用户需求，输出完整的需求文档...',
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
 * GET /api/subagents/list
 * 获取子 Agent 列表
 */
app.get('/api/subagents/list', (req, res) => {
  try {
    // 返回模拟数据（稳定可靠）
    res.json({
      total: mockData.active.length + mockData.recent.length,
      active: mockData.active,
      recent: mockData.recent,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sessions/list
 * 获取会话列表
 */
app.get('/api/sessions/list', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // 返回模拟会话数据
    res.json({
      sessions: [
        {
          sessionKey: 'session-001',
          label: '监控平台开发',
          createdAt: Date.now() - 300000,
          updatedAt: Date.now(),
          messageCount: 45,
        },
        {
          sessionKey: 'session-002',
          label: '需求分析',
          createdAt: Date.now() - 600000,
          updatedAt: Date.now() - 300000,
          messageCount: 32,
        },
      ],
      total: 2,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats
 * 获取统计数据
 */
app.get('/api/stats', (req, res) => {
  try {
    const activeCount = mockData.active.length;
    const completedCount = mockData.recent.filter(a => a.status === 'done').length;
    const failedCount = mockData.recent.filter(a => a.status === 'failed').length;
    
    const totalTokens = mockData.recent.reduce((sum, a) => sum + (a.totalTokens || 0), 0);
    const totalRuntime = mockData.recent.reduce((sum, a) => sum + (a.runtimeMs || 0), 0);
    
    // 统计模型使用
    const modelUsage = {};
    mockData.recent.forEach(agent => {
      if (agent.model) {
        modelUsage[agent.model] = (modelUsage[agent.model] || 0) + 1;
      }
    });

    res.json({
      totalAgents: mockData.active.length + mockData.recent.length,
      activeAgents: activeCount,
      completedAgents: completedCount,
      failedAgents: failedCount,
      totalTokens,
      totalRuntime,
      avgRuntime: completedCount > 0 ? totalRuntime / completedCount : 0,
      modelUsage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Agent 监控平台 API 服务已启动`);
  console.log(`📡 监听端口：http://0.0.0.0:${PORT}`);
  console.log(`📊 可用端点:`);
  console.log(`   GET /api/subagents/list - 获取子 Agent 列表`);
  console.log(`   GET /api/sessions/list  - 获取会话列表`);
  console.log(`   GET /api/stats          - 获取统计数据`);
  console.log(`   GET /api/health         - 健康检查`);
  console.log(`💡 当前使用模拟数据（稳定可靠）`);
  console.log(`🌐 可从外部访问（需要防火墙开放端口）`);
});
