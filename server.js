/**
 * Agent 监控平台 - API 桥接服务
 * 
 * 调用 OpenClaw CLI 获取真实数据
 * 
 * 配置说明：
 * - config.json: 基础配置（路径、端口等）
 * - .env: 环境变量（可覆盖 config.json）
 */

import express from 'express';
import cors from 'cors';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
config({ path: path.join(__dirname, '.env') });

// 加载配置文件
let appConfig = {};
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log('📋 已加载配置文件：config.json');
}

// 从环境变量或配置文件读取配置
const PORT = parseInt(process.env.PORT || appConfig.server?.port || '3001');
const HOST = process.env.HOST || appConfig.server?.host || '0.0.0.0';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || appConfig.server?.cacheTTL || '10000'); // 优化：5s → 10s
const STATS_CACHE_TTL = 30000; // 统计数据 30 秒缓存
const SESSIONS_CACHE_TTL = 15000; // 会话列表 15 秒缓存

// OpenClaw 路径配置
const OPENCLAW = {
  cliPath: process.env.OPENCLAW_CLI_PATH || appConfig.openclaw?.cliPath || '/root/.nvm/versions/node/v24.13.0/bin/openclaw',
  nodePath: process.env.NODE_PATH || appConfig.openclaw?.nodePath || '/root/.nvm/versions/node/v24.13.0/bin/node',
  basePath: process.env.OPENCLAW_BASE_PATH || appConfig.openclaw?.basePath || '/root/.openclaw',
  agentsPath: process.env.OPENCLAW_AGENTS_PATH || appConfig.openclaw?.agentsPath || '/root/.openclaw/agents',
  workspacePath: process.env.OPENCLAW_WORKSPACE_PATH || appConfig.openclaw?.workspacePath || '/root/.openclaw/workspace',
};

// 日志路径
const LOG_PATH = process.env.LOG_PATH || appConfig.server?.logPath || '/root/.openclaw/monitor-platform/logs';

// 安全配置
const ALLOWED_BASE_PATHS = (process.env.ALLOWED_BASE_PATHS || appConfig.security?.allowedBasePaths || '/root/.openclaw').split(',');

const app = express();

app.use(cors());
app.use(express.json());

console.log('⚙️  配置信息:');
console.log(`   端口：${PORT}`);
console.log(`   OpenClaw 路径：${OPENCLAW.basePath}`);
console.log(`   Agents 路径：${OPENCLAW.agentsPath}`);
console.log(`   日志路径：${LOG_PATH}`);

/**
 * 执行 OpenClaw CLI 命令（带缓存）
 */
let sessionsCache = null;
let cacheTimestamp = 0;

function runOpenClawCommand(command) {
  try {
    // 使用配置的 CLI 路径，保持完整命令字符串
    const fullCommand = command.startsWith('openclaw') 
      ? `${OPENCLAW.cliPath} ${command.replace('openclaw ', '')}`
      : `${OPENCLAW.nodePath} ${command}`;
    
    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      timeout: 15000, // 15 秒超时
      env: { 
        ...process.env, 
        PATH: `${path.dirname(OPENCLAW.nodePath)}:${process.env.PATH}`,
      },
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
  if (sessionsCache && (now - cacheTimestamp) < SESSIONS_CACHE_TTL) {
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
  const createdAt = session.updatedAt - (session.ageMs || 0);
  const updatedAt = session.updatedAt;
  
  return {
    id: session.sessionKey || session.key || `agent:unknown`,  // 使用 sessionKey（agent:main:main 格式）
    agentId: 'agent:main',
    status: 'done', // 存储的会话都是已完成的
    task: label || '未知任务',
    label: label || '会话',
    runtimeMs: session.ageMs || 0,
    runtime: formatDuration(session.ageMs || 0),
    model: session.model || 'qwen3.5-plus',
    totalTokens: session.totalTokens || session.tokenUsage?.total || 0,
    inputTokens: session.inputTokens || session.tokenUsage?.input || 0,
    outputTokens: session.outputTokens || session.tokenUsage?.output || 0,
    startedAt: createdAt,
    endedAt: updatedAt,
    createdAt: createdAt,
    updatedAt: updatedAt,
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
    // CLI 返回格式：{sessions: [...], count: N, path: '...'}
    const sessions = (sessionsData.sessions || []).slice(0, limit);
    
    res.json({
      sessions: sessions.map(s => ({
        sessionId: s.sessionId || s.key,
        sessionKey: s.key,
        label: s.key || '未知会话',
        createdAt: s.updatedAt - (s.ageMs || 0),
        updatedAt: s.updatedAt,
        messageCount: 0, // OpenClaw 不提供
        agentId: s.agentId || 'main',
        model: s.model,
        tokens: s.totalTokens || 0,
        inputTokens: s.inputTokens || 0,
        outputTokens: s.outputTokens || 0,
        contextTokens: s.contextTokens || 0,
        kind: s.kind || 'direct',
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
 * 获取统计数据（带缓存优化）
 */
let statsCache = null;
let statsCacheTime = 0;

app.get('/api/stats', (req, res) => {
  try {
    const now = Date.now();
    // 检查缓存
    if (statsCache && (now - statsCacheTime) < STATS_CACHE_TTL) {
      return res.json(statsCache);
    }
    
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
    
    const result = {
      totalAgents: sessions.length,
      activeAgents: activeCount,
      completedAgents: completedCount,
      failedAgents: 0,
      totalTokens,
      totalRuntime,
      avgRuntime: completedCount > 0 ? totalRuntime / completedCount : 0,
      modelUsage,
    };
    // 更新缓存
    statsCache = result;
    statsCacheTime = now;
    
    res.json(result);
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
 * 执行流程追踪（带缓存）
 */
let traceCache = null;
let traceCacheTime = 0;
const TRACE_CACHE_TTL = 20000; // 20 秒缓存

/**
 * 从 JSONL 文件提取第一条消息作为任务描述
 */
function extractTaskDescription(sessionKey, sessionId) {
  try {
    const jsonlPath = path.join(OPENCLAW.agentsPath, `main/sessions/${sessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) return null;
    
    const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;
    
    // 读取前 5 条消息，找第一条用户消息
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const record = JSON.parse(lines[i]);
      if (record.type === 'message' && record.message?.role === 'user') {
        const content = record.message.content;
        // content 可能是字符串或数组
        if (typeof content === 'string') {
          return content.substring(0, 100);
        } else if (Array.isArray(content)) {
          const textItem = content.find(item => item.type === 'text');
          if (textItem?.text) {
            return textItem.text.substring(0, 100);
          }
        }
      }
    }
  } catch (error) {
    // 静默失败
  }
  return null;
}

/**
 * 解析会话 ID，生成简化显示信息
 */
function parseSessionInfo(sessionKey) {
  const parts = sessionKey.split(':');
  
  // 默认值
  let displayName = '会话';
  let shortId = sessionKey.substring(0, 8);
  let type = 'direct';
  let typeIcon = '💬';
  let typeName = '直接会话';
  
  // 提取短 ID（UUID 部分）
  const uuidMatch = sessionKey.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (uuidMatch) {
    shortId = uuidMatch[0].substring(0, 8);
  }
  
  // 判断类型
  if (sessionKey.includes('cron')) {
    type = 'cron';
    typeIcon = '⏰';
    typeName = '定时任务';
    displayName = '⏰ 定时任务';
  } else if (sessionKey.includes('feishu')) {
    type = 'feishu';
    typeIcon = '📝';
    typeName = '飞书会话';
    displayName = '📝 飞书会话';
  } else if (sessionKey.includes('wecom')) {
    type = 'wecom';
    typeIcon = '💼';
    typeName = '企微会话';
    displayName = '💼 企微会话';
  } else if (sessionKey.includes('subagent') || sessionKey.includes('agent:')) {
    type = 'subagent';
    typeIcon = '🤖';
    typeName = '子 Agent';
    displayName = '🤖 子 Agent';
  } else {
    type = 'direct';
    typeIcon = '💬';
    typeName = '直接会话';
    displayName = '💬 直接会话';
  }
  
  return {
    displayName,
    shortId,
    type,
    typeIcon,
    typeName,
  };
}

app.get('/api/trace/flow', (req, res) => {
  try {
    const now = Date.now();
    // 检查缓存
    if (traceCache && (now - traceCacheTime) < TRACE_CACHE_TTL) {
      return res.json(traceCache);
    }
    
    const sessionsData = getSessionsData();
    const sessions = sessionsData.sessions || [];
    
    // 转换为 TraceNode 格式（增强版）
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const flow = sessions.map(s => {
      const sessionKey = s.key || `session:${s.updatedAt}`;
      const sessionId = s.sessionId || 'unknown';
      const parsedInfo = parseSessionInfo(sessionKey);
      const taskDescription = extractTaskDescription(sessionKey, sessionId);
      
      return {
        id: sessionKey,
        agentId: s.agentId || 'main',
        channel: s.kind || 'direct',
        channelId: null,
        kind: s.kind || 'direct',
        model: s.model || 'unknown',
        status: s.updatedAt > fiveMinAgo ? 'running' : 'completed',
        tokens: s.totalTokens || 0,
        runtime: s.ageMs || 0,
        timestamp: s.updatedAt,
        key: sessionKey,
        isActive: s.updatedAt > fiveMinAgo,
        // 新增字段
        displayName: parsedInfo.displayName,
        shortId: parsedInfo.shortId,
        sessionType: parsedInfo.type,
        typeIcon: parsedInfo.typeIcon,
        typeName: parsedInfo.typeName,
        taskDescription,
        inputTokens: s.inputTokens || 0,
        outputTokens: s.outputTokens || 0,
        contextTokens: s.contextTokens || 0,
      };
    });
    
    const result = { flow };
    // 更新缓存
    traceCache = result;
    traceCacheTime = now;
    
    res.json(result);
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
 * 获取会话历史日志（从 JSONL 文件读取）
 * 支持两种 ID 格式：
 * - sessionKey: agent:main:main
 * - sessionId (UUID): c9be6b89-67c5-44da-9079-dbe0254ca065
 */
app.get('/api/sessions/:sessionId/history', async (req, res) => {
  try {
    const requestedId = req.params.sessionId;
    console.log(`[API] 请求会话历史：${requestedId}`);
    
    // 1. 从 sessions.json 查找对应的 jsonl 文件路径
    const sessionsIndexPath = path.join(OPENCLAW.agentsPath, 'main/sessions/sessions.json');
    
    if (!fs.existsSync(sessionsIndexPath)) {
      return res.status(404).json({ 
        error: '会话索引文件不存在',
        sessionId: requestedId,
      });
    }
    
    const sessionsIndex = JSON.parse(fs.readFileSync(sessionsIndexPath, 'utf-8'));
    
    // 2. 尝试两种方式查找 session：
    // - 直接用 requestedId 作为 key 查找（sessionKey 格式）
    // - 遍历查找 sessionId 匹配的（UUID 格式）
    let sessionInfo = sessionsIndex[requestedId];
    let sessionKey = requestedId;
    
    if (!sessionInfo || !sessionInfo.sessionId) {
      // 尝试通过 UUID 查找
      for (const [key, info] of Object.entries(sessionsIndex)) {
        if (info.sessionId === requestedId) {
          sessionInfo = info;
          sessionKey = key;
          break;
        }
      }
    }
    
    if (!sessionInfo || !sessionInfo.sessionId) {
      return res.status(404).json({ 
        error: '会话不存在',
        sessionId: requestedId,
        hint: '请检查 sessionKey 或 sessionId 是否正确',
      });
    }
    
    // 3. 构建 jsonl 文件路径
    const actualSessionId = sessionInfo.sessionId;
    const jsonlPath = `/root/.openclaw/agents/main/sessions/${actualSessionId}.jsonl`;
    
    if (!fs.existsSync(jsonlPath)) {
      return res.status(404).json({ 
        error: '会话日志文件不存在',
        sessionId: requestedId,
        sessionKey,
        actualSessionId,
      });
    }
    
    // 3. 读取并解析 JSONL 文件
    const content = fs.readFileSync(jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // 4. 解析每条记录，只返回 type='message' 的记录
    const history = [];
    const toolCalls = [];
    
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        
        if (record.type === 'message' && record.message) {
          const message = {
            role: record.message.role,
            timestamp: new Date(record.timestamp).getTime(),
            content: null,
            toolCalls: null,
          };
          
          // 解析 content（可能是字符串或数组）
          if (Array.isArray(record.message.content)) {
            // 提取文本内容
            const textParts = record.message.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join('');
            message.content = textParts;
            
            // 提取工具调用
            const tools = record.message.content
              .filter(item => item.type === 'toolCall')
              .map(item => ({
                id: item.id,
                name: item.name,
                args: item.args,
              }));
            if (tools.length > 0) {
              message.toolCalls = tools;
              toolCalls.push(...tools.map(t => ({
                name: t.name,
                args: t.args,
                timestamp: message.timestamp,
                status: 'success',
              })));
            }
          } else if (typeof record.message.content === 'string') {
            message.content = record.message.content;
          }
          
          // 处理 toolResult
          if (record.message.role === 'toolResult') {
            message.role = 'tool';
            message.content = record.message.content?.[0]?.text || JSON.stringify(record.message.content);
          }
          
          history.push(message);
        }
      } catch (parseError) {
        console.warn(`[API] 解析 JSONL 行失败：${parseError.message}`);
        // 跳过无法解析的行
      }
    }
    
    console.log(`[API] 返回会话历史：${history.length} 条消息，${toolCalls.length} 个工具调用`);
    
    res.json({ 
      history,
      toolCalls,
      sessionId: sessionKey,  // 返回 sessionKey（agent:main:main 格式）
      actualSessionId,        // UUID 格式
      requestedId,            // 请求时使用的 ID
      source: 'jsonl',
      totalLines: lines.length,
    });
  } catch (error) {
    console.error('[API] 获取会话历史失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
      stack: error.stack,
    });
  }
});

/**
 * 递归扫描目录获取文件列表
 */
function scanDirectory(dirPath, relativePath = '', maxDepth = 3, currentDepth = 0) {
  const files = [];
  
  if (currentDepth > maxDepth) return files;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      // 跳过隐藏文件和 node_modules
      if (item.startsWith('.') && item !== '.openclaw') continue;
      if (item === 'node_modules') continue;
      
      const fullPath = path.join(dirPath, item);
      const relPath = relativePath ? `${relativePath}/${item}` : item;
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        // 只包含可编辑的文件类型
        const ext = path.extname(item).toLowerCase();
        const editableExts = ['.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.yaml', '.yml', '.html', '.css', '.sh', '.env', '.toml', '.xml'];
        
        if (editableExts.includes(ext) || ext === '') {
          files.push({
            name: item,
            path: relPath,
            fullPath: fullPath,
            size: stat.size,
            type: getFileType(ext),
            ext: ext,
          });
        }
      } else if (stat.isDirectory()) {
        // 递归扫描子目录
        const subFiles = scanDirectory(fullPath, relPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${dirPath}:`, error.message);
  }
  
  return files;
}

/**
 * 获取文件类型
 */
function getFileType(ext) {
  const types = {
    '.md': 'markdown',
    '.txt': 'text',
    '.json': 'json',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'shell',
    '.env': 'env',
    '.toml': 'toml',
    '.xml': 'xml',
  };
  return types[ext] || 'text';
}

/**
 * GET /api/agents/config/list
 * 获取配置列表（包含 agents 和 workspace 所有文件）
 */
app.get('/api/agents/config/list', (req, res) => {
  try {
    const result = {
      agents: [],
      workspace: [],
      skills: [],
    };
    
    // ========== 1. Agents 目录 ==========
    const agentsPath = OPENCLAW.agentsPath;
    if (fs.existsSync(agentsPath)) {
      const agentDirs = fs.readdirSync(agentsPath).filter(f => {
        const stat = fs.statSync(path.join(agentsPath, f));
        return stat.isDirectory();
      });
      
      agentDirs.forEach(agentDir => {
        const agentFullPath = path.join(agentsPath, agentDir);
        const files = scanDirectory(agentFullPath, '', 2);
        
        result.agents.push({
          id: `agent-${agentDir}`,
          name: formatAgentName(agentDir),
          path: agentFullPath,
          files: files,
          category: 'agent',
        });
      });
    }
    
    // ========== 2. Workspace 目录 ==========
    const workspacePath = OPENCLAW.workspacePath;
    if (fs.existsSync(workspacePath)) {
      const workspaceFiles = scanDirectory(workspacePath, '', 3);
      
      // 按目录分组
      const dirGroups = {};
      workspaceFiles.forEach(file => {
        const dir = path.dirname(file.path);
        if (!dirGroups[dir]) {
          dirGroups[dir] = {
            id: `workspace-${dir === '.' ? 'root' : dir.replace(/\//g, '-')}`,
            name: dir === '.' ? '根目录' : dir,
            path: path.join(workspacePath, dir),
            files: [],
            category: 'workspace',
          };
        }
        dirGroups[dir].files.push(file);
      });
      
      result.workspace = Object.values(dirGroups);
    }
    
    // ========== 3. /root/.openclaw/workspace/skills 目录 ==========
    const skillsPath = path.join(workspacePath, 'skills');
    if (fs.existsSync(skillsPath)) {
      const skillDirs = fs.readdirSync(skillsPath).filter(f => {
        const stat = fs.statSync(path.join(skillsPath, f));
        return stat.isDirectory();
      });
      
      skillDirs.forEach(skillDir => {
        const skillFullPath = path.join(skillsPath, skillDir);
        const files = scanDirectory(skillFullPath, '', 2);
        
        result.skills.push({
          id: `skill-${skillDir}`,
          name: formatAgentName(skillDir),
          path: skillFullPath,
          files: files,
          category: 'skill',
        });
      });
    }
    
    // 按名称排序
    result.agents.sort((a, b) => a.name.localeCompare(b.name));
    result.skills.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(result);
    console.log('[API] 返回配置列表 - Agents:', result.agents.length, 
                'Workspace:', result.workspace.length, 
                'Skills:', result.skills.length);
  } catch (error) {
    console.error('[API] 获取配置列表失败:', error.message);
    res.status(500).json({ 
      error: '获取数据失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/file/read
 * 读取任意文件内容
 * Query params: path (文件完整路径)
 */
app.get('/api/file/read', (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({
        error: '缺少 path 参数',
      });
    }
    
    // 安全限制：只能访问允许的基础路径
    const isAllowed = ALLOWED_BASE_PATHS.some(base => filePath.startsWith(base));
    if (!isAllowed) {
      return res.status(403).json({
        error: '禁止访问此路径',
        path: filePath,
        allowedBasePaths: ALLOWED_BASE_PATHS,
      });
    }
    
    console.log(`[API] 读取文件：${filePath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: '文件不存在',
        path: filePath,
      });
    }
    
    // 检查是否是目录
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return res.status(400).json({
        error: '这是一个目录，不是文件',
        path: filePath,
      });
    }
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    
    res.json({
      success: true,
      file: path.basename(filePath),
      content: content,
      path: filePath,
      size: stat.size,
      type: getFileType(path.extname(filePath)),
    });
  } catch (error) {
    console.error('[API] 读取文件失败:', error.message);
    res.status(500).json({ 
      error: '读取失败',
      details: error.message,
    });
  }
});

/**
 * PUT /api/file/save
 * 保存文件内容
 * Body: { path, content }
 */
app.put('/api/file/save', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({
        error: '缺少 path 或 content 参数',
      });
    }
    
    // 安全限制：只能写入允许的基础路径
    const isAllowed = ALLOWED_BASE_PATHS.some(base => filePath.startsWith(base));
    if (!isAllowed) {
      return res.status(403).json({
        error: '禁止写入此路径',
        path: filePath,
        allowedBasePaths: ALLOWED_BASE_PATHS,
      });
    }
    
    console.log(`[API] 保存文件：${filePath} (${content.length} bytes)`);
    
    // 写入文件
    fs.writeFileSync(filePath, content, 'utf-8');
    
    res.json({
      success: true,
      message: '文件已保存',
      path: filePath,
      size: content.length,
    });
  } catch (error) {
    console.error('[API] 保存文件失败:', error.message);
    res.status(500).json({ 
      error: '保存失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/logs/list
 * 获取可用的日志文件列表
 */
app.get('/api/logs/list', (req, res) => {
  try {
    const logsPath = LOG_PATH;
    const logs = [];
    
    // 扫描 logs 目录
    if (fs.existsSync(logsPath)) {
      const files = fs.readdirSync(logsPath)
        .filter(f => f.endsWith('.log'))
        .map(f => {
          const stat = fs.statSync(path.join(logsPath, f));
          const logEntry = {
            name: f,
            path: path.join(logsPath, f),
            size: stat.size,
            modified: stat.mtime,
          };
          
          // 为 server.log 添加标签
          if (f === 'server.log') {
            logEntry.label = '后端服务日志';
          }
          
          return logEntry;
        });
      logs.push(...files);
    }
    
    res.json({ logs });
  } catch (error) {
    console.error('[API] 获取日志列表失败:', error.message);
    res.status(500).json({ 
      error: '获取日志列表失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/logs/read
 * 读取日志文件内容（支持分页和过滤）
 * Query: { file, lines = 100, filter = '' }
 */
app.get('/api/logs/read', (req, res) => {
  try {
    const { file, lines = 100, filter = '' } = req.query;
    
    if (!file) {
      return res.status(400).json({
        error: '缺少 file 参数',
      });
    }
    
    // 安全限制：只能读取 logs 目录下的文件
    const logsPath = LOG_PATH;
    const filePath = path.join(logsPath, file);
    
    if (!filePath.startsWith(logsPath)) {
      return res.status(403).json({
        error: '禁止访问此路径',
        path: filePath,
      });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: '日志文件不存在',
        path: filePath,
      });
    }
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n');
    
    // 过滤（如果有关键词）
    let filteredLines = allLines;
    if (filter) {
      filteredLines = allLines.filter(line => 
        line.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    // 取最后 N 行
    const recentLines = filteredLines.slice(-parseInt(lines));
    
    res.json({
      success: true,
      file: file,
      lines: recentLines,
      total: filteredLines.length,
      hasMore: filteredLines.length > parseInt(lines),
    });
  } catch (error) {
    console.error('[API] 读取日志失败:', error.message);
    res.status(500).json({ 
      error: '读取日志失败',
      details: error.message,
    });
  }
});

/**
 * GET /api/gateway-logs
 * 获取 OpenClaw Gateway 日志（通过 openclaw logs --follow）
 */
let gatewayLogsCache = {
  lines: [],
  timestamp: 0,
};
const GATEWAY_LOGS_CACHE_TTL = 3000; // 3 秒缓存

app.get('/api/gateway-logs', async (req, res) => {
  try {
    const { lines = 100 } = req.query;
    const now = Date.now();
    
    // 检查缓存（避免频繁调用 CLI）
    if (gatewayLogsCache.lines.length > 0 && (now - gatewayLogsCache.timestamp) < GATEWAY_LOGS_CACHE_TTL) {
      return res.json({
        success: true,
        source: 'gateway-cache',
        lines: gatewayLogsCache.lines,
        total: gatewayLogsCache.lines.length,
      });
    }
    
    // 调用 openclaw logs --follow (使用 timeout 命令限制执行时间)
    const limit = parseInt(lines) || 100;
    const command = `timeout 3 ${OPENCLAW.cliPath} logs --follow --limit ${limit} --plain 2>&1 || true`;
    
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 5000,
      maxBuffer: 1024 * 1024, // 1MB
      env: { 
        ...process.env, 
        PATH: `${path.dirname(OPENCLAW.nodePath)}:${process.env.PATH}`,
      },
    });
    
    // 按行分割
    const logLines = output.split('\n').filter(line => line.trim());
    
    // 更新缓存
    gatewayLogsCache.lines = logLines;
    gatewayLogsCache.timestamp = now;
    
    res.json({
      success: true,
      source: 'gateway',
      lines: logLines,
      total: logLines.length,
    });
  } catch (error) {
    console.error('[API] 获取 Gateway 日志失败:', error.message);
    res.json({
      success: true,
      source: 'gateway',
      lines: [`⚠️ 获取 Gateway 日志超时，使用缓存数据 (${gatewayLogsCache.lines.length} 行)`],
      total: gatewayLogsCache.lines.length || 1,
      cached: true,
    });
  }
});

/**
 * WebSocket 支持（Socket.io）
 * 实时日志推送
 */
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// 存储活跃的日志进程
const logProcesses = new Map();
// 存储会话历史监听器
const sessionWatchers = new Map();

io.on('connection', (socket) => {
  console.log('[WS] 客户端连接:', socket.id);
  
  // ========== Gateway 日志 ==========
  socket.on('subscribe:gateway-logs', () => {
    console.log('[WS] 客户端订阅 Gateway 日志:', socket.id);
    
    // 如果已有进程，直接发送缓存
    if (gatewayLogsCache.lines.length > 0) {
      socket.emit('log:new', {
        source: 'gateway',
        lines: gatewayLogsCache.lines,
        timestamp: Date.now(),
        isInitial: true,
      });
    }
    
    // 启动子进程流式读取日志
    const logProcess = spawn(OPENCLAW.cliPath, ['logs', '--follow', '--plain', '--limit', '100'], {
      env: { 
        ...process.env, 
        PATH: `${path.dirname(OPENCLAW.nodePath)}:${process.env.PATH}`,
      },
    });
    
    logProcesses.set(socket.id, logProcess);
    
    logProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        socket.emit('log:new', {
          source: 'gateway',
          lines,
          timestamp: Date.now(),
          isInitial: false,
        });
        
        // 更新缓存
        gatewayLogsCache.lines = [...gatewayLogsCache.lines, ...lines].slice(-500);
        gatewayLogsCache.timestamp = Date.now();
      }
    });
    
    logProcess.stderr.on('data', (data) => {
      console.error('[WS] 日志进程错误:', data.toString());
    });
    
    logProcess.on('error', (error) => {
      console.error('[WS] 日志进程异常:', error.message);
      socket.emit('log:error', { 
        source: 'gateway', 
        error: error.message 
      });
    });
    
    logProcess.on('close', (code) => {
      console.log('[WS] 日志进程退出:', code);
      logProcesses.delete(socket.id);
    });
  });
  
  // ========== 会话历史 WebSocket ==========
  socket.on('subscribe:session-history', async ({ sessionId }) => {
    console.log('[WS] 客户端订阅会话历史:', sessionId, socket.id);
    
    try {
      // 1. 先发送完整历史（复用现有 API 逻辑）
      const sessionsIndexPath = path.join(OPENCLAW.agentsPath, 'main/sessions/sessions.json');
      const sessionsIndex = JSON.parse(fs.readFileSync(sessionsIndexPath, 'utf-8'));
      
      // 查找 session（支持 sessionKey 和 UUID）
      let sessionInfo = sessionsIndex[sessionId];
      let sessionKey = sessionId;
      
      if (!sessionInfo) {
        for (const [key, info] of Object.entries(sessionsIndex)) {
          if (info.sessionId === sessionId) {
            sessionInfo = info;
            sessionKey = key;
            break;
          }
        }
      }
      
      if (!sessionInfo || !sessionInfo.sessionId) {
        socket.emit('session-history:error', { 
          error: '会话不存在',
          sessionId,
        });
        return;
      }
      
      // 2. 读取 JSONL 文件，发送初始历史
      const jsonlPath = `/root/.openclaw/agents/main/sessions/${sessionInfo.sessionId}.jsonl`;
      const content = fs.readFileSync(jsonlPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // 解析最后 100 条消息和工具调用
      const initialMessages = [];
      const initialToolCalls = [];
      const startIndex = Math.max(0, lines.length - 100);
      
      for (let i = startIndex; i < lines.length; i++) {
        try {
          const record = JSON.parse(lines[i]);
          
          // 消息
          if (record.type === 'message' && record.message) {
            const message = {
              role: record.message.role,
              content: record.message.content,
              timestamp: new Date(record.timestamp).getTime(),
            };
            initialMessages.push(message);
            
            // 工具调用（从 content 数组中解析 type='toolCall' 的项）
            if (Array.isArray(record.message.content)) {
              record.message.content.forEach((item) => {
                if (item.type === 'toolCall') {
                  initialToolCalls.push({
                    name: item.name || item.tool,
                    args: item.args || item.input,
                    result: null,
                    timestamp: new Date(record.timestamp).getTime(),
                    status: 'success',
                  });
                }
              });
            }
          }
          
          // 工具结果（role='toolResult'）
          if (record.type === 'message' && record.message.role === 'toolResult') {
            initialMessages.push({
              role: 'tool',
              content: record.message.content,
              timestamp: new Date(record.timestamp).getTime(),
            });
          }
        } catch (e) {
          // 跳过解析失败的行
        }
      }
      
      socket.emit('session-history:initial', {
        sessionId: sessionKey,
        actualSessionId: sessionInfo.sessionId,
        messages: initialMessages,
        toolCalls: initialToolCalls,
        total: lines.length,
      });
      
      // 3. 使用 fs.watch 监控文件变化
      const watcher = fs.watch(jsonlPath, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          // 文件变化，读取新增的行
          setTimeout(() => {
            try {
              const newContent = fs.readFileSync(jsonlPath, 'utf-8');
              const newLines = newContent.split('\n').filter(line => line.trim());
              
              // 只发送新增的行
              if (newLines.length > lines.length) {
                const newMessages = [];
                const newToolCalls = [];
                for (let i = lines.length; i < newLines.length; i++) {
                  try {
                    const record = JSON.parse(newLines[i]);
                    
                    // 消息
                    if (record.type === 'message' && record.message) {
                      const message = {
                        role: record.message.role,
                        content: record.message.content,
                        timestamp: new Date(record.timestamp).getTime(),
                      };
                      newMessages.push(message);
                      
                      // 工具调用（从 content 数组中解析）
                      if (Array.isArray(record.message.content)) {
                        record.message.content.forEach((item) => {
                          if (item.type === 'toolCall') {
                            newToolCalls.push({
                              name: item.name || item.tool,
                              args: item.args || item.input,
                              result: null,
                              timestamp: new Date(record.timestamp).getTime(),
                              status: 'success',
                            });
                          }
                        });
                      }
                    }
                    
                    // 工具结果
                    if (record.type === 'message' && record.message.role === 'toolResult') {
                      newMessages.push({
                        role: 'tool',
                        content: record.message.content,
                        timestamp: new Date(record.timestamp).getTime(),
                      });
                    }
                  } catch (e) {
                    // 跳过解析失败的行
                  }
                }
                
                if (newMessages.length > 0 || newToolCalls.length > 0) {
                  socket.emit('session-history:new', {
                    messages: newMessages,
                    toolCalls: newToolCalls,
                    timestamp: Date.now(),
                  });
                }
              }
            } catch (error) {
              console.error('[WS] 读取会话文件失败:', error.message);
            }
          }, 100); // 延迟 100ms，确保文件写入完成
        }
      });
      
      // 存储 watcher
      sessionWatchers.set(socket.id, { sessionId: sessionKey, watcher, jsonlPath });
      
    } catch (error) {
      console.error('[WS] 订阅会话历史失败:', error.message);
      socket.emit('session-history:error', {
        error: error.message,
      });
    }
  });
  
  // 取消订阅会话历史
  socket.on('unsubscribe:session-history', () => {
    const watcher = sessionWatchers.get(socket.id);
    if (watcher) {
      watcher.watcher.close();
      sessionWatchers.delete(socket.id);
      console.log('[WS] 客户端取消订阅会话历史:', watcher.sessionId);
    }
  });
  
  // 取消订阅 Gateway 日志
  socket.on('unsubscribe:logs', () => {
    const process = logProcesses.get(socket.id);
    if (process) {
      process.kill();
      logProcesses.delete(socket.id);
      console.log('[WS] 客户端取消订阅:', socket.id);
    }
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('[WS] 客户端断开:', socket.id);
    // 清理 Gateway 日志进程
    const process = logProcesses.get(socket.id);
    if (process) {
      process.kill();
      logProcesses.delete(socket.id);
    }
    // 清理会话历史监听器
    const watcher = sessionWatchers.get(socket.id);
    if (watcher) {
      watcher.watcher.close();
      sessionWatchers.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Agent 监控平台 API 服务已启动`);
  console.log(`📡 监听端口：http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket 已启用 (Socket.io)`);
  console.log(`📊 可用端点:`);
  console.log(`   GET /api/subagents/list - 获取子 Agent 列表`);
  console.log(`   GET /api/sessions/list  - 获取会话列表`);
  console.log(`   GET /api/stats          - 获取统计数据`);
  console.log(`   GET /api/health         - 健康检查`);
  console.log(`   WS /                    - WebSocket 实时日志`);
  console.log(`💡 当前使用 **真实数据** (OpenClaw CLI)`);
  console.log(`🌐 可从外部访问（需要防火墙开放端口）`);
});
