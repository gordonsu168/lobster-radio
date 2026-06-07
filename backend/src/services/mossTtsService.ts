// MOSS-TTS-Nano 本地 TTS 服务
// 独立模块，避免 ttsService.ts 过于冗长
// 支持预设 demo 语音 + 自定义声音克隆

import fs from "fs";
import path from "path";

// MOSS-TTS-Nano demo 语音映射
const MOSS_VOICES: Record<string, string> = {
  "default": "demo-5",
  "male": "demo-5",
  "male-2": "demo-4",
  "female": "demo-1",
  "female-2": "demo-6",
  // 声音克隆模式：不传 demo_id，传 prompt_audio
  "clone": "",
};

export const MOSS_DEMO_MAP = MOSS_VOICES;

/** 声音克隆参考音频路径（.env 可配 MOSS_CLONE_VOICE_PATH） */
function getCloneAudioPath(): string | null {
  const envPath = process.env.MOSS_CLONE_VOICE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  return null;
}

export async function synthesizeWithMOSS(
  text: string,
  voice: string,
  getCache: (text: string, voice: string, provider: string) => any,
  setCache: (text: string, voice: string, provider: string, data: any) => void,
) {
  const apiUrl = process.env.MOSS_TTS_API_URL;

  // 先查缓存（克隆模式用不同 key）
  const cacheVoice = voice === "clone" ? `clone-${getCloneAudioPath() || "none"}` : voice;
  const cached = getCache(text, cacheVoice, "moss");
  if (cached) {
    console.log(`📦 MOSS TTS 命中缓存: ${text.substring(0, 20)}...`);
    return { ...cached, text, fallback: false };
  }

  if (!apiUrl) {
    throw new Error("MOSS_TTS_API_URL not configured");
  }

  // 构建请求
  const formData = new FormData();
  formData.append("text", text);
  formData.append("enable_text_normalization", "0");

  // 声音克隆模式
  const clonePath = voice === "clone" ? getCloneAudioPath() : null;
  if (clonePath) {
    console.log(`🎙️ MOSS TTS (克隆): ${clonePath}, 文本: ${text.substring(0, 40)}...`);
    const audioBuffer = fs.readFileSync(clonePath);
    // Node.js FormData: 用 Buffer + filename 替代 Blob
    const file = new File([audioBuffer], path.basename(clonePath), { type: "audio/wav" });
    formData.append("prompt_audio", file);
  } else {
    const demoId = MOSS_VOICES[voice] || MOSS_VOICES["default"];
    console.log(`🎙️ MOSS TTS: demo=${demoId}, 文本: ${text.substring(0, 40)}...`);
    formData.append("demo_id", demoId);
  }

  // Step 1: Start streaming generation
  const startResp = await fetch(`${apiUrl.replace(/\/$/, '')}/api/generate-stream/start`, {
    method: "POST",
    body: formData as any,
  });

  if (!startResp.ok) {
    throw new Error(`MOSS start error: ${startResp.status}`);
  }

  const startJson = await startResp.json() as any;
  if (startJson.error) throw new Error(startJson.error);

  const streamId = startJson.stream_id;

  // Step 2: Poll until done (max 2 min)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusResp = await fetch(`${apiUrl.replace(/\/$/, '')}/api/generate-stream/${streamId}/status`);
    const statusJson = await statusResp.json() as any;
    if (statusJson.state === "done") break;
    if (statusJson.state === "failed") throw new Error(statusJson.error || "MOSS generation failed");
  }

  // Step 3: Download audio
  const audioResp = await fetch(`${apiUrl.replace(/\/$/, '')}/api/generate-stream/${streamId}/audio`);
  if (!audioResp.ok) throw new Error(`MOSS audio download error: ${audioResp.status}`);

  const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
  const audioBase64 = audioBuffer.toString("base64");

  const voiceLabel = clonePath ? `clone:${path.basename(clonePath)}` : MOSS_VOICES[voice];
  console.log(`✅ MOSS TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

  const result = {
    provider: "moss",
    voice: voiceLabel,
    audioBase64,
    mimeType: "audio/wav",
    text,
    fallback: false,
  };

  setCache(text, cacheVoice, "moss", result);
  return result;
}
