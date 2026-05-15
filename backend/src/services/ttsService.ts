
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";
import { ElevenLabsClient } from "elevenlabs";

// ========== ElevenLabs TTS (顶级质量，支持情绪调整) ==========
let elevenLabsClient: ElevenLabsClient | null = null;

function getElevenLabsClient(apiKey?: string): ElevenLabsClient | null {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key || key.trim() === "") {
    return null;
  }
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({ apiKey: key });
  }
  return elevenLabsClient;
}

// ElevenLabs 声音映射
const ELEVENLABS_VOICES: Record<string, string> = {
  // 女声
  "rachel": "21m00Tcm4TlvDq8ikWAM",    // Rachel - 温暖女声
  "drew": "29vD33N1CtxCmqQRPOHJ",      // Drew - 成熟女声
  "clara": "XB0fDUnXU5powFXDhCwa",     // Clara - 柔和女声
  "sarah": "EXAVITQu4vr4xnSDxMaL",     // Sarah - 自然女声
  "laura": "FGY2WhTYpPnrIDTdsKH5",     // Laura - 亲切女声
  // 男声
  "paul": "5Q0t7uMcjvnagumLfvZi",      // Paul - 磁性男声
  "josh": "TxGEqnHWrfWFTfGW9XjX",       // Josh - 活力男声
  "antoni": "ErXwobaYiN019PkySvjV",    // Antoni - 温柔男声
  "elliot": "MF3mGyEYCl7XYWbV9V6O",    // Elliot - 年轻男声
  // 中文声音
  "lily": "pFZP5JQG7iKOAwgW7F4y",       // Lily - 中文女声
  "chinese-female": "lD7eQp3sGq3b9fY8V7x9",
};

// 预设情绪配置
const ELEVENLABS_EMOTIONS: Record<string, { stability: number; similarityBoost: number; style: number; useSpeakerBoost: boolean }> = {
  "normal": { stability: 0.5, similarityBoost: 0.75, style: 0.0, useSpeakerBoost: true },
  "happy": { stability: 0.4, similarityBoost: 0.7, style: 0.3, useSpeakerBoost: true },
  "sad": { stability: 0.7, similarityBoost: 0.8, style: 0.2, useSpeakerBoost: true },
  "angry": { stability: 0.3, similarityBoost: 0.6, style: 0.5, useSpeakerBoost: true },
  "calm": { stability: 0.8, similarityBoost: 0.85, style: 0.1, useSpeakerBoost: true },
  "excited": { stability: 0.35, similarityBoost: 0.65, style: 0.6, useSpeakerBoost: true },
  "whisper": { stability: 0.6, similarityBoost: 0.9, style: 0.8, useSpeakerBoost: true },
  "radio": { stability: 0.55, similarityBoost: 0.75, style: 0.4, useSpeakerBoost: true },
};

async function synthesizeWithElevenLabs(text: string, voice: string = "rachel", emotion: string = "normal", apiKey?: string) {
  const client = getElevenLabsClient(apiKey);
  if (!client) {
    throw new Error("ElevenLabs API Key 未配置");
  }

  // 先查缓存
  const cached = getCache(text, `${voice}-${emotion}`, "elevenlabs");
  if (cached) {
    return cached;
  }

  const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES["rachel"];
  const emotionConfig = ELEVENLABS_EMOTIONS[emotion] || ELEVENLABS_EMOTIONS["normal"];

  console.log(`🎙️ ElevenLabs TTS: ${voice} (${emotion}), 文本: ${text.substring(0, 40)}...`);

  const audio = await client.generate({
    text: text,
    voice: voiceId,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: emotionConfig.stability,
      similarity_boost: emotionConfig.similarityBoost,
      style: emotionConfig.style,
      use_speaker_boost: emotionConfig.useSpeakerBoost,
    },
  });

  // 将流转换为 Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  const result = {
    audioBase64: audioBuffer.toString("base64"),
    provider: "elevenlabs",
    voice: voice,
    emotion: emotion,
    mimeType: "audio/mpeg",
  };

  // 写入缓存
  setCache(text, `${voice}-${emotion}`, "elevenlabs", result);

  console.log(`✅ ElevenLabs TTS 成功: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
  return result;
}

const execAsync = promisify(exec);

// TTS 缓存文件路径
const CACHE_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), "../../data/tts-cache.json");

// 缓存数据结构
interface TTSType {
  audioBase64: string;
  provider: string;
  voice: string;
  mimeType: string;
  cachedAt: string;
}

// 内存缓存 + 文件持久化
let memoryCache: Record<string, TTSType> = {};

// 加载缓存
function loadCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      memoryCache = JSON.parse(data);
      console.log(`📦 TTS 缓存已加载: ${Object.keys(memoryCache).length} 条记录`);
    }
  } catch (e) {
    console.warn("⚠️ 加载 TTS 缓存失败，使用空缓存:", (e as Error).message);
    memoryCache = {};
  }
}

// 保存缓存
function saveCache(): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2));
  } catch (e) {
    console.warn("⚠️ 保存 TTS 缓存失败:", (e as Error).message);
  }
}

// 生成缓存 key
function getCacheKey(text: string, voice: string, provider: string): string {
  const hash = crypto.createHash("md5").update(`${text}:${voice}:${provider}`).digest("hex");
  return hash;
}

// 获取缓存
function getCache(text: string, voice: string, provider: string): TTSType | null {
  const key = getCacheKey(text, voice, provider);
  return memoryCache[key] || null;
}

  // 设置缓存
function setCache(text: string, voice: string, provider: string, data: Omit<TTSType, 'cachedAt'>): void {
  const key = getCacheKey(text, voice, provider);
  memoryCache[key] = {
    ...data,
    cachedAt: new Date().toISOString(),
  } as TTSType;
  // 异步保存，不阻塞
  setImmediate(saveCache);
}

// 启动时加载缓存
loadCache();

// 可用的 Mac 中文语音 - 按音质排序
const MAC_VOICES: Record<string, string> = {
  "alloy": "Meijia",        // 美佳 - 温暖女声
  "echo": "Ting-Ting",     // 婷婷 - 标准女声
  "fable": "Reed",         // 深沉男声
  "onyx": "Eddy",          // 活力男声
  "nova": "Flo",           // 自然女声
  "shimmer": "Sandy",      // 清晰女声
  "elevenlabs-rachel": "Meijia",
  "elevenlabs-adam": "Eddy",
};

// Gemini TTS 可用语音 - 共30种
const GEMINI_VOICES: Record<string, string> = {
  "alloy": "Zephyr",       // Bright - 明亮
  "echo": "Puck",          // Upbeat - 活泼
  "fable": "Charon",       // Informative - 信息型
  "onyx": "Fenrir",        // Excitable - 兴奋
  "nova": "Kore",          // Firm - 坚定
  "shimmer": "Leda",       // Youthful - 年轻
  "zephyr": "Zephyr",
  "puck": "Puck",
  "charon": "Charon",
  "kore": "Kore",
  "fenrir": "Fenrir",
  "leda": "Leda",
  "orus": "Orus",
  "aoede": "Aoede",
  "callirrhoe": "Callirrhoe",
  "autonoe": "Autonoe",
  "enceladus": "Enceladus",
  "iapetus": "Iapetus",
  "umbriel": "Umbriel",
  "algieba": "Algieba",
  "despina": "Despina",
  "erinome": "Erinome",
  "algenib": "Algenib",
  "rasalgethi": "Rasalgethi",
  "laomedeia": "Laomedeia",
  "achernar": "Achernar",
  "alnilam": "Alnilam",
  "schedar": "Schedar",
  "gacrux": "Gacrux",
  "pulcherrima": "Pulcherrima",
};

// ========== MOSS-TTS-Nano Local TTS ==========
// MOSS-TTS-Nano - 0.1B parameters, CPU-friendly multilingual TTS
const MOSS_VOICES: Record<string, string> = {
  "default": "default",
};

// ========== Edge TTS (微软) ==========
// 完全免费，多语言支持，质量超好，不需要 API Key！
// 语音列表: https://speech.microsoft.com/portal/voicegallery
const EDGE_VOICE_MAP: Record<string, string> = {
  // ========== 🇭🇰 粤语 Cantonese ==========
  "hk-male": "zh-HK-WanLungNeural",      // 云龙 - 成熟男声
  "hk-female-1": "zh-HK-HiuGaaiNeural",  // 晓佳 - 温柔女声
  "hk-female-2": "zh-HK-HiuMaanNeural",   // 晓曼 - 亲切女声
  
  // ========== 🇨🇳 普通话 Chinese ==========
  "cn-female-1": "zh-CN-XiaoxiaoNeural", // 晓晓 - 亲切女声（推荐）
  "cn-female-2": "zh-CN-XiaoyiNeural",   // 晓伊 - 温柔女声
  "cn-male-1": "zh-CN-YunxiNeural",      // 云希 - 磁性男声
  "cn-male-2": "zh-CN-YunjianNeural",     // 云健 - 活力男声
  
  // ========== 🇺🇸 英语 English ==========
  "en-female-1": "en-US-AvaNeural",       // Ava - 自然女声
  "en-female-2": "en-US-EmmaNeural",      // Emma - 亲切女声
  "en-female-3": "en-US-AriaNeural",      // Aria - 专业女声
  "en-male-1": "en-US-AndrewNeural",      // Andrew - 自然男声
  "en-male-2": "en-US-BrianNeural",       // Brian - 活力男声
  
  // ========== 兼容旧版本别名 ==========
  "alloy": "zh-CN-XiaoxiaoNeural",        // 默认：普通话晓晓女声
  "nova": "zh-CN-XiaoxiaoNeural",
  "shimmer": "zh-CN-XiaoyiNeural",
  "echo": "zh-CN-YunxiNeural",
  "fable": "zh-CN-YunjianNeural",
  "onyx": "zh-CN-YunyangNeural",
};

// 根据语言自动选择合适的语音
function getVoiceForLanguage(voice: string, language?: string): string {
  // If voice is already a direct Microsoft Neural voice ID, use it as-is
  if (/^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(voice)) {
    return voice;
  }

  // 如果已经是特定语言的语音，直接返回
  if (voice.startsWith("hk-") || voice.startsWith("cn-") || voice.startsWith("en-")) {
    return EDGE_VOICE_MAP[voice] || EDGE_VOICE_MAP["alloy"];
  }

  // 根据语言自动选择
  if (language === "zh-HK") {
    // 粤语：根据原语音的性别选择对应的粤语语音
    const femaleVoices = ["alloy", "nova", "shimmer"];
    if (femaleVoices.includes(voice)) {
      return EDGE_VOICE_MAP["hk-female-1"]; // 晓佳女声
    } else {
      return EDGE_VOICE_MAP["hk-male"]; // 云龙男声
    }
  } else if (language === "en-US") {
    // 英语
    const femaleVoices = ["alloy", "nova", "shimmer"];
    if (femaleVoices.includes(voice)) {
      return EDGE_VOICE_MAP["en-female-1"]; // Ava
    } else {
      return EDGE_VOICE_MAP["en-male-1"]; // Andrew
    }
  } else {
    // 默认普通话
    return EDGE_VOICE_MAP[voice] || EDGE_VOICE_MAP["alloy"];
  }
}

async function synthesizeWithEdgeTTS(text: string, voice: string, language?: string) {
  const edgeVoice = getVoiceForLanguage(voice, language);
  
  // 缓存 key 需要包含语言信息
  const cacheKey = language ? `${voice}-${language}` : voice;
  
  // 先查缓存
  const cached = getCache(text, cacheKey, "edge");
  if (cached) {
    console.log(`📦 Edge TTS 命中缓存: ${text.substring(0, 20)}...`);
    return {
      ...cached,
      text,
      fallback: false,
    };
  }

  console.log(`🎙️ Edge TTS: ${edgeVoice} (语言: ${language || 'auto'}), 文本: ${text.substring(0, 40)}...`);

  // 创建临时文件
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobster-edge-tts-"));
  const mp3File = path.join(tempDir, "output.mp3");

  try {
    // 使用 Python edge-tts 命令行生成
    await execAsync(
      `/usr/bin/python3 -m edge_tts --voice "${edgeVoice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${mp3File}"`,
      { timeout: 30000 }
    );
    
    if (!fs.existsSync(mp3File)) {
      throw new Error("音频文件生成失败");
    }

    // 读取 MP3 文件
    const audioBuffer = fs.readFileSync(mp3File);
    const audioBase64 = audioBuffer.toString("base64");

    console.log(`✅ Edge TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

    const result = {
      provider: "edge",
      voice: edgeVoice,
      audioBase64,
      mimeType: "audio/mpeg",
      text,
      fallback: false,
    };

    // 写入缓存
    setCache(text, cacheKey, "edge", result);
    return result;
  } finally {
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

// 延时函数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== CosyVoice 本地 TTS ==========
// 支持 9 种语言 + 18 种方言，粤语质量天花板！
async function synthesizeWithCosyVoice(text: string, voice: string) {
  const apiUrl = process.env.COSYVOICE_API_URL || "http://localhost:50000";
  
  // 先查缓存
  const cached = getCache(text, voice, "cosyvoice");
  if (cached) {
    console.log(`📦 CosyVoice TTS 命中缓存: ${text.substring(0, 20)}...`);
    return {
      ...cached,
      text,
      fallback: false,
    };
  }

  console.log(`🎙️ CosyVoice TTS: 语音=${voice}, 文本: ${text.substring(0, 40)}...`);

  const response = await fetch(`${apiUrl}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      mode: "sft", // sft / zero_shot / cross_lingual / instruct
      voice,
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(`CosyVoice API error: ${response.status}`);
  }

  // 假设返回 WAV/MP3 音频二进制
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioBase64 = audioBuffer.toString("base64");

  console.log(`✅ CosyVoice TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

  const result = {
    provider: "cosyvoice",
    voice,
    audioBase64,
    mimeType: "audio/mpeg",
    text,
    fallback: false,
  };

  // 写入缓存
  setCache(text, voice, "cosyvoice", result);
  return result;
}

// MOSS-TTS-Nano 本地 TTS
// 0.1B parameters, runs on CPU, multilingual support
async function synthesizeWithMOSS(text: string, voice: string) {
  const apiUrl = process.env.MOSS_TTS_API_URL;

  // 先查缓存
  const cached = getCache(text, voice, "moss");
  if (cached) {
    console.log(`📦 MOSS TTS 命中缓存: ${text.substring(0, 20)}...`);
    return {
      ...cached,
      text,
      fallback: false,
    };
  }

  if (!apiUrl) {
    throw new Error("MOSS_TTS_API_URL not configured");
  }

  console.log(`🎙️ MOSS TTS: 语音=${voice}, 文本: ${text.substring(0, 40)}...`);

  // If voice is a direct demo ID (demo-N) use it, otherwise fall back to generic name mapping
  const GENERIC_FALLBACK: Record<string, string> = {
    "nova": "demo-2", "shimmer": "demo-2", "alloy": "demo-2",
    "echo": "demo-2", "fable": "demo-3", "onyx": "demo-2"
  };
  const selectedDemoId = /^demo-\d+$/.test(voice) ? voice : (GENERIC_FALLBACK[voice] || "demo-2");

  const formData = new FormData();
  formData.append("text", text);
  formData.append("demo_id", selectedDemoId); 
  formData.append("speed", "1.5");
  formData.append("volume", "1.5");     
  formData.append("enable_text_normalization", "0");
  formData.append("enable_normalize_tts_text", "1");
  // you can append more parameters if needed

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/generate`, {
    method: "POST",
    body: formData as any,
  });

  if (!response.ok) {
    throw new Error(`MOSS API error: ${response.status}`);
  }

  const jsonResponse = await response.json() as any;

  if (jsonResponse.error) {
    throw new Error(`MOSS API error: ${jsonResponse.error}`);
  }

  const audioBase64 = jsonResponse.audio_base64;

  console.log(`✅ MOSS TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

  const result = {
    provider: "moss",
    voice: MOSS_VOICES[voice] || MOSS_VOICES["default"],
    audioBase64,
    mimeType: "audio/wav",
    text,
    fallback: false,
  };

  // 写入缓存
  setCache(text, voice, "moss", result);
  return result;
}

// Gemini TTS 生成
async function synthesizeWithGemini(text: string, voice: string, retries: number = 2) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // 先查缓存
  const cached = getCache(text, voice, "gemini");
  if (cached) {
    console.log("[CACHE] Gemini TTS hit:", text.substring(0, 20), "...");
    return {
      ...cached,
      text,
      fallback: false,
    };
  }

  const geminiVoice = GEMINI_VOICES[voice] || "Zephyr";
  
  // 清理文本，移除可能导致 Gemini 报错的特殊字符
  const cleanedText = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[`~@#$%^&*_+={}\[\]|<>:"\\]/g, "")
    .trim();
  
  // 加上粤语提示，确保用 Cantonese 发音
  const cantonesePrompt = `请用纯正粤语朗读：${cleanedText}`;
  
  console.log(`🎙️ Gemini TTS (粤语): ${geminiVoice}, 文本: ${cleanedText.substring(0, 40)}...`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: cantonesePrompt }]
            }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: geminiVoice
                  }
                }
              }
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const result = await response.json() as any;
      const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioData) {
        throw new Error("No audio data in Gemini response");
      }

      // Gemini 返回 base64 编码的 PCM 数据 (s16le, 24kHz, mono)
      // 转换为 MP3
      const pcmBuffer = Buffer.from(audioData, 'base64');
      
      // 创建临时文件
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobster-gemini-tts-"));
      const pcmFile = path.join(tempDir, "audio.pcm");
      const mp3File = path.join(tempDir, "audio.mp3");
      
      fs.writeFileSync(pcmFile, pcmBuffer);
      
      // 使用 ffmpeg 将 PCM 转为 MP3
      await execAsync(
        `ffmpeg -f s16le -ar 24000 -ac 1 -i "${pcmFile}" -codec:a libmp3lame -qscale:a 2 "${mp3File}" -y 2>/dev/null`
      );
      
      if (!fs.existsSync(mp3File)) {
        throw new Error("MP3 conversion failed");
      }
      
      const mp3Buffer = fs.readFileSync(mp3File);
      const audioBase64 = mp3Buffer.toString('base64');
      
      // 清理临时文件
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
      
      console.log(`✅ Gemini TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);
      
      return {
        provider: "gemini",
        voice: geminiVoice,
        audioBase64,
        mimeType: "audio/mpeg",
        text: cleanedText,
        fallback: false
      };
    } catch (error) {
      if (attempt < retries) {
        console.warn(`⚠️ Gemini TTS 尝试 ${attempt + 1}/${retries + 1} 失败，${1000 * (attempt + 1)}ms 后重试:`, (error as Error).message);
        await delay(1000 * (attempt + 1));
      } else {
        console.error(`❌ Gemini TTS 全部 ${retries + 1} 次尝试都失败了:`, (error as Error).message);
        throw error;
      }
    }
  }
  
  // 理论上不会到这里
  throw new Error("Unexpected error in synthesizeWithGemini");
}

// 清理文本，移除可能导致 say 命令崩溃的特殊字符
function cleanTextForTTS(text: string): string {
  // 移除控制字符和可能导致 shell 问题的特殊字符
  let cleaned = text
    // 移除控制字符
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    // 替换可能导致 shell 问题的引号和特殊字符
    .replace(/"/g, "＂")
    .replace(/`/g, "＇")
    .replace(/\$/g, "＄")
    .replace(/\\/g, "＼")
    .replace(/!/g, "！")
    // 只保留中文、英文、数字和常用标点
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9，。！？、；：＂＂＂＂（）《》【】\s,.!?;:'"()\[\]]/g, "")
    // 清理多余空格
    .replace(/\s+/g, " ")
    .trim();
  
  // 如果清理后为空，用默认文本
  if (!cleaned) {
    cleaned = "为您播放音乐";
  }
  
  return cleaned;
}

// Mac say 命令 TTS
async function synthesizeWithMacSay(text: string, voice: string) {
  const selectedVoice = MAC_VOICES[voice || "alloy"] || "Meijia";
  const cleanedText = cleanTextForTTS(text);
  
  console.log(`🎙️ Mac TTS: ${selectedVoice}, 文本: ${cleanedText.substring(0, 40)}...`);

  // 创建临时文件
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobster-tts-"));
  const aiffFile = path.join(tempDir, "narration.aiff");
  const mp3File = path.join(tempDir, "narration.mp3");

  try {
    // 使用 say 命令生成音频 - 增加超时保护 10 秒
    const escapedText = cleanedText.replace(/"/g, '\\"');
    await execAsync(
      `say -v "${selectedVoice}" -o "${aiffFile}" "${escapedText}"`,
      { timeout: 10000 }
    );
    
    if (!fs.existsSync(aiffFile)) {
      throw new Error("音频文件生成失败");
    }

    // 使用 ffmpeg 转换为 MP3 - 增加超时保护 15 秒
    await execAsync(
      `ffmpeg -i "${aiffFile}" -codec:a libmp3lame -qscale:a 2 "${mp3File}" -y 2>/dev/null`,
      { timeout: 15000 }
    );
    
    if (!fs.existsSync(mp3File)) {
      throw new Error("MP3 转换失败");
    }

    // 读取 MP3 文件并转换为 base64
    const audioBuffer = fs.readFileSync(mp3File);
    const audioBase64 = audioBuffer.toString("base64");

    console.log(`✅ Mac TTS 成功: ${(audioBase64.length / 1024).toFixed(1)} KB`);

    const result = {
      provider: "macsay",
      voice: selectedVoice,
      audioBase64,
      mimeType: "audio/mpeg",
      text: cleanedText,
      fallback: false
    };
    
    // Mac TTS 也缓存，因为 ffmpeg 转码也有点慢
    setCache(text, voice, "macsay", result);
    return result;
  } finally {
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

export async function synthesizeSpeech(text: string, voice?: string, options?: { provider?: string; emotion?: string; apiKey?: string; language?: string }) {
  const defaultProvider = options?.provider || process.env.DEFAULT_TTS_PROVIDER || "edge";
  const selectedVoice = voice || "alloy";
  const emotion = options?.emotion || "normal";
  const language = options?.language;

  // ========== 第一步：先检查所有 provider 的缓存 ==========
  // 优先级: ElevenLabs → Edge → MOSS → CosyVoice → Gemini → Mac Say
  const providersToCheck = ["elevenlabs", "edge", "moss", "cosyvoice", "gemini", "macsay"];
  // 如果指定了 defaultProvider，把它放到最前面
  if (defaultProvider && !providersToCheck.includes(defaultProvider)) {
    providersToCheck.unshift(defaultProvider);
  } else if (defaultProvider && providersToCheck.includes(defaultProvider)) {
    // 把 defaultProvider 移到最前面
    const idx = providersToCheck.indexOf(defaultProvider);
    providersToCheck.splice(idx, 1);
    providersToCheck.unshift(defaultProvider);
  }

  for (const p of providersToCheck) {
    let cacheKey = selectedVoice;
    if (p === "elevenlabs") {
      cacheKey = `${selectedVoice}-${emotion}`;
    } else if (p === "edge" && language) {
      cacheKey = `${selectedVoice}-${language}`;
    }
    // moss doesn't need special cache key handling
    const cached = getCache(text, cacheKey, p);
    if (cached) {
      console.log(`📦 ${p} TTS 命中缓存: ${text.substring(0, 20)}...`);
      return {
        ...cached,
        text,
        fallback: false,
      };
    }
  }

  // ========== 第二步：按顺序尝试 provider ==========
  for (const p of providersToCheck) {
    try {
      if (p === "elevenlabs" && (options?.apiKey || process.env.ELEVENLABS_API_KEY)) {
        return await synthesizeWithElevenLabs(text, selectedVoice, emotion, options?.apiKey);
      } else if (p === "edge") {
        return await synthesizeWithEdgeTTS(text, selectedVoice, language);
      } else if (p === "moss" && process.env.MOSS_TTS_API_URL) {
        return await synthesizeWithMOSS(text, selectedVoice);
      } else if (p === "cosyvoice" && process.env.COSYVOICE_API_URL) {
        return await synthesizeWithCosyVoice(text, selectedVoice);
      } else if (p === "gemini" && process.env.GEMINI_API_KEY) {
        return await synthesizeWithGemini(text, selectedVoice);
      } else if (p === "macsay") {
        return await synthesizeWithMacSay(text, selectedVoice);
      }
    } catch (error) {
      console.warn(`⚠️ ${p} TTS 失败，自动降级:`, (error as Error).message);
    }
  }

  console.error(`❌ 所有 TTS 均失败`);
  return {
    provider: "fallback",
    voice: selectedVoice,
    audioBase64: null,
    mimeType: null,
    text,
    fallback: true
  };
}
