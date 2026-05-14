
# 🦞 Lobster Radio 龙虾电台

AI 驱动的私人粤语电台，有 React 网页端、Express + TypeScript 后端，还有 Electron 悬浮桌面播放器。用 AI 生成粤语旁白，播你钟意的歌！

## ✨ 特色功能

### 🎤 **地道粤语 AI 旁白**
- 全部旁白文案系纯正广东话
- 🔥 **CosyVoice 本地部署**：粤语 TTS 天花板！支持声音克隆，9 种语言 + 18 种方言
- 支持 Gemini TTS 高质量粤语语音合成
- 四种 DJ 风格任拣：
  - 📻 **Classic** - 经典电台味："欢迎返到龙虾电台..."
  - 🌙 **Night** - 深夜治愈风："夜阑人静，有歌陪你..."
  - ⚡ **Vibe** - 活力蹦迪风："嚟啦嚟啦！跟住节奏一齐郁！"
  - 🧠 **Trivia** - 冷知识科普："你知唔知？呢首歌..."

### 🎵 **本地音乐库**
- 自动扫描本地音乐文件夹
- 每首歌有专属 Wiki 资料（专辑、年份、冷知识）
- 400+ 经典粤语金曲已入库

### 💬 **AI 智能 DJ (RadioDJAgent & StreamDJAgent)**
- **沉浸式旁白**：人设化 (Persona-based) 播报，DJ 会用纯正广东话同你倾计
- **互动播客模式 (Stream Mode)**：全新“DJ 流播模式”，DJ 成为主角，持续发散性聊天并根据内容智能点歌，支持实时弹幕互动，打造全天候虚拟 Live DJ 体验！
- **中插冷知识 (Mid-track Trivia)**：实时 AI 生成歌曲背景、歌手故事，故事化演绎
- **片尾结语 (Outro)**：播放结束后的贴心结语，完美复刻真实电台无缝体验
- 同天气、时间、心情智能联动

### 🧠 **长期记忆系统 (MemoryAgent)**
- **SQLite 存储**：本地轻量级数据库 (`history.db`)，安全可靠
- **偏好学习**：自动记录听歌历史与互动，打造越听越懂你的专属 DJ

### 🖥️ **悬浮桌面播放器**
- Electron 打造，永远置顶
- 迷你模式：精简胶囊播放器
- 全局快捷键支持
- 进度条 + 音量控制

### 🔊 **智能 TTS 降级机制**
```
Gemini TTS (高质量粤语) → Mac Say (系统语音) → Fallback (直接播歌)
```
- Gemini 失败自动重试 2 次
- 自动降级，保证唔会无声

## 🏗️ 项目结构

```
lobster-radio/
├── frontend/          # React + Vite + Tailwind 网页端
├── backend/           # Express + TypeScript 后端
│   ├── src/services/
│   │   ├── ttsService.ts          # TTS 语音合成（Gemini + Mac Say）
│   │   ├── narrationGenerator.ts  # 粤语旁白生成器
│   │   └── wikiService.ts         # 歌曲 Wiki 资料库
│   └── src/routes/
├── desktop/           # Electron 悬浮桌面播放器
└── agents/            # LangChain AI Agents (RadioDJAgent, StreamDJAgent, ProducerAgent, MemoryAgent)
```

## 🚀 快速开始

### 环境要求
- Node.js 20+
- npm 10+
- macOS（用于 Mac Say 语音合成）
- ffmpeg（音频转码）

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：
```env
# Gemini TTS（推荐！高质量粤语）
GEMINI_API_KEY=your_api_key_here
DEFAULT_TTS_PROVIDER=gemini

# 其他 TTS Provider（可选）
OPENAI_API_KEY=
ELEVENLABS_API_KEY=

# 本地音乐库
LOCAL_MUSIC_PATH=/path/to/your/music
PREFERRED_MUSIC_SOURCE=local
```

### 启动全栈服务

```bash
npm run dev
```

服务启动后：
- 🌐 网页端：`http://localhost:5173`
- 📻 电台模式：`http://localhost:5173/radio`
- ⚙️ 后端 API：`http://localhost:4000`

### 启动桌面悬浮播放器

```bash
cd desktop
npm install
npm start
```

### 🧮 本地部署 MOSS-TTS-Nano（可选）

MOSS-TTS-Nano 是一个开源的 0.1B 参数多语言 TTS 模型，可以直接在 CPU 上运行，不需要 GPU。适合想要本地完全离线 TTS 的用户。

**部署步骤：**

```bash
# 克隆 MOSS-TTS-Nano 仓库
git clone https://github.com/OpenMOSS/MOSS-TTS-Nano.git
cd MOSS-TTS-Nano

# 按照官方说明安装依赖
pip install -r requirements.txt

# 下载模型（按照官方说明）
# 启动 HTTP 推理服务（默认端口 18083）
python app.py --port 18083
```

然后在 Lobster Radio `.env` 文件中配置：
```env
MOSS_TTS_API_URL=http://localhost:18083
```

Lobster Radio 会自动在 Edge TTS 失败后回落到 MOSS-TTS-Nano。

## 🎛️ 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | 4000 |
| `FRONTEND_URL` | 前端 CORS 域名 | `http://localhost:5173` |
| `GEMINI_API_KEY` | Google Gemini API Key | - |
| `OPENAI_API_KEY` | OpenAI API Key（可选） | - |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key（可选） | - |
| `COSYVOICE_API_URL` | CosyVoice 本地服务地址 | `http://localhost:50000` |
| `MOSS_TTS_API_URL` | MOSS-TTS-Nano 本地服务地址 | `http://localhost:18083` |
| `DEFAULT_TTS_PROVIDER` | 默认 TTS：`gemini` / `edge` / `moss` / `cosyvoice` / `mac-say` | `edge` |
| `DEFAULT_TTS_VOICE` | 默认语音 | `alloy` |
| `LOCAL_MUSIC_PATH` | 本地音乐文件夹 | - |
| `PREFERRED_MUSIC_SOURCE` | 音乐源：`local` / `spotify` | `local` |
| `WEATHER_API_KEY` | 天气 API（可选，用于心情推荐） | - |

## 🔊 TTS Provider 对比

| Provider | 粤语质量 | 速度 | 免费额度 | 备注 |
|----------|---------|------|---------|------|
| **Gemini** | ⭐⭐⭐⭐⭐ 优秀 | 快 | 1500 次/天 | **推荐**，支持 30 种语音 |
| **Edge TTS** | ⭐⭐⭐⭐⭐ 优秀 | 快 | 无限 | 完全免费，无需部署 |
| **MOSS-TTS-Nano** | ⭐⭐⭐⭐ 良好 | 中等 | 无限 | 本地 CPU 可运行，0.1B 参数开源模型 |
| **CosyVoice** | ⭐⭐⭐⭐⭐ 天花板 | 中等 | 无限 | 需要 GPU 部署，支持方言音色克隆 |
| **Mac Say** | ⭐⭐⭐⭐ 良好 | 最快 | 无限 | 系统内置，无需 API Key |
| **OpenAI** | ⭐⭐⭐ 一般 | 快 | 付费 | - |
| **ElevenLabs** | ⭐⭐⭐⭐⭐ 优秀 | 快 | 付费 | - |

## 📜 NPM Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端 + 后端开发服务 |
| `npm run restart` | 🔄 快速重启所有服务（自动清理端口） |
| `npm run stop` | 🛑 停止所有服务 |
| `npm run build` | 构建所有 workspace |
| `npm run lint` | ESLint 代码检查 |

### 快速重启

如果遇到端口占用或需要重启服务，使用：

```bash
npm run restart
# 或直接运行脚本
./restart.sh
```

脚本会自动：
1. 关闭占用的端口（4000, 5173, 5174）
2. 清理所有相关进程
3. 重新编译 agents
4. 启动所有服务

## 🎤 Gemini TTS 语音列表

Gemini 支持 30 种语音，默认映射：
- `alloy` → Zephyr（明亮女声）
- `echo` → Puck（活泼女声）
- `fable` → Charon（信息型男声）
- `onyx` → Fenrir（兴奋男声）
- `nova` → Kore（坚定女声）
- `shimmer` → Leda（年轻女声）

也可以直接用原生语音名：`aoede`, `enceladus`, `orus`, `algieba`, `despina` 等等。

## 📝 Notes

- Spotify 预览播放需要 API Key，无 Key 时自动使用本地音乐
- TTS 端点返回 base64 编码的 MP3 音频
- 所有旁白文案已本地化到粤语，无需额外配置
- 桌面端目前仅支持 macOS

## 🦞 关于

Lobster Radio = 龙虾电台，来自 Gordon 的私人项目。

> 粤语歌 + 粤语 AI DJ = 最正的私人电台 🎶
