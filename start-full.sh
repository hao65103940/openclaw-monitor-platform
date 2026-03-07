#!/bin/bash

echo "🚀 启动 Agent 监控平台（完整服务）..."

# 进入项目目录
cd "$(dirname "$0")"

# 停止旧的服务
pkill -f "node server-real.js" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 1

# 启动真实数据 API 服务（后台）
echo "📡 启动 API 服务（端口 3001）..."
nohup node server-real.js > /tmp/monitor-api.log 2>&1 &
API_PID=$!
echo "✅ API 服务 PID: $API_PID"

# 等待 API 服务启动
sleep 2

# 测试 API 是否可用
echo "🧪 测试 API 连接..."
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo "✅ API 服务正常"
else
  echo "⚠️  API 服务启动中，请查看日志：/tmp/monitor-api.log"
fi

echo ""
echo "=========================================="
echo "✅ 服务已启动！"
echo "=========================================="
echo "🌐 前端地址：http://localhost:3000"
echo "🔌 API 地址：http://localhost:3001"
echo ""
echo "📋 访问方式："
echo ""
echo "  方式 1 - 服务器本地访问："
echo "    http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "  方式 2 - SSH 端口转发（推荐）："
echo "    ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@$(hostname -I | awk '{print $1}')"
echo "    然后访问：http://localhost:3000"
echo ""
echo "  方式 3 - 直接访问服务器 IP（需要开放防火墙）："
echo "    http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📝 日志文件："
echo "   API 日志：/tmp/monitor-api.log"
echo "   Vite 日志：在终端显示"
echo ""
echo "🛑 停止服务："
echo "   pkill -f 'node server-real.js'"
echo "   Ctrl + C（停止 Vite）"
echo "=========================================="
echo ""

# 启动前端开发服务器
npm run dev
