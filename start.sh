#!/bin/bash

echo "🚀 启动 Agent 监控平台..."

cd /root/.openclaw/monitor-platform

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

# 启动开发服务器
echo "🌐 启动开发服务器..."
npm run dev
