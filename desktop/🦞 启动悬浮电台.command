#!/bin/bash

# ==============================================
# 🦞 龙虾电台悬浮播放器 - 一键启动脚本
# ==============================================

clear
# 说明：
# - 自动检测并启动后端服务
# - 打开悬浮播放器窗口
# - 窗口自动置顶，随时可以听歌
# ==============================================

echo ""
echo "🦞  龙虾电台悬浮播放器"
echo "======================="
echo ""

# 进入脚本所在目录
cd "$(dirname "$0")"

# 检查后端服务
echo "🔍  检查后端服务..."
if curl -s --connect-timeout 2 http://localhost:4000 > /dev/null 2>&1; then
    echo "✅ 后端服务已运行"
else
    echo "🔧 正在启动后端服务..."
    cd ..
    npm run dev > /tmp/lobster-radio.log 2>&1 &
    sleep 4
    echo "✅ 后端服务已启动"
fi

echo ""
echo "🚀 正在打开悬浮播放器..."
echo ""

# 启动 Electron 悬浮窗口
npx electron main.js
