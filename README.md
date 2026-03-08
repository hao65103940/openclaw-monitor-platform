# 👁️ ClawEye

> **ClawEye - AI Agent 监控平台**
> 
> *洞察一切 · 掌控全局*

---

## 🎯 项目简介

ClawEye 是专为 OpenClaw 打造的智能监控平台，提供全方位的 Agent 运行状态监控、性能分析和成本估算。

### 核心功能

- 📊 **实时监控** - WebSocket 实时推送，30 秒刷新会话状态
- 📈 **Token 分析** - 深度分析 Token 使用趋势、效率和成本
- 🤖 **会话追踪** - 完整会话生命周期追踪，支持子 Agent
- ⚠️ **告警通知** - 失败会话和 Token 超预算自动告警
- 💰 **成本估算** - 基于模型定价的成本分析和月度预测
- 📱 **渠道统计** - 飞书、企微等多渠道会话分析

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- OpenClaw >= 1.0.0

### 安装

```bash
# 进入项目目录
cd /root/.openclaw/claweye

# 安装依赖
npm install

# 启动服务
npm run start
```

### 访问

打开浏览器访问：`http://localhost:5173`

---

## 📦 功能模块

### 1. Dashboard（仪表盘）
- 实时会话状态
- Token 使用趋势图
- 会话筛选和搜索
- 告警通知中心

### 2. Analytics（性能分析）
- **Token 深度分析**
  - 时间序列趋势（7/30/90 天）
  - Token 效率分析（Top 10 会话）
  - 成本估算（月度预测）
  
- **会话行为分析**
  - 24 小时活跃分布
  - 会话类型分布（饼图）
  - 失败会话分析
  
- **模型与性能分析**
  - 模型使用统计
  - 性能瓶颈（P50/P90/P99）
  - 工具调用分析（预留）
  
- **渠道与子 Agent 分析**
  - 渠道详细分析
  - 子 Agent 统计排行

### 3. Logs（日志中心）
- 实时日志推送
- 历史日志查询
- 工具调用追踪

### 4. Trace（链路追踪）
- 会话关系图
- 子 Agent 链路

### 5. Configs（配置管理）
- 渠道配置
- 告警规则配置

---

## 🎨 设计特点

- **现代科技感** - 蓝紫主题配色，渐变背景
- **毛玻璃效果** - 卡片采用 backdrop-filter 模糊
- **流畅动画** - 悬停上浮、发光、闪烁效果
- **响应式设计** - 适配桌面和移动端

---

## 📊 API 端点

### 分析 API
```
GET /api/analytics/token-history      # Token 时间序列趋势
GET /api/analytics/token-efficiency   # Token 效率分析
GET /api/analytics/cost-estimate      # 成本估算
GET /api/analytics/session-lifecycle  # 会话生命周期
GET /api/analytics/session-types      # 会话类型分布
GET /api/analytics/failure-analysis   # 失败会话分析
GET /api/analytics/model-stats        - 模型使用统计
GET /api/analytics/performance-bottleneck # 性能瓶颈
GET /api/analytics/tool-usage         # 工具调用分析
GET /api/analytics/channel-detail     # 渠道详细分析
GET /api/analytics/subagent-stats     # 子 Agent 统计
```

### 其他 API
```
GET /api/sessions                     # 会话列表
GET /api/sessions/:id                 # 会话详情
GET /api/sessions/:id/history         # 会话历史
GET /api/analytics/channels           # 渠道统计
GET /api/trace/subagents              # 子 Agent 链路
```

---

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite
- **状态管理**：Zustand
- **图表**：ECharts + echarts-for-react
- **样式**：TailwindCSS + 自定义 CSS
- **实时通信**：Socket.IO
- **后端**：Express + Node.js

---

## 📝 开发

```bash
# 开发模式
npm run dev

# 仅启动后端
npm run server

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

---

## 🎯 命名含义

**ClawEye** = Claw（爪子）+ Eye（眼睛）

寓意：像一只敏锐的眼睛，时刻盯着 OpenClaw 的运行状态，洞察一切细节。

- **Claw** - 代表 OpenClaw
- **Eye** - 代表监控、洞察、视野

---

## 📄 License

MIT

---

## 🙏 致谢

- OpenClaw 团队
- 所有贡献者

---

**ClawEye - 洞察一切 · 掌控全局** 👁️
