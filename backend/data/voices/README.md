# Lobster Radio — GPT-SoVITS 声音克隆设置指南

## 1. 部署 GPT-SoVITS

```bash
# 克隆项目
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS

# 安装依赖
pip install -r requirements.txt

# 下载模型（首次启动会自动下载，或手动下载放到指定目录）
# 需要: GPT_SoVITS 权重 + 参考音频编码器

# 启动 API 服务
python api.py -a 0.0.0.0 -p 9880
```

API 服务默认监听 `http://localhost:9880`。

## 2. 录参考音频

录一段你自己（或朋友）的声音，要求：
- **时长**: 5~30 秒（1 分钟内最佳，越干净越好）
- **内容**: 用粤语/普通话自然说话，不卡顿，不吞字
- **环境**: 背景安静，无回声
- **格式**: `.wav` 格式，采样率 16kHz 或 24kHz，单声道
- **命名**: 把文件放到这个目录，例如 `brother.wav`

参考音频文本范例（粤语）：
> 「大家好，我係龙虾电台嘅AI音乐主播，好开心同你一齐分享好音乐。」

## 3. 配置环境变量

在 `.env` 文件中添加或修改：

```env
GPTSOVITS_API_URL=http://localhost:9880
DEFAULT_TTS_PROVIDER=gptsovits      # 设为默认 TTS
DEFAULT_TTS_VOICE=@brother          # 你的克隆声音
```

## 4. 测试

重启后端服务后，访问 TTS 试听接口验证：

```bash
curl "http://localhost:4000/api/tts/preview?provider=gptsovits&voice=@brother"
```

或通过 `/api/tts` POST 接口测试：

```bash
curl -X POST http://localhost:4000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"大家好，我系龙虾电台","voice":"@brother","provider":"gptsovits"}'
```

## 声音命名规则

| voice 参数         | 参考音频路径                          | 说明                   |
|-------------------|-------------------------------------|------------------------|
| `@brother`        | `data/voices/brother.wav`           | 你的声音               |
| `@friend`         | `data/voices/friend.wav`            | 朋友的声音             |
| `@<name>`         | `data/voices/<name>.wav`            | 任意自定义             |
| `default`         | (无，使用 GPT-SoVITS 内置预设)       | 默认预设声音           |

**声音克隆模式**：voice 参数以 `@` 开头 → 自动到 `data/voices/` 目录找对应 `.wav` 文件做零样本克隆
**普通模式**：voice 参数为其他值 → 传参给 GPT-SoVITS 当作预设声音 ID
