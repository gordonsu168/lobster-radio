#!/bin/bash

# DJ-X: The Resonant Heart Kernel Launcher
# --------------------------------------------------

set -e

CLI_DIR=$(cd "$(dirname "$0")"; pwd)
ENV_FILE="$CLI_DIR/../.env"

# 1. 准备 Python 环境 (需要 >= 3.11)
cd "$CLI_DIR/nanobot"

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
# 确保安装了 httpx 用于获取 Dashboard 数据
pip install httpx --quiet

# 2. 启动 Songloft（小米音响控制服务）
SONGLOFT_DIR="$CLI_DIR/../songloft"
SONGLOFT_PORT=58091

if [ -f "$SONGLOFT_DIR/songloft" ]; then
    if ! lsof -i :$SONGLOFT_PORT >/dev/null 2>&1; then
        echo "🔊 正在启动 Songloft..."
        cd "$SONGLOFT_DIR"
        nohup ./songloft -port $SONGLOFT_PORT -db ./data/songloft.db > /tmp/songloft.log 2>&1 &
        sleep 3
        echo "   Songloft 已启动 (端口 $SONGLOFT_PORT)"
    else
        echo "🔊 Songloft 已在运行 (端口 $SONGLOFT_PORT)"
    fi

    # 刷新 JWT Token 并写入 .env
    SONGLOFT_TOKEN=$(curl -s -X POST "http://localhost:$SONGLOFT_PORT/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin"}' 2>/dev/null | \
        python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

    if [ -n "$SONGLOFT_TOKEN" ]; then
        if [ -f "$ENV_FILE" ]; then
            # macOS sed 兼容
            sed -i '' "s/^XIAOMI_SPEAKER_JWT_TOKEN=.*/XIAOMI_SPEAKER_JWT_TOKEN=$SONGLOFT_TOKEN/" "$ENV_FILE"
        fi
        echo "   Songloft JWT Token 已刷新"
    else
        echo "   ⚠️ Songloft 登录失败，使用已有 Token"
    fi
    cd "$CLI_DIR"
else
    echo "⚠️ 未找到 Songloft (${SONGLOFT_DIR}/songloft)，跳过"
fi

# 3. 启动 MOSS-TTS-Nano（本地 AI 语音合成，CPU 友好）
MOSS_DIR="$HOME/Documents/github/moss-tts-nano"
MOSS_PORT=18083

if [ -d "$MOSS_DIR/.venv" ]; then
    if ! lsof -i :$MOSS_PORT >/dev/null 2>&1; then
        echo "🧠 正在启动 MOSS-TTS-Nano..."
        cd "$MOSS_DIR"
        nohup bash -c "source .venv/bin/activate && moss-tts-nano serve --backend onnx --host 0.0.0.0 --port $MOSS_PORT" > /tmp/moss-tts.log 2>&1 &
        echo "   MOSS-TTS 预热中（首次约 30s）..."
        # 等待服务就绪
        for i in $(seq 1 20); do
            sleep 2
            if curl -s "http://localhost:$MOSS_PORT/health" >/dev/null 2>&1; then
                echo "   MOSS-TTS 已就绪 (端口 $MOSS_PORT)"
                break
            fi
            [ $i -eq 20 ] && echo "   ⚠️ MOSS-TTS 启动超时，TTS 将降级到 Edge"
        done
    else
        echo "🧠 MOSS-TTS 已在运行 (端口 $MOSS_PORT)"
    fi
    cd "$CLI_DIR"
else
    echo "⚠️ 未找到 MOSS-TTS ($MOSS_DIR/.venv)，TTS 将降级到 Edge"
fi

# 4. 探测环境并提取密钥
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
    echo "❌ 错误: 无法从 .env 获取密钥"
    exit 1
fi

# 5. 注入 DJ-X 配置
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

# 6. 直接启动 nanobot agent
echo "💎 正在启动 DJ-X (Nanobot Engine)..."
nanobot agent
