/**
 * Agent 监控平台 - 真实数据 API 服务
 * 
 * 通过 OpenClaw CLI 获取真实的 Agent 运行数据
 * 支持 WebSocket 实时日志推送
 */

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const PORT = 3001;
const LOG_DIR = '/tmp/openclaw';

// 初始化 Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// 存储活跃的日志监听器
const logWatchers = new Map();

/**
 * Socket.IO 连接处理
 */
io.on('connection', (socket) => {
  console.log('[WebSocket] 客户端连接:', socket.id);
  
  // 订阅日志
  socket.on('subscribe:logs', (sessionId) => {
    console.log(`[WebSocket] 订阅日志：${sessionId}`);
    
    // 加入房间
    socket.join(`logs:${sessionId}`);
    
    // 如果还没有监听器，创建一个新的
    if (!logWatchers.has(sessionId)) {
      const logFile = path.join(LOG_DIR, `openclaw-${new Date().toISOString().split('T')[0]}.log`);
      
      if (fs.existsSync(logFile)) {
        const watcher = spawn('tail', ['-F', '-n', '100', logFile]);
        
        watcher.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(line => line.trim());
          
          lines.forEach(line => {
            try {
              const log = JSON.parse(line);
              const msg = log[0];
              
              // 检查是否包含 sessionId
              if (typeof msg === 'string' && (msg.includes(sessionId) || msg.includes('agent:main'))) {
                io.to(`logs:${sessionId}`).emit('log:new', {
                  timestamp: log.time ? new Date(log.time).getTime() : Date.now(),
                  level: log._meta?.logLevelName || 'INFO',
                  message: msg,
                  type: 'system',
                });
              }
            } catch (e) {
              // 跳过无法解析的行
            }
          });
        });
        
        logWatchers.set(sessionId, watcher);
      }
    }
  });
  
  // 取消订阅
  socket.on('unsubscribe:logs', (sessionId) => {
    console.log(`[WebSocket] 取消订阅：${sessionId}`);
    socket.leave(`logs:${sessionId}`);
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('[WebSocket] 客户端断开:', socket.id);
  });
});

/**
 * 解析日志文件提取子 Agent 链路
 */
function parseSubagentChainFromLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return [];
    
    const logFiles = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse();
    
    if (logFiles.length === 0) return [];
    
    const latestLog = path.join(LOG_DIR, logFiles[0]);
    const logContent = fs.readFileSync(latestLog, 'utf-8');
    const lines = logContent.split('\n').slice(-2000); // 分析最后 2000 行
    
    const subagentMap = new Map();
    
    lines.forEach(line => {
      try {
        const log = JSON.parse(line);
        const msg = log[0];
        
        if (typeof msg === 'string') {
          // 匹配子 Agent 创建/放弃事件
          // 格式：[warn] Subagent announce give up (retry-limit) run=xxx child=agent:main:subagent:yyy requester=agent:main:main retries=3
          const giveUpMatch = msg.match(/Subagent announce give up.*run=([a-f0-9-]+)\s+child=(agent:[^\s]+)\s+requester=(agent:[^\s]+)\s+retries=(\d+)/);
          
          if (giveUpMatch) {
            const [, runId, childId, parentId, retries] = giveUpMatch;
            
            subagentMap.set(childId, {
              id: childId,
              parentId,
              runId,
              status: 'failed',
              error: 'Retry limit exceeded',
              retries: parseInt(retries),
              timestamp: log.time ? new Date(log.time).getTime() : Date.now(),
            });
          }
          
          // 匹配子 Agent 完成事件
          const completionMatch = msg.match(/Subagent completion.*run=([a-f0-9-]+)/);
          if (completionMatch && !msg.includes('failed')) {
            const runId = completionMatch[1];
            
            // 查找对应的子 Agent
            for (const [childId, subagent] of subagentMap.entries()) {
              if (subagent.runId === runId && subagent.status === 'failed') {
                // 已经是失败状态，不覆盖
              } else if (subagent.runId === runId) {
                subagent.status = 'completed';
              }
            }
          }
        }
      } catch (e) {
        // 跳过无法解析的行
      }
    });
    
    return Array.from(subagentMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('解析日志失败:', error.message);
    return [];
  }
}

/**
 * 从 sessions 文件读取子 Agent 信息
 */
function parseSubagentFromSessions() {
  try {
    const sessionsFile = '/root/.openclaw/agents/main/sessions/sessions.json';
    if (!fs.existsSync(sessionsFile)) return [];
    
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const subagents = [];
    
    for (const [key, session] of Object.entries(sessionsData)) {
      if (key.includes(':subagent:')) {
        const parts = key.split(':');
        const parentId = parts.slice(0, 2).join(':') + ':main'; // agent:main:main
        
        subagents.push({
          id: key,
          parentId,
          status: session.status || 'completed',
          timestamp: session.updatedAt || Date.now(),
          spawnDepth: session.spawnDepth || 1,
        });
      }
    }
    
    return subagents.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('读取 sessions 文件失败:', error.message);
    return [];
  }
}

/**
 * 执行 OpenClaw CLI 命令
 */
function runOpenClawCommand(args) {
  try {
    const cmd = `openclaw ${args.join(' ')}`;
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 15000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return output.trim();
  } catch (error) {
    console.error(`OpenClaw CLI 执行失败：${error.message}`);
    throw new Error(`OpenClaw CLI 执行失败：${error.stderr || error.message}`);
  }
}

/**
 * 解析 CLI 输出为 JSON
 */
function parseJsonOutput(output) {
  try {
    return JSON.parse(output);
  } catch (error) {
    console.error('JSON 解析失败:', output.substring(0, 200));
    throw new Error('无法解析 OpenClaw 输出');
  }
}

/**
 * 转换会话数据为 Agent 格式
 */
function transformSessionToAgent(session) {
  const isRunning = session.ageMs < 300000; // 5 分钟内更新视为运行中
  const status = isRunning ? 'running' : 'done';
  
  // 从 sessionKey 提取 agent 名称
  // 格式：agent:main:subagent:xxx 或 agent:main:xxx
  let agentName = session.agentId || 'main';
  if (session.key) {
    const parts = session.key.split(':');
    if (parts.length >= 2) {
      agentName = parts[1]; // 取第二个部分作为 agent 名称
    }
  }
  
  return {
    id: session.sessionId || session.key,
    agentId: session.agentId || 'main',
    sessionKey: session.key,
    status,
    task: session.label || session.key,
    label: agentName, // 使用 agent 名称作为任务名
    runtimeMs: session.ageMs || 0,
    runtime: formatDuration(session.ageMs || 0),
    model: session.model || 'unknown',
    totalTokens: session.totalTokens || 0,
    inputTokens: session.inputTokens || 0,
    outputTokens: session.outputTokens || 0,
    startedAt: session.updatedAt - (session.ageMs || 0),
    updatedAt: session.updatedAt,
    endedAt: status === 'done' ? session.updatedAt : null,
    createdAt: session.updatedAt - (session.ageMs || 0),
  };
}

/**
 * 格式化时间
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * GET /api/agents/list
 * 获取 Agent 列表（活跃 + 最近）
 */
app.get('/api/agents/list', (req, res) => {
  try {
    const output = runOpenClawCommand(['sessions', '--json']);
    const data = parseJsonOutput(output);
    
    const sessions = data.sessions || [];
    
    // 转换数据
    const agents = sessions.map(transformSessionToAgent);
    
    // 去重：使用 agent.id 作为唯一标识，保留最新的记录
    const uniqueAgentsMap = new Map();
    agents.forEach(agent => {
      const key = agent.id; // 使用 agent.id（sessionId）作为唯一 key
      const existing = uniqueAgentsMap.get(key);
      // 如果没有现有记录，或当前记录更新，则保留
      if (!existing || (agent.updatedAt || 0) > (existing.updatedAt || 0)) {
        uniqueAgentsMap.set(key, agent);
      }
    });
    
    const uniqueAgents = Array.from(uniqueAgentsMap.values());
    console.log(`[API] 去重后：${uniqueAgents.length} 条记录（原始 ${agents.length} 条）`);
    
    // 分类：活跃（5 分钟内）和最近完成
    const activeAgents = uniqueAgents.filter(a => a.status === 'running');
    const recentAgents = uniqueAgents
      .filter(a => a.status === 'done')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20); // 最近 20 个
    
    console.log(`[API] 返回数据：总计 ${uniqueAgents.length}, 活跃 ${activeAgents.length}, 最近 ${recentAgents.length}`);
    
    res.json({
      total: uniqueAgents.length,
      active: activeAgents,
      recent: recentAgents,
    });
  } catch (error) {
    console.error('获取 Agent 列表失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取 OpenClaw 数据失败',
    });
  }
});

/**
 * GET /api/stats
 * 获取统计数据
 */
app.get('/api/stats', (req, res) => {
  try {
    const output = runOpenClawCommand(['sessions', '--json']);
    const data = parseJsonOutput(output);
    
    const sessions = data.sessions || [];
    const agents = sessions.map(transformSessionToAgent);
    
    const activeCount = agents.filter(a => a.status === 'running').length;
    const completedCount = agents.filter(a => a.status === 'done').length;
    const failedCount = 0; // OpenClaw 没有明确的失败状态
    
    const totalTokens = agents.reduce((sum, a) => sum + (a.totalTokens || 0), 0);
    const totalRuntime = agents.reduce((sum, a) => sum + (a.runtimeMs || 0), 0);
    
    // 统计模型使用
    const modelUsage = {};
    agents.forEach(agent => {
      if (agent.model) {
        modelUsage[agent.model] = (modelUsage[agent.model] || 0) + 1;
      }
    });

    res.json({
      totalAgents: agents.length,
      activeAgents: activeCount,
      completedAgents: completedCount,
      failedAgents: failedCount,
      totalTokens,
      totalRuntime,
      avgRuntime: completedCount > 0 ? totalRuntime / completedCount : 0,
      modelUsage,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取 OpenClaw 数据失败',
    });
  }
});

/**
 * GET /api/sessions/list
 * 获取会话列表（兼容旧接口）
 */
app.get('/api/sessions/list', (req, res) => {
  try {
    const output = runOpenClawCommand(['sessions', '--json']);
    const data = parseJsonOutput(output);
    
    res.json({
      sessions: data.sessions || [],
      total: data.count || 0,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: '获取会话列表失败',
    });
  }
});

/**
 * GET /api/sessions/:id/history
 * 获取会话历史（包含消息和工具调用）
 */
app.get('/api/sessions/:id/history', (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // 从 sessions 文件读取
    const sessionsFile = '/root/.openclaw/agents/main/sessions/sessions.json';
    if (!fs.existsSync(sessionsFile)) {
      return res.status(404).json({ error: 'Sessions file not found' });
    }
    
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    const session = sessionsData[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // 尝试读取会话历史文件
    const historyFile = `/root/.openclaw/agents/main/sessions/${sessionId}.json`;
    let history = [];
    
    if (fs.existsSync(historyFile)) {
      const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      history = historyData.messages || historyData.history || [];
    }
    
    // 解析工具调用
    const toolCalls = [];
    history.forEach(msg => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach(tool => {
          toolCalls.push({
            name: tool.name || tool.tool,
            args: tool.args || tool.input,
            result: tool.result,
            timestamp: msg.timestamp,
          });
        });
      }
    });
    
    res.json({
      session: {
        id: sessionId,
        key: session.key,
        status: session.status || 'completed',
        updatedAt: session.updatedAt,
        spawnDepth: session.spawnDepth,
      },
      history,
      toolCalls,
      stats: {
        totalMessages: history.length,
        totalToolCalls: toolCalls.length,
      },
    });
  } catch (error) {
    console.error('获取会话历史失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取会话历史失败',
    });
  }
});

/**
 * GET /api/trace/subagents
 * 获取子 Agent 链路（从日志 + sessions 文件解析）
 */
app.get('/api/trace/subagents', (req, res) => {
  try {
    const fromLogs = parseSubagentChainFromLogs();
    const fromSessions = parseSubagentFromSessions();
    
    // 合并数据源，去重（优先使用日志数据，因为更详细）
    const subagentMap = new Map();
    
    // 先添加 sessions 数据
    fromSessions.forEach(subagent => {
      subagentMap.set(subagent.id, subagent);
    });
    
    // 再用日志数据覆盖（日志有更详细的信息）
    fromLogs.forEach(subagent => {
      subagentMap.set(subagent.id, { ...subagentMap.get(subagent.id), ...subagent });
    });
    
    const subagents = Array.from(subagentMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({ 
      subagents,
      total: subagents.length,
      sources: {
        logs: fromLogs.length,
        sessions: fromSessions.length,
      }
    });
  } catch (error) {
    console.error('获取子 Agent 链路失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取子 Agent 链路失败',
    });
  }
});

/**
 * GET /api/trace/flow
 * 获取 Agent 执行流程（从会话历史中提取协作链路）
 */
app.get('/api/trace/flow', (req, res) => {
  try {
    const output = runOpenClawCommand(['sessions', '--json']);
    const data = parseJsonOutput(output);
    
    // 构建 Agent 执行流程
    const sessions = data.sessions || [];
    const flow = [];
    
    // 按时间排序
    const sortedSessions = sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    sortedSessions.forEach((session, index) => {
      // 解析会话 key 提取渠道信息
      // 格式：agent:{agentId}:{channel}:{groupId} 或 agent:{agentId}:{kind}:{sessionId}
      const keyParts = session.key.split(':');
      let channel = 'unknown';
      let channelId = null;
      
      // 解析渠道：feishu/wecom/control-ui 等
      if (keyParts.length >= 3) {
        const potentialChannel = keyParts[2];
        if (['feishu', 'wecom', 'cron', 'subagent', 'main'].includes(potentialChannel)) {
          if (potentialChannel === 'main') channel = 'control-ui';
          else if (potentialChannel === 'cron') channel = 'cron';
          else if (potentialChannel === 'subagent') channel = 'subagent';
          else {
            channel = potentialChannel;
            // 提取渠道 ID（如群组 ID）
            if (keyParts.length >= 4 && keyParts[3] === 'group') {
              channelId = keyParts[4] || null;
            }
          }
        }
      }
      
      flow.push({
        id: session.sessionId || `session-${index}`,
        agentId: session.agentId || 'unknown',
        channel,
        channelId,
        kind: session.kind || 'direct',
        model: session.model,
        status: session.abortedLastRun ? 'failed' : 'completed',
        tokens: session.totalTokens || 0,
        runtime: session.ageMs || 0,
        timestamp: session.updatedAt || Date.now(),
        key: session.key,
        // 标记是否为活跃会话
        isActive: index === 0,
      });
    });

    res.json({ 
      flow,
      total: flow.length,
      activeCount: flow.filter(s => s.isActive).length,
    });
  } catch (error) {
    console.error('获取执行流程失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取执行流程失败',
    });
  }
});

/**
 * GET /api/analytics/channels
 * 获取渠道维度分析数据
 */
app.get('/api/analytics/channels', (req, res) => {
  try {
    const output = runOpenClawCommand(['sessions', '--json']);
    const data = parseJsonOutput(output);
    
    const sessions = data.sessions || [];
    
    // 按渠道分组统计
    const channelStats = sessions.reduce((acc, session) => {
      const keyParts = session.key.split(':');
      let channel = 'unknown';
      
      if (keyParts.length >= 3) {
        const potentialChannel = keyParts[2];
        if (['feishu', 'wecom', 'cron', 'subagent', 'main'].includes(potentialChannel)) {
          if (potentialChannel === 'main') channel = 'control-ui';
          else if (potentialChannel === 'cron') channel = 'cron';
          else if (potentialChannel === 'subagent') channel = 'subagent';
          else channel = potentialChannel;
        }
      }
      
      if (!acc[channel]) {
        acc[channel] = {
          channel,
          count: 0,
          tokens: 0,
          runtime: 0,
          activeCount: 0,
          agents: new Set(),
        };
      }
      
      acc[channel].count += 1;
      acc[channel].tokens += session.totalTokens || 0;
      acc[channel].runtime += session.ageMs || 0;
      if (session.agentId) acc[channel].agents.add(session.agentId);
      
      // 检查是否活跃（最新的会话）
      const isActive = sessions.indexOf(session) === 0;
      if (isActive) acc[channel].activeCount += 1;
      
      return acc;
    }, {});
    
    // 转换为数组并排序
    const channelList = Object.values(channelStats)
      .map(stat => ({
        ...stat,
        agents: Array.from(stat.agents),
        avgTokens: stat.count > 0 ? Math.round(stat.tokens / stat.count) : 0,
        avgRuntime: stat.count > 0 ? Math.round(stat.runtime / stat.count) : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    res.json({ 
      channels: channelList,
      total: channelList.length,
      totalSessions: sessions.length,
    });
  } catch (error) {
    console.error('获取渠道分析失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取渠道分析失败',
    });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  try {
    // 测试 OpenClaw CLI 是否可用
    runOpenClawCommand(['--version']);
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      openclaw: 'available',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: Date.now(),
      openclaw: 'unavailable',
      error: error.message,
    });
  }
});

/**
 * GET /api/agents/config/list
 * 获取 Agent 配置文件列表（自动扫描 agents 目录）
 */
app.get('/api/agents/config/list', (req, res) => {
  try {
    const agentsDir = '/root/.openclaw/agents';
    
    if (!fs.existsSync(agentsDir)) {
      return res.json({ agents: [], total: 0, message: 'Agents 目录不存在' });
    }

    const agents = fs.readdirSync(agentsDir)
      .filter(item => {
        const itemPath = path.join(agentsDir, item);
        return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
      })
      .sort(); // 按字母排序

    const configList = agents.map(agentId => {
      // 配置文件可能在 agent 子目录或直接 in 目录
      const possiblePaths = [
        path.join(agentsDir, agentId, 'agent'),
        path.join(agentsDir, agentId),
      ];
      
      let agentPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
      
      let files = [];
      if (fs.existsSync(agentPath)) {
        files = fs.readdirSync(agentPath)
          .filter(file => {
            const stat = fs.statSync(path.join(agentPath, file));
            return stat.isFile() && (file.endsWith('.md') || file.endsWith('.json'));
          })
          .map(name => ({
            name,
            path: path.join(agentPath, name),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)); // 文件名排序
      }

      return {
        id: agentId,
        path: agentPath,
        files,
        fileCount: files.length,
      };
    }).filter(agent => agent.files.length > 0);

    console.log(`[API] 扫描到 ${configList.length} 个 Agent 配置`);
    res.json({ agents: configList, total: configList.length });
  } catch (error) {
    console.error('获取 Agent 配置列表失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '获取配置列表失败',
    });
  }
});

/**
 * GET /api/agents/:id/config/:file
 * 读取配置文件内容
 */
app.get('/api/agents/:id/config/:file', (req, res) => {
  try {
    const { id, file } = req.params;
    // 配置文件在 agent 子目录下
    const filePath = path.join('/root/.openclaw/agents', id, 'agent', file);
    
    // 安全检查：防止目录遍历攻击
    const agentsDir = '/root/.openclaw/agents';
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(agentsDir)) {
      return res.status(403).json({ error: '禁止访问此文件' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ 
      agentId: id,
      fileName: file,
      filePath,
      content,
    });
  } catch (error) {
    console.error('读取文件失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '读取文件失败',
    });
  }
});

/**
 * PUT /api/agents/:id/config/:file
 * 保存配置文件内容
 */
app.put('/api/agents/:id/config/:file', (req, res) => {
  try {
    const { id, file } = req.params;
    const { content } = req.body;
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content 必须是字符串' });
    }

    // 配置文件在 agent 子目录下
    const filePath = path.join('/root/.openclaw/agents', id, 'agent', file);
    
    // 安全检查：防止目录遍历攻击
    const agentsDir = '/root/.openclaw/agents';
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(agentsDir)) {
      return res.status(403).json({ error: '禁止访问此文件' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 写入文件
    fs.writeFileSync(filePath, content, 'utf-8');
    
    console.log(`[API] 文件已保存：${filePath}`);
    res.json({ 
      success: true,
      agentId: id,
      fileName: file,
      filePath,
      message: '文件已保存',
    });
  } catch (error) {
    console.error('保存文件失败:', error.message);
    res.status(500).json({
      error: error.message,
      message: '保存文件失败',
    });
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Agent 监控平台 - 真实数据 API 服务`);
  console.log(`📡 监听端口：http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`📊 可用端点:`);
  console.log(`   GET /api/agents/list         - 获取 Agent 列表（活跃 + 最近）`);
  console.log(`   GET /api/stats               - 获取统计数据`);
  console.log(`   GET /api/sessions/list       - 获取会话列表`);
  console.log(`   GET /api/agents/config/list  - 获取 Agent 配置文件列表`);
  console.log(`   GET /api/agents/:id/config/:file - 读取配置文件`);
  console.log(`   PUT /api/agents/:id/config/:file - 保存配置文件`);
  console.log(`   GET /api/health              - 健康检查`);
  console.log(`🔗 数据来源：OpenClaw CLI (实时)`);
  console.log(`\n💡 使用 SSH 端口转发访问:`);
  console.log(`   ssh -L ${PORT}:localhost:${PORT} user@your-server\n`);
});
