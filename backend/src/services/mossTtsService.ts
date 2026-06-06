// MOSS-TTS-Nano 本地 TTS 服务
// 独立模块，避免 ttsService.ts 过于冗长

import fs from "fs";
import path from "path";
import os from "os";

// MOSS-TTS-Nano demo 语音映射
// 男声: demo-5 (中国时间观念, 沉稳男声), demo-4 (京味胡同, 北京腔)
const MOSS_VOICES: Record<string, string> = {
  "default": "demo-5",
  "male": "demo-5",
  "male-2": "demo-4",
  "female": "demo-1",
  "female-2": "demo-6",
};

export const MOSS_DEMO_MAP = MOSS_VOICES;

export async function synthesizeWithMOSS(
  text: string,
  voice: string,
  getCache: (text: string, voice: string, provider: string) => any,
  setCache: (text: string, voice: string, provider: string, data: any) => void,
) {
  const apiUrl = process.env.MOSS_TTS_API_URL;

  // 先查缓存
  const cached = getCache(text, voice, "moss");
  if (cached) {
    console.log(`📦 MOSS TTS 命中缓存: ${text.substring(0, 20)}...`);
    return { ...cached, text, fallback: false };
  }

  if (!apiUrl) {
    throw new Error("MOSS_TTS_API_URL not configured");
  }

  const demoId = MOSS_VOICES[voice] || MOSS_VOICES["default"];
  console.log(`🎙️ MOSS TTS: demo=${demoId}, 文本: ${text.substring(0, 40)}...`);

  // Step 1: Start streaming generation
  const formData = new FormData();
  formData.append("text", text);
  formData.append("demo_id", demoId);
  formData.append("enable_text_normalization", "0");

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

  console.log(`✅ MOSS TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

  const result = {
    provider: "moss",
    voice: demoId,
    audioBase64,
    mimeType: "audio/wav",
    text,
    fallback: false,
  };

  setCache(text, voice, "moss", result);
  return result;
}
