# Agent 监控可视化平台

基于 TypeScript + React + Tailwind CSS 的 OpenClaw Agent 运行监控平台。

## 🚀 快速开始

### 启动服务

```bash
cd /root/.openclaw/monitor-platform

# 启动后端 API 服务
node server.js &

# 启动前端开发服务器
npm run dev
```

### 访问地址

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:3001/api/health

### 远程访问（从本地电脑）

```bash
# SSH 端口转发
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@your-server

# 访问 http://localhost:3000
```

---

## 📊 功能特性

### 1. 仪表盘（Dashboard）
- 📋 活跃/已完成 Agent 列表
- 📊 Token 消耗统计
- ⏱️ 执行耗时分析
- 🤖 模型使用分布
- 🔄 实时刷新（30 秒）

### 2. 执行链路（Trace）
- 📊 执行流程时间线
- 🔗 子 Agent 链路追踪
- 📱 渠道维度分析（飞书/企微/Control-UI）
- 🤝 Agent 协作统计
- 🔄 自动刷新（30 秒）

### 3. 性能分析（Analytics）
- 📈 Token 使用趋势
- ⏱️ 耗时分布分析
- 📊 渠道统计
- 🏆 Agent 排名

### 4. 配置管理（Configs）
- 📝 查看/编辑 Agent 配置文件
- 📊 支持 .md 和 .json 格式
- 💾 实时保存

### 5. 日志详情（Log Detail）
- 📜 真实历史消息（从 JSONL 文件读取）
- 🔧 工具调用记录
- 💬 对话消息展示
- ⏸️ 暂停/继续自动刷新（3 秒轮询）

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **样式** | Tailwind CSS |
| **构建工具** | Vite |
| **状态管理** | Zustand |
| **图表** | ECharts |
| **流程图** | React Flow |
| **后端** | Node.js + Express |
| **数据源** | OpenClaw CLI + JSONL 文件 |

---

## 📁 项目结构

```
monitor-platform/
├── src/
│   ├── components/         # 可复用组件
│   │   ├── LogDetailModal.tsx    # 日志详情弹窗
│   │   └── ...
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.tsx   # 仪表盘
│   │   ├── Trace.tsx       # 执行链路
│   │   ├── Analytics.tsx   # 性能分析
│   │   └── Configs.tsx     # 配置管理
│   ├── services/           # API 服务
│   │   └── api.ts          # Axios 实例
│   ├── store/              # 状态管理
│   ├── types/              # TypeScript 类型
│   ├── utils/              # 工具函数
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── server.js               # 后端 API 服务
├── logs/                   # 日志目录
│   └── server.log
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## 🔌 API 端点

### 基础 API

| 端点 | 说明 | 数据源 |
|------|------|--------|
| `GET /api/health` | 健康检查 | - |
| `GET /api/subagents/list` | 子 Agent 列表 | OpenClaw CLI |
| `GET /api/sessions/list` | 会话列表 | OpenClaw CLI |
| `GET /api/stats` | 统计数据 | 计算得出 |

### 链路追踪 API

| 端点 | 说明 | 数据源 |
|------|------|--------|
| `GET /api/trace/flow` | 执行流程 | 解析 session key |
| `GET /api/trace/subagents` | 子 Agent 链路 | 解析日志 |
| `GET /api/analytics/channels` | 渠道分析 | 按渠道分组 |

### 会话历史 API

| 端点 | 说明 | 数据源 |
|------|------|--------|
| `GET /api/sessions/:sessionId/history` | 会话历史 | JSONL 文件 |

**响应示例：**
```json
{
  "sessionId": "agent:main:main",
  "actualSessionId": "c9be6b89-67c5-44da-9079-dbe0254ca065",
  "source": "jsonl",
  "history": [
    {
      "role": "user",
      "content": "早上好",
      "timestamp": 1772924066396,
      "toolCalls": null
    },
    {
      "role": "assistant",
      "content": "早上好，老大！",
      "timestamp": 1772924069542
    }
  ],
  "toolCalls": [
    {
      "name": "read",
      "timestamp": 1772924101481,
      "status": "success"
    }
  ]
}
```

---

## 🔧 配置管理

### 支持的配置文件

| 文件类型 | 说明 | 示例 |
|---------|------|------|
| `IDENTITY.md` | Agent 身份配置 | 名称、性格、emoji |
| `SOUL.md` | Agent 性格规则 | 核心铁律、行为准则 |
| `USER.md` | 用户偏好 | 称呼、时区、笔记 |
| `MEMORY.md` | 长期记忆 | 用户偏好、项目记录 |
| `models.json` | 模型配置 | 模型别名、提供商 |
| `openclaw.json` | 系统配置 | 渠道、插件、密钥 |

### 文件位置

```
/root/.openclaw/
├── workspace/
│   ├── IDENTITY.md
│   ├── SOUL.md
│   ├── USER.md
│   └── MEMORY.md
├── agents/
│   └── main/
│       └── agent/
│           ├── IDENTITY.md
│           └── ...
└── openclaw.json
```

---

## 📊 数据说明

### 会话类型（kind）

| 类型 | 说明 | 示例 |
|------|------|------|
| `direct` | 直接会话 | 一对一聊天 |
| `group` | 群组会话 | 飞书/企微群聊 |
| `cron` | 定时任务 | 每日新闻推送 |
| `subagent` | 子 Agent | 主 Agent 创建的子任务 |

### 渠道类型（channel）

| 渠道 | Emoji | 说明 |
|------|-------|------|
| `feishu` | 📝 | 飞书 |
| `wecom` | 💼 | 企业微信 |
| `control-ui` | 🖥️ | Control-UI |
| `cron` | ⏰ | 定时任务 |
| `subagent` | 🤖 | 子 Agent |

### 活跃状态判定

- **活跃**：最近 5 分钟内有更新
- **已完成**：超过 5 分钟未更新

---

## 🎨 UI 组件

### LogDetailModal（日志详情）

**功能：**
- 三 Tab 切换：日志 / 工具调用 / 消息
- 自动刷新（3 秒轮询）
- 暂停/继续控制
- 真实数据展示（从 JSONL 文件读取）

**数据格式：**
```typescript
interface LogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  type?: 'message' | 'tool' | 'system';
}

interface ToolCall {
  name: string;
  args?: any;
  timestamp: number;
  status?: 'success' | 'error';
}
```

---

## 🔐 安全注意事项

1. **敏感信息脱敏**
   - API Keys → `[API_KEY_REDACTED]`
   - Tokens → `[TOKEN_REDACTED]`
   - IP 地址 → `[IP_REDACTED]`
   - 用户 ID → `[USER_ID_REDACTED]`

2. **配置文件保护**
   - `openclaw.json` 需脱敏后展示
   - 禁止直接暴露密钥和令牌

3. **访问控制**
   - 建议通过 SSH 隧道访问
   - 生产环境需配置防火墙

---

## 🛠️ 开发指南

### 添加新页面

1. 在 `src/pages/` 创建新组件
2. 在 `App.tsx` 添加路由
3. 在侧边栏添加导航链接

### 添加新 API

1. 在 `server.js` 添加路由
2. 在 `src/services/api.ts` 添加类型定义
3. 测试 API 响应

### 调试技巧

```bash
# 查看后端日志
tail -f logs/server.log

# 检查 API 响应
curl http://localhost:3001/api/health

# 前端开发模式（带热重载）
npm run dev
```

---

## 📝 更新日志

### 2026-03-08
- ✅ 修复日志查看功能：使用 JSONL 文件读取真实历史数据
- ✅ 移除 WebSocket 依赖，改用轮询（3 秒）
- ✅ 支持暂停/继续自动刷新
- ✅ 删除过时的文档和备份文件

### 2026-03-07
- ✅ 添加执行链路追踪（Trace）
- ✅ 添加渠道维度分析
- ✅ 添加配置管理页面
- ✅ 优化并行异步加载

---

## 📞 故障排查

### API 无法连接

```bash
# 检查后端服务
ps aux | grep "node server.js"

# 检查端口监听
lsof -i:3001

# 测试 API
curl http://localhost:3001/api/health
```

### 前端无法访问

```bash
# 检查前端服务
ps aux | grep vite

# 检查端口监听
lsof -i:3000

# 重启开发服务器
npm run dev
```

### 数据不更新

- 等待自动刷新（30 秒）
- 点击刷新按钮手动刷新
- 检查后端日志是否有错误

---

## 📄 License

MIT
