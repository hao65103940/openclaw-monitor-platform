/**
 * Agent 监控平台 - API 桥接服务
 * 
 * 调用 OpenClaw CLI 获取真实数据
 */

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/**
 * 执行 OpenClaw CLI 命令（带缓存）
 */
let sessionsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 秒缓存

function runOpenClawCommand(command) {
  try {
    // 使用完整路径
    const fullCommand = `/root/.nvm/versions/node/v24.13.0/bin/${command}`;
    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      timeout: 15000, // 15 秒超时
      env: { ...process.env, PATH: `/root/.nvm/versions/node/v24.13.0/bin:${process.env.PATH}` },
    });
    return JSON.parse(output);
  } catch (error) {
    console.error(`[CLI] 命令失败：${command}`, error.message);
    throw error;
  }
}

/**
 * 获取会话数据（带缓存）
 */
function getSessionsData() {
  const now = Date.now();
  // 检查缓存是否有效
  if (sessionsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return sessionsCache;
  }
  
  // 缓存失效，重新获取
  const sessionsData = runOpenClawCommand('openclaw sessions --json');
  sessionsCache = sessionsData;
  cacheTimestamp = now;
  return sessionsData;
}

/**
 * 格式化 Agent 数据
 */
function formatAgent(session, label) {
  return {
    id: session.sessionKey || `session:${session.id || Date.now()}`,
    agentId: 'agent:main',
    status: 'done', // 存储的会话都是已完成的
    task: label || '未知任务',
    label: label || '会话',
    runtimeMs: (session.updatedAt - session.createdAt) || 0,
    runtime: formatDuration((session.updatedAt - session.createdAt) || 0),
    model: session.model || 'qwen3.5-plus',
    totalTokens: session.totalTokens || session.tokenUsage?.total || 0,
    inputTokens: session.inputTokens || session.tokenUsage?.input || 0,
    outputTokens: session.outputTokens || session.tokenUsage?.output || 0,
    startedAt: session.createdAt,
    endedAt: session.updatedAt,
  };
}

/**
 * 格式化时长
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * 格式化 Agent 名称
 */
function formatAgentName(id) {
  const names = {
    'main': '主 Agent (夏娃 Eve ✨)',
    'feishu-agent': '飞书助手 📝',
    'wecom-agent': '企微助手 💼',
  };
  if (names[id]) return names[id];
  return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ' 🤖';
}

/**
 * GET /api/subagents/list
 * 获取子 Agent 列表（从 sessions 获取）
 */
app.get('/api/subagents/list', (req, res) => {
  try {
    // 使用缓存数据
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 限制最近 20 条
    const recent = sessions.slice(0, 20).map((s, i) => 
      formatAgent(s, s.key || `会话-${i + 1}`)
    );
    
    // 活跃 Agent（最近 5 分钟内更新的）
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const active = sessions
      .filter(s => s.updatedAt > fiveMinAgo)
      .map((s, i) => ({
        ...formatAgent(s, s.key || `会话-${i + 1}`),
        status: 'running',
      }));
    
    res.json({
      total: sessions.length,
      active: active.slice(0, 5), // 最多显示 5 个活跃的
      recent: recent,
    });
  } catch (error) {
    console.error('[API] 获取子 Agent 列表失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/sessions/list
 * 获取会话列表
 */
app.get('/api/sessions/list', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const sessionsData = getSessionsData();
    const sessions = (sessionsData.sessions || []).slice(0, limit);
    
    res.json({
      sessions: sessions.map(s => ({
        sessionKey: s.key,
        label: s.key || '未知会话',
        createdAt: s.updatedAt - (s.ageMs || 0),
        updatedAt: s.updatedAt,
        messageCount: 0, // OpenClaw 不提供
        agentId: s.agentId || 'main',
        model: s.model,
        tokens: s.totalTokens,
      })),
      total: sessions.length,
    });
  } catch (error) {
    console.error('[API] 获取会话列表失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/stats
 * 获取统计数据
 */
app.get('/api/stats', (req, res) => {
  try {
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 统计
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const activeCount = sessions.filter(s => s.updatedAt > fiveMinAgo).length;
    const completedCount = sessions.filter(s => s.updatedAt <= fiveMinAgo).length;
    
    const totalTokens = sessions.reduce((sum, s) => {
      return sum + (s.totalTokens || 0);
    }, 0);
    
    const totalRuntime = sessions.reduce((sum, s) => {
      return sum + (s.ageMs || 0);
    }, 0);
    
    // 统计模型使用
    const modelUsage = {};
    sessions.forEach(s => {
      const model = s.model || 'unknown';
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    });
    
    res.json({
      totalAgents: sessions.length,
      activeAgents: activeCount,
      completedAgents: completedCount,
      failedAgents: 0,
      totalTokens,
      totalRuntime,
      avgRuntime: completedCount > 0 ? totalRuntime / completedCount : 0,
      modelUsage,
    });
  } catch (error) {
    console.error('[API] 获取统计数据失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    mode: 'real-data',
  });
});

/**
 * GET /api/trace/flow
 * 执行流程追踪
 */
app.get('/api/trace/flow', (req, res) => {
  try {
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 转换为 TraceNode 格式
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const flow = sessions.map(s => ({
      id: s.key || `session:${s.updatedAt}`,
      agentId: s.agentId || 'main',
      channel: s.kind || 'direct',
      channelId: null,
      kind: s.kind || 'direct',
      model: s.model || 'unknown',
      status: s.updatedAt > fiveMinAgo ? 'running' : 'completed',
      tokens: s.totalTokens || 0,
      runtime: s.ageMs || 0,
      timestamp: s.updatedAt,
      key: s.key || `session:${s.updatedAt}`,
      isActive: s.updatedAt > fiveMinAgo,
    }));
    
    res.json({ flow });
  } catch (error) {
    console.error('[API] 获取执行流程失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/analytics/channels
 * 渠道统计
 */
app.get('/api/analytics/channels', (req, res) => {
  try {
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 按渠道分组统计
    const channelMap = new Map();
    sessions.forEach(s => {
      const channel = s.kind || 'direct';
      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          channel,
          count: 0,
          tokens: 0,
          runtime: 0,
          activeCount: 0,
          agents: [],
        });
      }
      const stat = channelMap.get(channel);
      stat.count++;
      stat.tokens += s.totalTokens || 0;
      stat.runtime += s.ageMs || 0;
      if (s.updatedAt > Date.now() - 5 * 60 * 1000) {
        stat.activeCount++;
      }
      stat.agents.push(s.key || 'unknown');
    });
    
    const channels = Array.from(channelMap.values()).map(c => ({
      ...c,
      avgTokens: c.count > 0 ? Math.round(c.tokens / c.count) : 0,
      avgRuntime: c.count > 0 ? Math.round(c.runtime / c.count) : 0,
    }));
    
    res.json({ channels });
  } catch (error) {
    console.error('[API] 获取渠道统计失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/trace/subagents
 * 子 Agent 链路
 */
app.get('/api/trace/subagents', (req, res) => {
  try {
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 提取子 Agent 链路（从 key 中解析）
    const subAgentLinks = sessions
      .filter(s => s.key && s.key.includes(':'))
      .map(s => ({
        id: s.key,
        parentId: 'main',
        status: s.updatedAt > Date.now() - 5 * 60 * 1000 ? 'running' : 'completed',
        timestamp: s.updatedAt,
        retries: 0,
      }));
    
    res.json({ subagents: subAgentLinks });
  } catch (error) {
    console.error('[API] 获取子 Agent 链路失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/sessions/:sessionId/history
 * 获取会话历史日志
 */
app.get('/api/sessions/:sessionId/history', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    console.log(`[API] 请求会话历史：${sessionId}`);
    
    // OpenClaw 不直接提供会话历史，返回空数组
    // 前端会显示模拟日志
    res.json({
      history: [],
      sessionId,
      note: 'OpenClaw 不提供会话历史 API',
    });
  } catch (error) {
    console.error('[API] 获取会话历史失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/agents/config/list
 * 获取配置列表（按类型分组：agents、skills）
 */
app.get('/api/agents/config/list', (req, res) => {
  try {
    const workspacePath = '/root/.openclaw/workspace';
    
    const result = {
      agents: [],
      skills: [],
    };
    
    // ========== 1. Agents 配置 ==========
    // 主 Agent - 读取 workspace 根目录的所有 .md 文件
    const mainFiles = [];
    
    // 扫描根目录下所有 .md 文件
    const rootFiles = fs.readdirSync(workspacePath)
      .filter(f => f.endsWith('.md') && fs.statSync(path.join(workspacePath, f)).isFile())
      .map(f => ({ name: f, path: f }));
    mainFiles.push(...rootFiles);
    
    // 读取 memory 目录
    const memoryPath = path.join(workspacePath, 'memory');
    if (fs.existsSync(memoryPath)) {
      const memoryFiles = fs.readdirSync(memoryPath)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f, path: `memory/${f}` }));
      mainFiles.push(...memoryFiles);
    }
    
    result.agents.push({
      id: 'main',
      name: '主 Agent (夏娃 Eve ✨)',
      path: workspacePath,
      files: mainFiles,
      category: 'agent',
    });
    
    // ========== 2. Skills 配置 ==========
    const skillsPath = path.join(workspacePath, 'skills');
    if (fs.existsSync(skillsPath)) {
      const skillDirs = fs.readdirSync(skillsPath).filter(f => {
        const stat = fs.statSync(path.join(skillsPath, f));
        return stat.isDirectory();
      });
      
      skillDirs.forEach(skillDir => {
        const skillFiles = [];
        const skillFullPath = path.join(skillsPath, skillDir);
        
        // 读取每个 skill 目录下的 .md 文件
        const files = fs.readdirSync(skillFullPath)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ name: f, path: `skills/${skillDir}/${f}` }));
        
        skillFiles.push(...files);
        
        result.skills.push({
          id: `skill-${skillDir}`,
          name: formatAgentName(skillDir),
          path: skillFullPath,
          files: skillFiles,
          category: 'skill',
        });
      });
    }
    
    // 按名称排序
    result.skills.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(result);
    console.log('[API] 返回配置列表：Agents:', result.agents.length, 'Skills:', result.skills.length);
  } catch (error) {
    console.error('[API] 获取配置列表失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/agents/:agentId/config/:fileName
 * 获取 Agent 配置文件内容（真实文件）
 */
app.get('/api/agents/:agentId/config/:fileName', (req, res) => {
  try {
    const { agentId, fileName } = req.params;
    const workspacePath = '/root/.openclaw/workspace';
    
    // 构建文件路径
    let filePath;
    if (agentId === 'main') {
      // 主 Agent - 直接在 workspace 根目录
      filePath = path.join(workspacePath, fileName);
    } else {
      // 子 Agent - 在 skills 或其他目录下（暂时返回主目录）
      filePath = path.join(workspacePath, fileName);
    }
    
    console.log(`[API] 读取配置文件：${filePath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: '文件不存在',
        path: filePath,
        agentId,
        fileName,
      });
    }
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    
    res.json({
      file: fileName,
      content: content,
      agentId: agentId,
      path: filePath,
      success: true,
    });
  } catch (error) {
    console.error('[API] 获取配置文件失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * PUT /api/agents/:agentId/config/:fileName
 * 保存 Agent 配置文件（真实文件）
 */
app.put('/api/agents/:agentId/config/:fileName', (req, res) => {
  try {
    const { agentId, fileName } = req.params;
    const { content } = req.body;
    const workspacePath = '/root/.openclaw/workspace';
    
    // 构建文件路径
    let filePath;
    if (agentId === 'main') {
      filePath = path.join(workspacePath, fileName);
    } else {
      filePath = path.join(workspacePath, fileName);
    }
    
    console.log(`[API] 保存配置文件：${filePath}`);
    
    // 写入文件
    fs.writeFileSync(filePath, content, 'utf-8');
    
    res.json({
      success: true,
      message: '配置已保存',
      agentId,
      fileName,
      path: filePath,
    });
  } catch (error) {
    console.error('[API] 保存配置文件失败:', error.message);
    res.status(500).json({ 
      error: '保存失败',
      details: error.message,
    });
  }
});

/**
 * WebSocket 支持（Socket.io）
 * 注意：需要安装 socket.io 包
 * 当前版本不支持，前端会回退到轮询模式
 */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Agent 监控平台 API 服务已启动`);
  console.log(`📡 监听端口：http://0.0.0.0:${PORT}`);
  console.log(`📊 可用端点:`);
  console.log(`   GET /api/subagents/list - 获取子 Agent 列表`);
  console.log(`   GET /api/sessions/list  - 获取会话列表`);
  console.log(`   GET /api/stats          - 获取统计数据`);
  console.log(`   GET /api/health         - 健康检查`);
  console.log(`💡 当前使用 **真实数据** (OpenClaw CLI)`);
  console.log(`🌐 可从外部访问（需要防火墙开放端口）`);
});
