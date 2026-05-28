#!/bin/bash

# DJ-X: The Resonant Heart Kernel Launcher
# --------------------------------------------------

set -e

# 1. 准备 Python 环境 (需要 >= 3.11)
cd nanobot

if [ ! -d ".venv" ]; then
    echo "🔍 正在寻找合适的 Python 3.11+ 环境..."
    PYTHON_EXE=""
    for cmd in "python3.12" "python3.11" "python3"; do
        if command -v $cmd >/dev/null 2>&1; then
            VERSION=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
            if [[ $(echo "$VERSION >= 3.11" | bc -l) -eq 1 ]]; then
                PYTHON_EXE=$(command -v $cmd)
                break
            fi
        fi
    done

    if [ -z "$PYTHON_EXE" ]; then
        if [ -f "/opt/homebrew/bin/python3.12" ]; then
            PYTHON_EXE="/opt/homebrew/bin/python3.12"
        elif [ -f "/usr/local/bin/python3.12" ]; then
            PYTHON_EXE="/usr/local/bin/python3.12"
        fi
    fi

    if [ -z "$PYTHON_EXE" ]; then
        echo "❌ 错误: 未找到 Python 3.11+。请运行 'brew install python@3.12'"
        exit 1
    fi

    echo "📦 使用 $PYTHON_EXE 创建虚拟环境..."
    $PYTHON_EXE -m venv .venv
fi

source .venv/bin/activate
pip install . --quiet

# 2. 探测环境并提取密钥
ENV_FILE="../../.env"
if [ -f "$ENV_FILE" ]; then
    DEEPSEEK_API_KEY=$(grep "DEEPSEEK_API_KEY" "$ENV_FILE" | sed -E 's/#.*//' | sed -E 's/.*=[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d '[:space:]')
    OPENAI_API_KEY=$(grep "OPENAI_API_KEY" "$ENV_FILE" | sed -E 's/#.*//' | sed -E 's/.*=[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d '[:space:]')
fi

if [ ! -z "$DEEPSEEK_API_KEY" ]; then
    PROVIDER="deepseek"
    MODEL="deepseek-v4-flash"
    API_KEY="$DEEPSEEK_API_KEY"
elif [ ! -z "$OPENAI_API_KEY" ]; then
    PROVIDER="openai"
    MODEL="gpt-4o-mini"
    API_KEY="$OPENAI_API_KEY"
else
    echo "❌ 错误: 无法获取密钥"
    exit 1
fi

# 3. 注入 DJ-X 配置
CLI_DIR=$(pwd)/..
BACKEND_MCP="$CLI_DIR/../backend/src/mcp/musicMcpServer.ts"

export NANOBOT_AGENTS__DEFAULTS__BOT_NAME="DJ-X"
export NANOBOT_AGENTS__DEFAULTS__BOT_ICON="⚡"
export NANOBOT_AGENTS__DEFAULTS__MODEL="$MODEL"
export NANOBOT_AGENTS__DEFAULTS__WORKSPACE="$CLI_DIR/workspace"

if [ "$PROVIDER" == "deepseek" ]; then
    export NANOBOT_PROVIDERS__DEEPSEEK__API_KEY="$API_KEY"
    export NANOBOT_PROVIDERS__DEEPSEEK__API_BASE="https://api.deepseek.com"
else
    export NANOBOT_PROVIDERS__OPENAI__API_KEY="$API_KEY"
fi

export NANOBOT_TOOLS__MCP_SERVERS='{"lobster_music": {"command": "npx", "args": ["tsx", "'$BACKEND_MCP'"], "env": {"PORT": "4000"}}}'
export NANOBOT_CHANNELS__SHOW_REASONING="true"
export NANOBOT_CHANNELS__SEND_PROGRESS="true"

# 4. 启动仪表盘外壳
echo "💎 正在加载 DJ-X 仪表盘外壳..."
cd "$CLI_DIR"
npx tsx src/wrapper.ts
