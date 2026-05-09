#!/bin/bash
# ============================================================
# 🦞 龙虾电台 - CosyVoice 一键启动脚本
# 本地部署高质量粤语 TTS 服务
# ============================================================

echo "===================================="
echo "🦞 CosyVoice 部署脚本"
echo "===================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 NVIDIA GPU
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  未检测到 NVIDIA GPU，将使用 CPU 模式（较慢）"
    RUNTIME=""
else
    echo "✅ 检测到 NVIDIA GPU"
    RUNTIME="--runtime=nvidia"
fi

# 检查端口
if lsof -Pi :50000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 50000 已被占用"
    if curl -s http://localhost:50000/health > /dev/null 2>&1; then
        echo "✅ CosyVoice 服务已在运行！"
        exit 0
    fi
fi

echo ""
echo "📦 正在拉取 CosyVoice 镜像..."
echo "（模型 2GB，首次启动需要下载，请耐心等待）"
echo ""

# 启动 Docker
docker run -d $RUNTIME \
    -p 50000:50000 \
    --name cosyvoice \
    --restart unless-stopped \
    registry.cn-hangzhou.aliyuncs.com/modelscope-repo/cosyvoice:v3.0 \
    /bin/bash -c "cd /opt/CosyVoice/CosyVoice/runtime/python/fastapi && python3 server.py --port 50000 --model_dir FunAudioLLM/Fun-CosyVoice3-0.5B-2512 && sleep infinity"

echo ""
echo "⏳ 服务启动中..."
echo "   首次启动需要下载模型（2GB），请耐心等待..."
echo ""

# 等待服务启动
max_wait=300
count=0
while [ $count -lt $max_wait ]; do
    if curl -s http://localhost:50000/health > /dev/null 2>&1; then
        echo ""
        echo "✅ CosyVoice 服务启动成功！"
        echo "🌐 API 地址: http://localhost:50000"
        echo "🎤 支持: 粤语、普通话、英语、日语、韩语等 9 种语言 + 18 种方言"
        echo ""
        echo "🦞 龙虾电台配置："
        echo "   在 .env 中设置："
        echo "   DEFAULT_TTS_PROVIDER=cosyvoice"
        echo ""
        exit 0
    fi
    sleep 2
    count=$((count + 2))
    echo -ne "   等待中... ${count}s\r"
done

echo ""
echo "⚠️  启动超时，请检查 Docker 日志："
echo "   docker logs -f cosyvoice"
