#!/bin/bash

# 🦞 Lobster Radio 快速重启脚本
# 用法: ./restart.sh

set -e

echo "🦞 正在重启 Lobster Radio..."
echo ""

# 1. 查找并关闭占用端口的进程
echo "📡 检查端口占用..."

# 关闭 4000 端口（后端）
BACKEND_PIDS=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$BACKEND_PIDS" ]; then
  echo "   关闭后端进程 (端口 4000): $BACKEND_PIDS"
  kill -9 $BACKEND_PIDS 2>/dev/null || true
fi

# 关闭 5173 端口（前端默认）
FRONTEND_PIDS=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$FRONTEND_PIDS" ]; then
  echo "   关闭前端进程 (端口 5173): $FRONTEND_PIDS"
  kill -9 $FRONTEND_PIDS 2>/dev/null || true
fi

# 关闭 5174 端口（前端备用）
FRONTEND_ALT_PIDS=$(lsof -ti:5174 2>/dev/null || true)
if [ -n "$FRONTEND_ALT_PIDS" ]; then
  echo "   关闭前端进程 (端口 5174): $FRONTEND_ALT_PIDS"
  kill -9 $FRONTEND_ALT_PIDS 2>/dev/null || true
fi

# 关闭所有 node 进程中包含 lobster-radio 的
echo "   查找并关闭 Lobster Radio 相关进程..."
pkill -f "lobster-radio" 2>/dev/null || true

echo "✅ 端口已清理"
echo ""

# 2. 等待端口完全释放
echo "⏳ 等待端口释放..."
sleep 2

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
