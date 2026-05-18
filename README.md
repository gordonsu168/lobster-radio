# 🦞 Lobster Radio

An AI-powered personal radio station featuring intelligent DJ agents, cross-platform support (Web & Desktop), and local music library integration. Lobster Radio leverages state-of-the-art LLMs and TTS engines to provide a highly customizable, immersive broadcasting experience.

## ✨ Key Features

### 🎤 **Intelligent AI Narration Engine**
- **Multi-Provider TTS**: Supports high-quality synthesis via **Google Gemini**, **CosyVoice** (Local), **Edge TTS**, and **MOSS-TTS-Nano**.
- **Versatile Language Support**: Native support for multiple languages and dialects, including high-quality Cantonese and Mandarin.
- **Dynamic DJ Personas**: Select from specialized broadcasting styles:
  - 📻 **Classic**: Traditional radio broadcasting style.
  - 🌙 **Night**: Calming, soothing narration for late-night listening.
  - ⚡ **Vibe**: Energetic and upbeat for a modern music experience.
  - 🧠 **Trivia**: Focuses on music history, artist stories, and educational insights.

### 🎵 **Personal Music Library**
- **Local Library Scanning**: Automatically indexes local music directories.
- **Rich Metadata & Wiki**: Integration with Wikipedia and local databases to provide background info, release years, and fun facts for every track.
- **Massive Catalog**: Optimized for large collections with instant search and intelligent queuing.

### 💬 **Advanced Agent Architecture**
- **Radio Mode (RadioDJAgent)**: Traditional radio experience with song introductions, transitions, and weather/time-aware commentary.
- **Stream Mode (StreamDJAgent)**: Interactive "Live DJ" experience featuring continuous narration, real-time chat interaction, and autonomous track selection.
- **Context-Aware Memory**: Integrated `MemoryAgent` learns your preferences over time, storing interaction history in a local SQLite database to personalize future broadcasts.

### 🖥️ **Modern Playback Experience**
- **Web Interface**: Responsive React-based dashboard for full control.
- **Floating Desktop Player**: Lightweight Electron-based "mini-player" that stays on top, featuring global shortcuts and a minimalist design.
- **Smart Failover**: Robust TTS fallback system ensuring uninterrupted playback even during API outages.

## 🏗️ Project Architecture

```
lobster-radio/
├── frontend/          # React + Vite + Tailwind Web Application
├── backend/           # Express + TypeScript Server
│   ├── src/services/  # TTS, Narration Generation, Wiki Metadata
│   └── src/routes/    # API Endpoints
├── desktop/           # Electron Desktop Application
└── agents/            # AI Agents (RadioDJ, StreamDJ, Producer, Memory)
```

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+
- **ffmpeg**: Required for audio transcoding
- **macOS**: (Optional) For system-native "Mac Say" TTS support

### Installation

```bash
npm install
```

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Configure your `GEMINI_API_KEY` and `LOCAL_MUSIC_PATH` in the `.env` file.

### Running the Application

```bash
# Start both Frontend and Backend
npm run dev

# (Optional) Start the Desktop Player
cd desktop && npm start
```

## 🔊 TTS Capability Overview

| Provider | Quality | Latency | Requirements | Best For |
|----------|---------|---------|--------------|----------|
| **Gemini** | ⭐⭐⭐⭐⭐ | Low | API Key | Daily usage, high-fidelity |
| **Edge TTS** | ⭐⭐⭐⭐⭐ | Low | None | General free usage |
| **CosyVoice** | ⭐⭐⭐⭐⭐ | Medium | Local GPU | Voice cloning & dialect accuracy |
| **MOSS-TTS** | ⭐⭐⭐⭐ | Medium | Local CPU | Fully offline environments |
| **Mac Say** | ⭐⭐⭐⭐ | Instant | macOS | Low-latency local fallback |

## 📜 Development Scripts

| Command | Description |
|------|------|
| `npm run dev` | Launch frontend and backend in development mode |
| `npm run restart` | Force-restart all services (cleans occupied ports) |
| `npm run build` | Build all packages for production |
| `npm run lint` | Run ESLint across the workspace |

## 📝 Project Notes

- **Offline Support**: Supports fully local operation when using CosyVoice or MOSS-TTS with local music.
- **Extensibility**: The Agent system is designed to be easily extended with new personas or data sources.
- **Privacy**: User preferences and listening history are stored locally in `history.db`.

---
*Lobster Radio - Your Personal AI Broadcasting Station.*
