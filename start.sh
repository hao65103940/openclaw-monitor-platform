#!/bin/bash

# Monitor Platform 启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 启动 Monitor Platform..."
echo ""

# 确保日志目录存在
mkdir -p logs

# 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件"
    else
        echo "❌ .env.example 不存在，请手动创建 .env"
        exit 1
    fi
    echo ""
fi

if [ ! -f "config.json" ]; then
    echo "❌ config.json 文件不存在，请先创建配置文件"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "⚠️  依赖未安装，正在安装..."
    npm install
    echo ""
fi

# ==========================================
# 清理旧进程（直接按端口杀，最可靠）
# ==========================================
echo "🧹 清理旧进程..."

for port in 3001 3000; do
    pid=$(lsof -ti:$port)
    if [ -n "$pid" ]; then
        echo "⚠️  端口 $port 被 PID $pid 占用，强制清理..."
        kill -9 $pid 2>/dev/null
        sleep 1
        if lsof -ti:$port > /dev/null 2>&1; then
            echo "❌ 端口 $port 清理失败，请手动检查"
            exit 1
        fi
        echo "✅ 端口 $port 已清理"
    fi
done

echo "✅ 端口清理完成"
echo ""

# ==========================================
# 启动后端（setsid 独立进程组）
# ==========================================
echo "📡 启动后端 API 服务..."
setsid node server.js > logs/server.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > .backend.pid
sleep 2

if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "❌ 后端服务启动失败，请查看 logs/server.log："
    tail -20 logs/server.log
    exit 1
fi
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端就绪（最多 15 秒）
echo "⏳ 等待后端服务就绪..."
for i in {1..15}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 后端服务已就绪（${i}s）"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  后端 15 秒内未就绪，继续启动前端（功能可能受影响）"
    fi
    sleep 1
done

# ==========================================
# 启动前端（setsid 独立进程组）
# ==========================================
echo ""
echo "🎨 启动前端开发服务器..."
setsid npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > .frontend.pid
sleep 3

if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo "❌ 前端服务启动失败，请查看 logs/frontend.log："
    tail -20 logs/frontend.log
    echo "⚠️  后端服务继续运行"
else
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
fi

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
echo "🛑 停止服务：./stop.sh"
echo ""