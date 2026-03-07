#!/bin/bash

echo "🚀 启动 Agent 监控平台..."
echo ""

# 进入项目目录
cd "$(dirname "$0")"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 首次启动，安装依赖..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
  fi
fi

# 停止旧的服务
echo "🛑 检查并停止旧服务..."
pkill -f "node server.js" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 1

# 启动后端 API 服务（后台）
echo "📡 启动 API 服务（端口 3001）..."
nohup node server.js > /tmp/monitor-server.log 2>&1 &
SERVER_PID=$!
echo "✅ 后端服务 PID: $SERVER_PID"

# 等待后端启动
sleep 2

# 测试后端是否可用
echo "🧪 测试 API 连接..."
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo "✅ 后端服务正常"
else
  echo "⚠️  后端服务启动中，请查看日志：/tmp/monitor-server.log"
fi

echo ""
echo "=========================================="
echo "✅ 服务已启动！"
echo "=========================================="
echo "🌐 前端地址：http://localhost:3000"
echo "🔌 API 地址：http://localhost:3001"
echo "📝 后端日志：/tmp/monitor-server.log"
echo ""
echo "🛑 停止服务：执行 ./stop.sh 或 Ctrl+C"
echo "=========================================="
echo ""

# 启动前端开发服务器（前台）
echo "🎨 启动前端开发服务器..."
npm run dev
