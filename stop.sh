#!/bin/bash

# Monitor Platform 停止脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 停止 Monitor Platform..."
echo ""

# 直接按端口杀进程（最可靠）
for port in 3001 3000; do
    pid=$(lsof -ti:$port)
    if [ -n "$pid" ]; then
        echo "🔫 端口 $port 被 PID $pid 占用，强制停止..."
        kill -9 $pid 2>/dev/null
        sleep 1
        if lsof -ti:$port > /dev/null 2>&1; then
            echo "❌ 端口 $port 释放失败，请手动检查"
        else
            echo "✅ 端口 $port 已释放"
        fi
    else
        echo "✅ 端口 $port 未被占用"
    fi
done

# 清理 PID 文件
rm -f .backend.pid .frontend.pid

echo ""
echo "=========================================="
echo "✅ Monitor Platform 已停止"
echo "=========================================="
echo ""
echo "🚀 重新启动：./start.sh"
echo ""