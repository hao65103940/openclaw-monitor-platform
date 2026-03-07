#!/bin/bash

echo "🛑 停止 Agent 监控平台..."
echo ""

# 停止后端 API 服务
echo "📡 停止后端 API 服务..."
pkill -f "node server.js" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ 后端服务已停止"
else
  echo "⚠️  未找到运行中的后端服务"
fi

# 释放端口
lsof -ti:3001 | xargs kill -9 2>/dev/null

# 等待 1 秒
sleep 1

# 检查端口是否释放
if lsof -ti:3001 | grep -q .; then
  echo "⚠️  端口 3001 仍被占用，请手动检查"
else
  echo "✅ 端口 3001 已释放"
fi

echo ""
echo "=========================================="
echo "✅ 所有服务已停止"
echo "=========================================="
echo ""
echo "📝 如需查看日志："
echo "   tail -f /tmp/monitor-server.log"
echo ""
