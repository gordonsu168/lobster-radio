import { Router } from "express";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { getPlayHistory, getAestheticDna, saveAestheticDna, getRuntimeSettings, updateFeedback } from "../services/storageService.js";
import { scanMusicLibrary } from "../services/musicLibraryService.js";
import { agentPlayer } from "../services/agentPlayerService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const lobsterCoreXRouter = Router();

async function getAgent() {
  const secrets = await resolveRuntimeSecrets();
  process.env.DEEPSEEK_API_KEY = secrets.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
  process.env.OPENAI_API_KEY = secrets.openAiApiKey || process.env.OPENAI_API_KEY;
  const dna = await getAestheticDna();
  return new LobsterCoreXAgent(dna);
}

async function broadcastNarration(text: string) {
  const settings = await getRuntimeSettings();
  const secrets = await resolveRuntimeSecrets();
  const ttsResult: any = await synthesizeSpeech(text, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: settings.openAiApiKey || secrets.openAiApiKey,
    language: "zh-CN"
  });

  if (ttsResult.audioBase64) {
    const tmpFile = path.join(os.tmpdir(), `x_narration_${Date.now()}.mp3`);
    await fs.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    agentPlayer.add(tmpFile, "🎙️ LOBSTER-VOICE");
  }
}

lobsterCoreXRouter.get("/status", (req, res) => {
  res.json(agentPlayer.getState());
});

lobsterCoreXRouter.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const msg = message.trim().toLowerCase();

    // 1. 物理指令拦截 (最高优先级)
    if (msg === '/next') {
      agentPlayer.next();
      return res.json({ logs: [{ id: 'c1', timestamp: Date.now(), type: 'action', content: '[COMMAND] 下一首频率。' }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/pause' || msg === '/stop') {
      agentPlayer.toggle();
      return res.json({ logs: [], dna: (await getAgent()).getDna() });
    }
    if (msg === '/clear') {
      agentPlayer.clear();
      return res.json({ logs: [{ id: 'c2', timestamp: Date.now(), type: 'action', content: '[COMMAND] 序列清空。' }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/like') {
      const trackId = agentPlayer.getCurrentTrackId();
      if (trackId) { updateFeedback(trackId, "like"); }
      return res.json({ logs: [{ id: 'l1', timestamp: Date.now(), type: 'action', content: trackId ? '[LIKE] 已标记喜欢。' : '[LIKE] 没有正在播放的歌曲。' }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/dislike') {
      const trackId = agentPlayer.getCurrentTrackId();
      if (trackId) { updateFeedback(trackId, "dislike"); }
      return res.json({ logs: [{ id: 'u1', timestamp: Date.now(), type: 'action', content: trackId ? '[DISLIKE] 已标记不喜欢。' : '[DISLIKE] 没有正在播放的歌曲。' }], dna: (await getAgent()).getDna() });
    }

    // 2. /stream 模式 (接入全局电台引擎)
    if (msg === '/stream') {
      const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
      agentPlayer.clear();
      
      const { track, dj_talk } = await fetchNextRadioSegment();

      return res.json({ 
        logs: [
            { id: 's1', timestamp: Date.now(), type: 'action', content: `[RADIO_LOCKED] 成功连接至 http://localhost:5173/stream 的逻辑核心。` },
            { id: 's2', timestamp: Date.now(), type: 'message', content: `\n> **Pulse-X 旁白：** "${dj_talk}"\n\n> **正在注入：** ${track.artist} - ${track.title}` }
        ],
        dna: (await getAgent()).getDna() 
      });
    }

    // 3. 普通对话
    const agent = await getAgent();
    const logs = await agent.chat(message);
    await saveAestheticDna(agent.getDna());
    res.json({ logs, dna: agent.getDna() });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Brain fail" });
  }
});

lobsterCoreXRouter.post("/init", async (req, res) => {
  const agent = await getAgent();
  res.json({ dna: agent.getDna(), status: "READY" });
});
