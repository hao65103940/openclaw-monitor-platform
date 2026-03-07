# Agent 监控平台 - 真实数据模式使用指南

## 🎯 两种数据模式

### 模式 1：模拟数据（默认）
- ✅ 无需配置，开箱即用
- ✅ 稳定可靠，无网络依赖
- ✅ 适合演示 UI 效果
- ❌ 数据不是真实的

### 模式 2：真实数据
- ✅ 显示真实的 OpenClaw Agent 运行数据
- ✅ 实时反映 Agent 状态
- ✅ 适合日常监控使用
- ⚠️ 需要配置网络访问

---

## 🚀 使用真实数据模式

### 场景 1：在服务器本地浏览器访问

如果你直接在服务器上打开浏览器：

1. **启动 API 服务**
   ```bash
   cd /root/.openclaw/monitor-platform
   ./start-real.sh
   ```

2. **修改环境变量**
   ```bash
   # 编辑 .env 文件
   VITE_USE_MOCK_DATA=false
   ```

3. **重启前端服务**
   ```bash
   # 停止当前服务（Ctrl+C）
   npm run dev
   ```

4. **访问页面**
   ```
   http://localhost:3000
   ```

---

### 场景 2：在本地电脑浏览器访问（推荐）

如果你在本地电脑（如 MacBook）上访问服务器：

#### 步骤 1：SSH 端口转发

在本地电脑终端执行：

```bash
# 转发 API 服务端口
ssh -L 3001:localhost:3001 user@your-server-ip

# 可选：转发前端服务端口
ssh -L 3000:localhost:3000 user@your-server-ip
```

保持 SSH 连接开启。

#### 步骤 2：启动服务器 API 服务

在服务器上执行：

```bash
cd /root/.openclaw/monitor-platform
node server-real.js &
```

#### 步骤 3：配置环境变量

在服务器上编辑 `.env` 文件：

```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
```

#### 步骤 4：重启前端服务

```bash
npm run dev
```

#### 步骤 5：在本地浏览器访问

```
http://localhost:3000
```

---

## 📊 API 端点说明

| 端点 | 说明 | 返回数据 |
|------|------|----------|
| `GET /api/health` | 健康检查 | API 服务状态 |
| `GET /api/agents/list` | Agent 列表 | 活跃 + 最近完成的 Agent |
| `GET /api/stats` | 统计数据 | Token、耗时、模型分布 |
| `GET /api/sessions/list` | 会话列表 | 完整会话历史 |

---

## 🔧 手动切换数据模式

在 Dashboard 页面点击右上角的切换按钮：

- 🧪 **模拟数据模式** → 切换到实时数据
- 🔌 **实时数据模式** → 切换回模拟数据

---

## ⚠️ 常见问题

### Q: 点击"切换到实时数据"后报错？

**原因**：API 服务未启动或网络不通

**解决**：
1. 确认 API 服务已启动：`curl http://localhost:3001/api/health`
2. 检查 SSH 端口转发是否开启
3. 切换回模拟数据模式

### Q: 数据不更新？

**原因**：数据每 30 秒自动刷新一次

**解决**：
- 等待自动刷新
- 或点击"切换数据源"按钮手动刷新

### Q: 如何查看完整的 Agent 任务内容？

**解决**：鼠标悬停在任务标题上，会显示完整内容（tooltip）

---

## 📝 配置文件说明

### `.env` - 环境变量

```bash
# API 服务地址
VITE_API_BASE_URL=http://localhost:3001/api

# 数据模式：true=模拟数据，false=真实数据
VITE_USE_MOCK_DATA=false
```

### `server-real.js` - 真实数据 API 服务

- 通过 OpenClaw CLI 获取真实数据
- 监听端口：3001
- 自动转换数据格式

### `start-real.sh` - 快速启动脚本

```bash
./start-real.sh
```

---

## 🎨 数据说明

### 活跃 Agent 判定标准

- **运行中**：最近 5 分钟内有更新
- **已完成**：超过 5 分钟未更新

### 统计数据说明

- **总 Token**：所有 Agent 累计消耗的 Token
- **平均耗时**：已完成 Agent 的平均运行时间
- **模型分布**：各模型的使用次数

---

## 💡 最佳实践

1. **日常使用**：保持 SSH 端口转发开启，使用真实数据模式
2. **演示展示**：使用模拟数据模式，避免网络问题
3. **开发调试**：本地启动 API 服务，方便调试

---

## 📞 技术支持

遇到问题？检查以下步骤：

1. ✅ API 服务是否运行：`ps aux | grep server-real`
2. ✅ 端口是否监听：`lsof -i:3001`
3. ✅ API 是否响应：`curl http://localhost:3001/api/health`
4. ✅ SSH 转发是否开启：`ssh -L 3001:localhost:3001 ...`

---

**祝你使用愉快！** 🎉
