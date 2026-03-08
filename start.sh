#!/bin/bash

# Monitor Platform 启动脚本
# 自动启动后端 API 服务和前端开发服务器（一起启动）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 启动 Monitor Platform..."
echo ""

# 确保日志目录存在
mkdir -p logs

# 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo ""
fi

# 检查 config.json
if [ ! -f "config.json" ]; then
    echo "⚠️  config.json 文件不存在..."
    echo "请创建配置文件并设置正确的路径"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "⚠️  依赖未安装，正在安装..."
    npm install
    echo ""
fi

# 清理旧进程和占用端口的进程
echo "🧹 清理旧进程..."
PORTS_IN_USE=""

# 检查并清理 3001 端口（后端）
if lsof -i:3001 > /dev/null 2>&1; then
    PORTS_IN_USE="$PORTS_IN_USE 3001"
    echo "⚠️  端口 3001 被占用，正在清理..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 检查并清理 3000 端口（前端）
if lsof -i:3000 > /dev/null 2>&1; then
    PORTS_IN_USE="$PORTS_IN_USE 3000"
    echo "⚠️  端口 3000 被占用，正在清理..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 停止旧的 node server.js 进程
if pgrep -f "node server.js" > /dev/null; then
    echo "🔄 停止旧的后端服务..."
    pkill -9 -f "node server.js"
    sleep 1
fi

# 停止旧的 vite/npm run dev 进程
if pgrep -f "vite" > /dev/null; then
    echo "🔄 停止旧的前端服务..."
    pkill -9 -f "vite"
    sleep 1
fi

if pgrep -f "npm run dev" > /dev/null; then
    pkill -9 -f "npm run dev"
    sleep 1
fi

if [ -n "$PORTS_IN_USE" ]; then
    echo "✅ 端口清理完成:$PORTS_IN_USE"
else
    echo "✅ 无需清理，端口可用"
fi
echo ""

# 启动后端服务
echo "📡 启动后端 API 服务..."
nohup node server.js > logs/server.log 2>&1 &
BACKEND_PID=$!
sleep 2

if pgrep -f "node server.js" > /dev/null; then
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
else
    echo "❌ 后端服务启动失败，请查看 logs/server.log"
    exit 1
fi

# 等待后端就绪
echo "⏳ 等待后端服务就绪..."
for i in {1..10}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 后端服务已就绪"
        break
    fi
    sleep 1
done

# 检查后端是否真的就绪
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "⚠️  后端服务未完全就绪，但继续启动前端..."
fi

# 启动前端服务
echo ""
echo "🎨 启动前端开发服务器..."
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
else
    echo "❌ 前端服务启动失败，请查看 logs/frontend.log"
    echo "⚠️  后端服务继续运行"
fi

# 保存 PID 到文件
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo ""
echo "=========================================="
echo "✅ Monitor Platform 启动完成！"
echo "=========================================="
echo ""
echo "📊 访问地址："
echo "   前端：http://localhost:3000"
echo "   后端：http://localhost:3001/api/health"
echo ""
echo "📖 查看日志："
echo "   后端：tail -f logs/server.log"
echo "   前端：tail -f logs/frontend.log"
echo ""
echo "🛑 停止服务："
echo "   ./stop.sh"
echo ""
echo "📋 进程 ID："
echo "   后端：$BACKEND_PID"
echo "   前端：$FRONTEND_PID"
echo ""
