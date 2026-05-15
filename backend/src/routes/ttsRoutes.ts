import { Router } from "express";
import fs from "fs";
import path from "path";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getVoicesForProvider, getAllVoices } from "../services/voiceCatalog.js";

export const ttsRouter = Router();

const PREVIEW_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../data/runtime/voice-previews"
);

ttsRouter.post("/", async (req, res) => {
  const { text, voice, provider, emotion, apiKey, language } = req.body as {
    text: string;
    voice?: string;
    provider?: string;
    emotion?: string;
    apiKey?: string;
    language?: string;
  };
  const payload = await synthesizeSpeech(text, voice, { provider, emotion, apiKey, language });
  res.json(payload);
});

// 获取可用的 TTS 语音列表
ttsRouter.get("/voices", (req, res) => {
  const provider = req.query.provider as string | undefined;
  if (provider) {
    res.json({ voices: getVoicesForProvider(provider) });
  } else {
    res.json({ voices: getAllVoices() });
  }
});

// 语音试听预览（带磁盘缓存）
ttsRouter.get("/preview", async (req, res) => {
  const provider = req.query.provider as string;
  const voice = req.query.voice as string;
  if (!provider || !voice) {
    res.status(400).json({ error: "provider and voice are required" });
    return;
  }

  const voices = getVoicesForProvider(provider);
  const info = voices.find((v) => v.id === voice);
  if (!info) {
    res.status(404).json({ error: "voice not found" });
    return;
  }

  const safeVoice = voice.replace(/[^a-zA-Z0-9_-]/g, "_");
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });

  // Check if cached file already exists
  const existing = fs.readdirSync(PREVIEW_DIR).find((f) => f.startsWith(`${provider}__${safeVoice}.`));
  if (existing) {
    const ext = path.extname(existing);
    const mime = ext === ".wav" ? "audio/wav" : "audio/mpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(path.join(PREVIEW_DIR, existing)).pipe(res);
    return;
  }

  // Generate and cache
  try {
    const result = await synthesizeSpeech(info.previewText, voice, { provider });
    if (!result.audioBase64) {
      res.status(500).json({ error: "TTS synthesis failed" });
      return;
    }

    const mimeType = result.mimeType || "audio/mpeg";
    const ext = mimeType.includes("wav") ? ".wav" : ".mp3";
    const filename = `${provider}__${safeVoice}${ext}`;
    fs.writeFileSync(path.join(PREVIEW_DIR, filename), Buffer.from(result.audioBase64, "base64"));

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(result.audioBase64, "base64"));
  } catch (err) {
    console.error("Preview generation failed:", err);
    res.status(500).json({ error: "preview generation failed" });
  }
});

// 获取支持的情绪列表
ttsRouter.get("/emotions", (req, res) => {
  res.json({
    emotions: [
      { id: "normal", name: "正常", description: "标准语调" },
      { id: "happy", name: "开心", description: "欢快、愉悦的语气" },
      { id: "sad", name: "悲伤", description: "低沉、悲伤的语气" },
      { id: "angry", name: "愤怒", description: "激动、有力的语气" },
      { id: "calm", name: "平静", description: "放松、舒缓的语气" },
      { id: "excited", name: "兴奋", description: "充满活力、热情的语气" },
      { id: "whisper", name: "耳语", description: "低声、私密的语气" },
      { id: "radio", name: "电台风", description: "专业电台主持人风格" },
    ],
    voices: [
      { id: "rachel", name: "Rachel - 温暖女声", lang: "en" },
      { id: "drew", name: "Drew - 成熟女声", lang: "en" },
      { id: "clara", name: "Clara - 柔和女声", lang: "en" },
      { id: "sarah", name: "Sarah - 自然女声", lang: "en" },
      { id: "paul", name: "Paul - 磁性男声", lang: "en" },
      { id: "josh", name: "Josh - 活力男声", lang: "en" },
      { id: "antoni", name: "Antoni - 温柔男声", lang: "en" },
      { id: "elliot", name: "Elliot - 年轻男声", lang: "en" },
      { id: "lily", name: "Lily - 中文女声", lang: "zh" },
    ]
  });
});
