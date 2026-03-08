#!/bin/bash

# Monitor Platform 停止脚本

echo "🛑 停止 Monitor Platform..."
echo ""

# 停止后端服务
if pgrep -f "node server.js" > /dev/null; then
    echo "停止后端服务..."
    pkill -f "node server.js"
    sleep 1
    if ! pgrep -f "node server.js" > /dev/null; then
        echo "✅ 后端服务已停止"
    else
        echo "⚠️  后端服务未能正常停止，请手动检查"
    fi
else
    echo "ℹ️  后端服务未运行"
fi

echo ""
echo "💡 提示："
echo "   - 前端开发服务器需要手动停止 (Ctrl+C)"
echo "   - 查看日志：tail -f logs/server.log"
echo ""
