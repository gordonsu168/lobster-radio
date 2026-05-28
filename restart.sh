#!/bin/bash

# 🦞 Lobster Radio 快速重启脚本 (兼容模式 - 移除 lsof)
# 用法: ./restart.sh

set -e

echo "🦞 正在重启 Lobster Radio..."
echo ""

# 1. 查找并关闭相关进程
echo "📡 正在清理 Lobster Radio 相关进程..."

# 使用 pkill 强力清理
# 匹配所有包含 lobster-radio 的 node 进程
pkill -9 -f "lobster-radio" 2>/dev/null || true
pkill -9 -f "tsx watch src/server.ts" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true

echo "✅ 进程已清理 (跳过 lsof 检查以防卡顿)"
echo ""

# 2. 等待释放
echo "⏳ 等待 1 秒..."
sleep 1

# 3. 重新编译 agents
echo "🔨 编译 agents..."
npm run build -w agents --silent

echo "✅ Agents 编译完成"
echo ""

# 4. 启动服务
echo "🚀 启动服务..."
echo ""
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:4000"
echo ""
echo "按 Ctrl+C 停止服务"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
