# 日志功能完善 - 2026-03-07 19:28

## 📋 更新内容

### 1. 新增 API 端点

#### `GET /api/sessions/:id/history`
获取会话历史（包含消息和工具调用）

**响应示例：**
```json
{
  "session": {
    "id": "agent:main:subagent:xxx",
    "status": "completed",
    "updatedAt": 1772882437013,
    "spawnDepth": 1
  },
  "history": [],
  "toolCalls": [],
  "stats": {
    "totalMessages": 0,
    "totalToolCalls": 0
  }
}
```

**说明：**
- 优先从 `/root/.openclaw/agents/main/sessions/{sessionId}.json` 读取真实历史
- 如果历史文件不存在，前端会生成模拟日志
- 支持解析工具调用（toolCalls）

---

### 2. 日志详情组件升级

#### 文件：`src/components/LogDetailModal.tsx`

**新增功能：**

| 功能 | 说明 | 状态 |
|------|------|------|
| **三 Tab 切换** | 日志 / 工具调用 / 消息 | ✅ |
| **真实数据加载** | 从 API 获取会话历史 | ✅ |
| **模拟数据回退** | API 无数据时生成模拟日志 | ✅ |
| **工具调用展示** | 显示参数和结果 | ✅ |
| **消息对话展示** | 用户消息 vs Agent 响应 | ✅ |
| **加载状态** | 加载时显示动画 | ✅ |
| **数据源标识** | 显示真实/模拟数据 | ✅ |

**Tab 1: 📜 日志**
- 显示系统日志（启动、任务执行、完成）
- 显示消息记录（用户/Agent 对话）
- 显示工具调用记录
- 时间戳 + 级别 + 图标

**Tab 2: 🔧 工具调用**
- 工具名称
- 调用参数（JSON 格式）
- 执行结果（JSON 格式）
- 成功/失败状态
- 时间戳

**Tab 3: 💬 消息**
- 用户消息（蓝色，右侧对齐）
- Agent 响应（绿色，左侧对齐）
- 时间戳
- 完整内容

---

### 3. 日志类型和图标

| 类型 | 图标 | 说明 |
|------|------|------|
| `system` | ⚙️ | 系统日志（启动、完成等） |
| `message` | 💬 | 消息对话（用户/Agent） |
| `tool` | 🔧 | 工具调用 |

---

### 4. 日志级别

| 级别 | 颜色 | 说明 |
|------|------|------|
| `INFO` | 🟢 绿色 | 正常信息 |
| `DEBUG` | 🔵 蓝色 | 调试信息 |
| `WARN` | 🟡 黄色 | 警告信息 |
| `ERROR` | 🔴 红色 | 错误信息 |

---

## 🎨 UI 改进

### 之前
- 单一日志列表
- 模拟数据
- 无分类

### 现在
- Tab 切换（日志/工具/消息）
- 真实数据 + 模拟回退
- 分类展示
- 加载动画
- 数据源标识

---

## 📊 数据流程

```
用户点击"查看日志"
    ↓
LogDetailModal 加载
    ↓
调用 API: /api/sessions/:id/history
    ↓
┌─────────────────────┐
│  有真实数据？        │
└─────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    ↓         ↓
解析历史   生成模拟日志
    │         │
    └────┬────┘
         │
         ↓
    显示日志
```

---

## 🔧 技术实现

### 真实数据解析
```javascript
// 从 sessions 文件读取
const sessionsFile = '/root/.openclaw/agents/main/sessions/sessions.json';
const session = sessionsData[sessionId];

// 从历史文件读取
const historyFile = `/root/.openclaw/agents/main/sessions/${sessionId}.json`;
const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
```

### 模拟日志生成
```javascript
function generateMockLogs(): LogEntry[] {
  const baseTime = Date.now() - (agent.runtime || 0);
  return [
    { timestamp: baseTime, level: 'INFO', message: '✅ Agent 启动成功' },
    { timestamp: baseTime + 1000, level: 'INFO', message: '📋 开始执行任务' },
    { timestamp: baseTime + 2000, level: 'DEBUG', message: '🧠 加载模型' },
    // ...
  ];
}
```

---

## 🧪 测试建议

### 1. 查看成功任务的日志
- 打开 Dashboard
- 点击任意已完成 Agent 的"📋 查看"按钮
- 检查日志 Tab、工具 Tab、消息 Tab

### 2. 查看失败任务的日志
- 点击失败 Agent（如子 Agent 链路中的 failed 记录）
- 检查是否显示错误日志

### 3. 查看运行中任务的日志
- 点击运行中 Agent
- 检查是否显示"继续执行中..."

---

## 📈 后续优化

### P1 - 短期
- [ ] 实时日志流（WebSocket）
- [ ] 日志搜索和过滤
- [ ] 日志导出功能

### P2 - 中期
- [ ] 工具调用性能分析（耗时、成功率）
- [ ] 消息对话树状展示
- [ ] 日志统计图表

### P3 - 长期
- [ ] 日志持久化（PostgreSQL）
- [ ] 日志检索（Elasticsearch）
- [ ] 日志告警（异常检测）

---

## 📝 注意事项

1. **历史文件可能不存在**
   - OpenClaw 默认可能不保存详细会话历史
   - 组件会自动回退到模拟日志
   - 不影响功能使用

2. **工具调用解析**
   - 依赖 `msg.toolCalls` 字段
   - 如果格式不同，需要调整解析逻辑

3. **性能考虑**
   - 大量日志时使用虚拟滚动
   - 限制单次加载数量（100 条）

---

**更新完成。** 刷新页面查看新的日志详情功能！
