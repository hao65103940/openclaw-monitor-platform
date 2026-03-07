# 监控平台差距分析

## 📊 当前能监控的

### ✅ 已实现

| 维度 | 监控内容 | 数据来源 |
|------|----------|----------|
| **会话列表** | 所有会话的 ID、Agent、渠道、时间 | `openclaw sessions --json` |
| **Token 统计** | 每个会话的 Token 消耗 | 会话数据 |
| **耗时统计** | 每个会话的执行时长 | 会话 ageMs |
| **渠道分析** | 飞书/企微/Control-UI/Cron 的分布 | 解析 session key |
| **Agent 统计** | 各 Agent 的会话数和 Token | 按 agentId 分组 |
| **活跃状态** | 当前活跃的会话 | isActive 标记 |
| **模型信息** | 使用的模型名称 | session.model |

---

## ❌ 当前无法监控的（盲点）

### 1. **子 Agent 链路追踪** ⚠️ 最重要

**问题**：
- 无法看到主 Agent 何时创建了子 Agent
- 无法看到子 Agent 的任务是什么
- 无法看到父子 Agent 的调用关系
- 无法看到子 Agent 的执行结果

**现状**：
```
当前数据：
{
  "agentId": "main",
  "kind": "direct",  // 看不出是否创建了子 Agent
  "tokens": 85472
}

期望数据：
{
  "agentId": "main",
  "kind": "direct",
  "subagents": [
    {
      "agentId": "requirement-agent",
      "task": "分析需求",
      "status": "completed",
      "tokens": 15449,
      "runtime": 60000
    },
    {
      "agentId": "design-agent",
      "task": "系统设计",
      "status": "completed",
      "tokens": 15527,
      "runtime": 65000
    }
  ]
}
```

**影响**：
- ❌ 看不到多 Agent 协作的完整链路
- ❌ 看不到任务如何分解
- ❌ 看不到哪个子 Agent 耗时最长

---

### 2. **实时执行状态** ⚠️

**问题**：
- 只能看到"已完成"的会话
- 无法看到"正在思考中"的实时状态
- 无法看到当前执行到哪一步

**现状**：
```
当前状态：running | completed | failed

期望状态：
- waiting（等待中）
- thinking（思考中）
- executing（执行工具中）
- waiting_user（等待用户回复）
- completed（已完成）
- failed（失败）
```

**影响**：
- ❌ 用户发送消息后，看不到"Agent 正在思考"
- ❌ 看不到 Agent 正在调用哪个工具
- ❌ 只能等完成后才能看到结果

---

### 3. **消息内容追踪** ⚠️

**问题**：
- 看不到用户发送的原始消息
- 看不到 Agent 回复的内容
- 看不到中间思考过程

**现状**：
```
当前数据：
{
  "key": "agent:main:main",
  "tokens": 85472
  // 没有消息内容
}

期望数据：
{
  "key": "agent:main:main",
  "messages": [
    {
      "role": "user",
      "content": "帮我分析监控平台",
      "timestamp": 1772880900000
    },
    {
      "role": "assistant",
      "content": "好的，让我分析一下...",
      "timestamp": 1772880918000
    }
  ]
}
```

**影响**：
- ❌ 不知道用户问了什么
- ❌ 不知道 Agent 回答了什么
- ❌ 无法追溯对话历史

---

### 4. **工具调用追踪** ⚠️

**问题**：
- 看不到 Agent 调用了哪些工具
- 看不到工具调用的参数和结果
- 看不到工具执行耗时

**现状**：
```
期望数据：
{
  "agentId": "main",
  "toolCalls": [
    {
      "tool": "feishu_doc",
      "action": "read",
      "params": {"doc_token": "xxx"},
      "result": "success",
      "runtime": 1200
    },
    {
      "tool": "web_search",
      "action": "search",
      "params": {"query": "xxx"},
      "result": "success",
      "runtime": 800
    }
  ]
}
```

**影响**：
- ❌ 不知道 Agent 用了什么技能
- ❌ 不知道工具调用是否成功
- ❌ 无法定位工具调用失败的原因

---

### 5. **错误和异常监控** ❌

**问题**：
- 看不到 Agent 执行过程中的错误
- 看不到重试次数
- 看不到失败原因

**现状**：
```
当前状态：只有 completed 和 failed

期望数据：
{
  "status": "failed",
  "error": {
    "type": "APIError",
    "message": "Token 不足",
    "retryCount": 3,
    "lastRetry": 1772880900000
  }
}
```

**影响**：
- ❌ 不知道 Agent 为什么失败
- ❌ 无法及时发现问题

---

### 6. **性能瓶颈分析** ❌

**问题**：
- 看不到哪个环节最耗时
- 看不到 LLM 响应时间 vs 工具调用时间
- 看不到队列等待时间

**期望**：
```
{
  "totalTime": 18309,
  "breakdown": {
    "llmThinking": 12000,
    "toolCalls": 5000,
    "queueWait": 1000,
    "responseRender": 309
  }
}
```

---

## 🎯 优先级排序

| 优先级 | 功能 | 实现难度 | 价值 |
|--------|------|----------|------|
| **P0** | 子 Agent 链路追踪 | 中 | ⭐⭐⭐⭐⭐ |
| **P0** | 实时执行状态 | 高 | ⭐⭐⭐⭐⭐ |
| **P1** | 消息内容追踪 | 中 | ⭐⭐⭐⭐ |
| **P1** | 工具调用追踪 | 中 | ⭐⭐⭐⭐ |
| **P2** | 错误和异常监控 | 低 | ⭐⭐⭐ |
| **P2** | 性能瓶颈分析 | 高 | ⭐⭐⭐ |

---

## 🔧 解决方案建议

### 方案 1：增强会话数据（推荐）

**思路**：在会话结束时，记录完整的执行链路

**实现**：
1. 修改 Agent 执行逻辑，记录子 Agent 创建事件
2. 在会话数据中添加 `subagents`、`toolCalls`、`messages` 字段
3. 监控平台读取这些字段展示

**优点**：
- ✅ 数据完整
- ✅ 可以回溯历史
- ✅ 不依赖实时连接

**缺点**：
- ❌ 需要修改 OpenClaw 核心逻辑
- ❌ 无法看到实时状态

---

### 方案 2：日志实时采集

**思路**：实时读取 OpenClaw 日志，解析执行事件

**实现**：
1. 监控 `/tmp/openclaw/openclaw-*.log` 文件
2. 解析日志中的关键事件（创建子 Agent、调用工具等）
3. 通过 WebSocket 推送到前端

**优点**：
- ✅ 真正的实时监控
- ✅ 不需要修改 OpenClaw
- ✅ 可以看到"正在执行"的状态

**缺点**：
- ❌ 依赖日志格式稳定
- ❌ 日志轮转后无法回溯
- ❌ 解析复杂

---

### 方案 3：混合方案（最佳）

**思路**：会话数据 + 实时日志结合

**实现**：
1. 基础数据从 `openclaw sessions --json` 获取
2. 实时状态从日志中解析
3. 子 Agent 链路从会话历史中追踪

**优点**：
- ✅ 既有实时性，又有完整性
- ✅ 不依赖单一数据源
- ✅ 容错性强

---

## 📝 下一步行动

### 立即可做（无需修改 OpenClaw）

1. **日志解析** - 读取 `/tmp/openclaw/openclaw-*.log` 提取实时状态
2. **会话历史分析** - 通过 `openclaw sessions history` 追踪子 Agent
3. **WebSocket 推送** - 实现实时状态推送

### 需要 OpenClaw 支持

1. **增强会话数据** - 添加子 Agent、工具调用等字段
2. **执行事件钩子** - 在关键节点触发事件
3. **性能指标导出** - 导出 LLM 响应时间等指标

---

**更新时间**：2026-03-07 18:55
