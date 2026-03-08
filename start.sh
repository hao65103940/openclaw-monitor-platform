#!/bin/bash

# Monitor Platform 启动脚本
# 自动启动后端 API 服务和前端开发服务器

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
        echo "❌ .env.example 也不存在，请手动创建 .env"
        exit 1
    fi
    echo ""
fi

# 检查 config.json
if [ ! -f "config.json" ]; then
    echo "❌ config.json 文件不存在"
    echo "请创建配置文件并设置正确的路径"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "⚠️  依赖未安装，正在安装..."
    npm install
    echo ""
fi

# ==========================================
# 停止旧服务（使用进程组方式，确保子进程一起清理）
# ==========================================
echo "🧹 停止旧服务..."

stop_by_pid_file() {
    local pid_file=$1
    local label=$2
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "🔄 停止旧的 $label (PID: $pid)..."
            # 获取进程组 ID 并杀整个组
            local pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ -n "$pgid" ] && [ "$pgid" != "0" ]; then
                kill -- -"$pgid" 2>/dev/null
            else
                kill -9 "$pid" 2>/dev/null
            fi
            sleep 1
        fi
        rm -f "$pid_file"
    fi
}

stop_by_pid_file ".backend.pid" "后端服务"
stop_by_pid_file ".frontend.pid" "前端服务"

# 兜底：按进程名清理（防止 PID 文件丢失的情况）
if pgrep -f "node server.js" > /dev/null 2>&1; then
    echo "🔄 清理残留后端进程..."
    pkill -9 -f "node server.js" 2>/dev/null
    sleep 1
fi

if pgrep -f "vite" > /dev/null 2>&1; then
    echo "🔄 清理残留 vite 进程..."
    pkill -9 -f "vite" 2>/dev/null
    sleep 1
fi

if pgrep -f "npm run dev" > /dev/null 2>&1; then
    pkill -9 -f "npm run dev" 2>/dev/null
    sleep 1
fi

# ==========================================
# 强制清理端口
# ==========================================
cleanup_port() {
    local port=$1
    if lsof -ti:"$port" > /dev/null 2>&1; then
        echo "⚠️  端口 $port 被占用，强制清理..."
        lsof -ti:"$port" | xargs kill -9 2>/dev/null
        sleep 1
        if lsof -ti:"$port" > /dev/null 2>&1; then
            echo "❌ 端口 $port 清理失败，请手动检查"
            exit 1
        fi
        echo "✅ 端口 $port 已清理"
    fi
}

cleanup_port 3001
cleanup_port 3000

echo "✅ 端口清理完成，3000 和 3001 可用"
echo ""

# ==========================================
# 启动后端服务（setsid 独立进程组）
# ==========================================
echo "📡 启动后端 API 服务..."
setsid node server.js > logs/server.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > .backend.pid
sleep 2

if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
else
    echo "❌ 后端服务启动失败，请查看 logs/server.log"
    cat logs/server.log | tail -20
    exit 1
fi

# 等待后端健康检查就绪（最多等 15 秒）
echo "⏳ 等待后端服务就绪..."
BACKEND_READY=0
for i in {1..15}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 后端服务已就绪（${i}s）"
        BACKEND_READY=1
        break
    fi
    sleep 1
done

if [ $BACKEND_READY -eq 0 ]; then
    echo "⚠️  后端服务 15 秒内未就绪，请检查 logs/server.log"
    echo "   继续启动前端，但功能可能受影响..."
fi

# ==========================================
# 启动前端服务（setsid 独立进程组）
# ==========================================
echo ""
echo "🎨 启动前端开发服务器..."
setsid npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > .frontend.pid
sleep 3

if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
else
    echo "❌ 前端服务启动失败，请查看 logs/frontend.log"
    cat logs/frontend.log | tail -20
    echo "⚠️  后端服务继续运行"
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
echo "🛑 停止服务："
echo "   ./stop.sh"
echo ""
echo "📋 进程 ID："
echo "   后端：$BACKEND_PID"
echo "   前端：$FRONTEND_PID"
echo ""