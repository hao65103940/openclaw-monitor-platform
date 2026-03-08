#!/bin/bash

# Monitor Platform 启动脚本
# 自动启动后端 API 服务和前端开发服务器

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 启动 Monitor Platform..."
echo ""

# 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请根据实际情况修改配置"
    echo ""
fi

# 检查 config.json
if [ ! -f "config.json" ]; then
    echo "⚠️  config.json 文件不存在..."
    echo "请创建配置文件并设置正确的路径"
    exit 1
fi

# 启动后端服务
echo "📡 启动后端 API 服务..."
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  后端服务已在运行"
else
    nohup node server.js > logs/server.log 2>&1 &
    sleep 2
    if pgrep -f "node server.js" > /dev/null; then
        echo "✅ 后端服务已启动 (PID: $(pgrep -f 'node server.js'))"
    else
        echo "❌ 后端服务启动失败，请查看 logs/server.log"
        exit 1
    fi
fi

echo ""
echo "📊 后端 API 地址：http://localhost:3001/api/health"
echo ""

# 提示前端启动
echo "💡 前端开发服务器："
echo "   运行以下命令启动前端："
echo "   npm run dev"
echo ""
echo "📖 查看日志："
echo "   tail -f logs/server.log"
echo ""
echo "🛑 停止服务："
echo "   ./stop.sh"
echo ""
