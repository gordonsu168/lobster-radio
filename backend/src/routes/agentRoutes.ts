import { Router } from "express";
import { spawnSync } from "node:child_process";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { getPlayHistory, getAestheticDna, saveAestheticDna, getRuntimeSettings } from "../services/storageService.js";
import { scanMusicLibrary } from "../services/musicLibraryService.js";
import { agentPlayer } from "../services/agentPlayerService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getSongWiki } from "../services/wikiService.js";
import { getUserState, getCachedUserState } from "../services/userStateMonitor.js";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

export const lobsterCoreXRouter = Router();

// 闲聊模式旁白开关
let chatNarrationEnabled = true;

// 音响输出开关（动态切换，无需重启）
import { updateXiaomiConfig, getXiaomiConfig } from "../services/xiaomiSpeakerService.js";

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
    await fsp.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    agentPlayer.addVoice(tmpFile, text);
  }
}

lobsterCoreXRouter.get("/status", (req, res) => {
  res.json(agentPlayer.getState());
});

lobsterCoreXRouter.get("/state", async (_req, res) => {
  try {
    const state = await getUserState();
    res.json(state);
  } catch (error) {
    const cached = getCachedUserState();
    if (cached) return res.json(cached);
    res.status(500).json({ error: "Offline" });
  }
});

lobsterCoreXRouter.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const msg = message.trim().toLowerCase();

    if (msg === '/talk' || msg === '/chat') {
        const __filename = fileURLToPath(import.meta.url);
        let root = path.dirname(__filename);
        let bgmPath = "";
        for (let i = 0; i < 5; i++) {
            const probe = path.join(root, "data/bgm/chat_bgm.mp3");
            if (fs.existsSync(probe)) { bgmPath = probe; break; }
            root = path.dirname(root);
        }
        if (!bgmPath) bgmPath = path.resolve(process.cwd(), "data/bgm/chat_bgm.mp3");

        agentPlayer.playBGM(bgmPath, "Beautiful Lady - Daydream");
        return res.json({ logs: [{ id: 't1', timestamp: Date.now(), type: 'action', content: `[OK] 闲聊模式已启动。旁白: ${chatNarrationEnabled ? '开 🎙️' : '关 🔇'}` }], dna: (await getAgent()).getDna() });
    }

    // 旁白开关
    if (msg === '/chat talk') {
        chatNarrationEnabled = true;
        return res.json({ logs: [{ id: 'ct1', timestamp: Date.now(), type: 'action', content: `[OK] 闲聊旁白已开启 🎙️` }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/chat mute') {
        chatNarrationEnabled = false;
        return res.json({ logs: [{ id: 'ct2', timestamp: Date.now(), type: 'action', content: `[OK] 闲聊旁白已关闭 🔇` }], dna: (await getAgent()).getDna() });
    }

    // 音响输出切换
    if (msg === '/speaker xiaomi') {
        updateXiaomiConfig({ enabled: true });
        // 使 agentPlayer 感知变更：清掉当前队列，让其重新初始化
        agentPlayer.clear();
        return res.json({ logs: [{ id: 'sp1', timestamp: Date.now(), type: 'action', content: `[OK] 已切换到小米音响 🔊` }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/speaker local') {
        updateXiaomiConfig({ enabled: false });
        agentPlayer.clear();
        return res.json({ logs: [{ id: 'sp2', timestamp: Date.now(), type: 'action', content: `[OK] 已切换到电脑音响 💻` }], dna: (await getAgent()).getDna() });
    }
    if (msg === '/speaker') {
        const cfg = getXiaomiConfig();
        const status = cfg.enabled ? `小米音响 🔊 (${cfg.deviceId?.slice(0,8)}...)` : `电脑音响 💻`;
        return res.json({ logs: [{ id: 'sp0', timestamp: Date.now(), type: 'action', content: `当前输出: ${status}` }], dna: (await getAgent()).getDna() });
    }

    if (msg.startsWith('/play ')) {
      const query = message.slice(6).trim();
      const { searchTracks } = await import("../services/musicLibraryService.js");
      const results = await searchTracks(query);
      if (results.length === 0) return res.json({ logs: [{ id: 'p1', timestamp: Date.now(), type: 'action', content: `[FAIL]` }], dna: (await getAgent()).getDna() });
      
      const track = results[0];
      agentPlayer.clear();
      
      const previewUrl = track.previewUrl || "";
      const b64 = previewUrl.split("/stream/")[1];
      const finalPath = b64 ? Buffer.from(b64, "base64url").toString() : previewUrl;
      agentPlayer.addMusic(finalPath, track.title, track.id);

      return res.json({ logs: [{ id: 'p2', timestamp: Date.now(), type: 'action', content: `[PLAYING] ${track.title}` }], dna: (await getAgent()).getDna() });
    }

    // 播放任意本地文件（支持 /tmp/ncm_*.mp3 等 ncm-cli 下载的文件）
    if (msg.startsWith('/playfile ')) {
        const filePath = message.slice(10).trim();
        if (!fs.existsSync(filePath)) {
            return res.json({ logs: [{ id: 'pf1', timestamp: Date.now(), type: 'action', content: `[FAIL] 文件不存在: ${filePath}` }], dna: (await getAgent()).getDna() });
        }
        const title = path.basename(filePath, path.extname(filePath));
        agentPlayer.clear();
        agentPlayer.addMusic(filePath, title);
        return res.json({ logs: [{ id: 'pf2', timestamp: Date.now(), type: 'action', content: `[PLAYING] ${title}` }], dna: (await getAgent()).getDna() });
    }

    if (msg === '/stream') {
      const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
      agentPlayer.clear();
      // 设置补货回调，确保电台能持续推荐歌曲
      agentPlayer.setReplenishCallback(async () => {
          console.log("[backend] Radio queue low, fetching next segment...");
          await fetchNextRadioSegment();
      });
      await fetchNextRadioSegment();
      return res.json({ logs: [{ id: 's1', timestamp: Date.now(), type: 'action', content: `[OK] 电台已开启。` }], dna: (await getAgent()).getDna() });
    }

    if (msg === '/clear' || msg === '/stop' || msg === '/quit') {
        agentPlayer.clear();
        // 同时杀掉所有残留 afplay/mpv 进程
        try { spawnSync("pkill", ["-9", "afplay"]); } catch {}
        try { spawnSync("pkill", ["-9", "mpv"]); } catch {}
        return res.json({ logs: [{ id: 'c1', timestamp: Date.now(), type: 'action', content: `[OK] 所有音频已静音。` }], dna: (await getAgent()).getDna() });
    }

    if (msg === '/next') {
        agentPlayer.next();
        return res.json({ logs: [{ id: 'nxt1', timestamp: Date.now(), type: 'action', content: `[OK] 已切歌。` }], dna: (await getAgent()).getDna() });
    }

    if (msg === '/pause') {
        agentPlayer.toggle();
        const state = agentPlayer.getState();
        return res.json({ logs: [{ id: 'ps1', timestamp: Date.now(), type: 'action', content: state.isPaused ? `[OK] 已暂停。` : `[OK] 已恢复。` }], dna: (await getAgent()).getDna() });
    }

    if (msg === '/now') {
        const state = agentPlayer.getState();
        return res.json({ logs: [{ id: 'n1', timestamp: Date.now(), type: 'message', content: state.currentMusic?.title || "空闲" }], dna: (await getAgent()).getDna() });
    }

    // 旁白播报（直接 TTS + 播放，不触发 AI 对话）
    if (msg.startsWith('/narrate ')) {
        const text = message.slice(9).trim();
        if (text) await broadcastNarration(text);
        return res.json({ logs: [{ id: 'nr1', timestamp: Date.now(), type: 'action', content: `[OK] 已播报。` }], dna: (await getAgent()).getDna() });
    }

    // 3. 普通对话
    const agent = await getAgent();
    const logs = await agent.chat(message);
    const aiMessage = logs.find(p => p.type === 'message')?.content;
    if (aiMessage && chatNarrationEnabled) await broadcastNarration(aiMessage);

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
