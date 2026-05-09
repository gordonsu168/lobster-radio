#!/bin/bash

# 🦞 Lobster Radio 停止脚本
# 用法: ./stop.sh

echo "🛑 正在停止 Lobster Radio..."

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

echo "✅ 所有服务已停止"
