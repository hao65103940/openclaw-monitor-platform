# Agent 监控可视化平台

基于 TypeScript + React + Tailwind CSS 的 OpenClaw Agent 运行监控平台。

## 功能特性

- 📊 **实时监控仪表盘** - 查看活跃/已完成 Agent 列表、Token 消耗、模型使用
- 🔗 **执行链路可视化** - 展示 Agent 会话执行流程、时间线、协作统计
- 📈 **性能分析** - Token 使用统计、耗时分析、模型分布、Agent 排名
- ⚙️ **配置管理** - 查看和编辑 Agent 配置文件（IDENTITY.md, models.json 等）

## 技术栈

- **前端框架**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **构建工具**: Vite
- **状态管理**: Zustand
- **图表**: ECharts
- **流程图**: React Flow
- **实时通信**: Socket.IO

## 快速开始

### 🧪 模式 1：模拟数据（默认）

```bash
cd /root/.openclaw/monitor-platform
npm run dev
```

访问 http://localhost:3000

### 🔌 模式 2：真实数据

**使用启动脚本（推荐）：**

```bash
# 启动服务（前端 + 后端）
./start.sh

# 停止服务
./stop.sh

# 查看日志
tail -f logs/server.log
```

**手动启动：**

```bash
# 启动后端 API 服务
node server.js &

# 启动前端
npm run dev
```

**在本地电脑访问（通过 SSH 转发）：**

```bash
# 1. SSH 端口转发
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@your-server

# 2. 访问 http://localhost:3000
```

### 3. 构建生产版本

```bash
npm run build
```

## 项目结构

```
monitor-platform/
├── src/
│   ├── components/     # 可复用组件
│   ├── pages/          # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── Trace.tsx
│   │   ├── Analytics.tsx
│   │   └── Configs.tsx
│   ├── services/       # API 服务
│   ├── store/          # 状态管理
│   ├── types/          # TypeScript 类型
│   ├── utils/          # 工具函数
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

## API 集成

平台通过以下方式与 OpenClaw 集成：

1. **REST API** - 获取 Agent 列表、会话数据、统计信息
2. **WebSocket** - 实时推送 Agent 状态变更
3. **文件系统** - 读取 Agent 配置文件

## 开发中功能

- [ ] WebSocket 实时推送
- [ ] React Flow 链路可视化
- [ ] ECharts 图表集成
- [ ] Agent 配置查看器
- [ ] 历史记录追溯

## License

MIT
