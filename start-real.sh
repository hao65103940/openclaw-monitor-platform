#!/bin/bash

echo "🚀 启动 Agent 监控平台（真实数据模式）..."

# 进入项目目录
cd "$(dirname "$0")"

# 停止旧的服务
pkill -f "node server-real.js" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# 等待 1 秒
sleep 1

# 启动真实数据 API 服务
echo "📡 启动真实数据 API 服务..."
node server-real.js &
API_PID=$!

# 等待 2 秒让 API 服务启动
sleep 2

# 测试 API 是否可用
echo "🧪 测试 API 连接..."
curl -s http://localhost:3001/api/health | jq . 2>/dev/null || echo "⚠️  API 启动中..."

echo ""
echo "✅ 服务已启动！"
echo "🌐 前端地址：http://localhost:3000"
echo "🔌 API 地址：http://localhost:3001"
echo ""
echo "📋 如需在本地浏览器访问，请执行 SSH 端口转发："
echo "   ssh -L 3001:localhost:3001 user@your-server"
echo ""

# 等待进程结束
wait $API_PID
