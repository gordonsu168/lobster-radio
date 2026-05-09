
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";

const execAsync = promisify(exec);

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

// 延时函数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Gemini TTS 生成
async function synthesizeWithGemini(text: string, voice: string, retries: number = 2) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
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

    return {
      provider: "mac-say",
      voice: selectedVoice,
      audioBase64,
      mimeType: "audio/mpeg",
      text: cleanedText,
      fallback: false
    };
  } finally {
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

export async function synthesizeSpeech(text: string, voice?: string) {
  const provider = process.env.DEFAULT_TTS_PROVIDER || "mac-say";
  const selectedVoice = voice || "alloy";
  
  // 首先尝试配置的 provider
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      return await synthesizeWithGemini(text, selectedVoice);
    } catch (error) {
      console.warn(`⚠️ Gemini TTS 失败，自动降级到 mac-say:`, (error as Error).message);
      // fall through to mac-say
    }
  }
  
  // 尝试 mac-say
  try {
    return await synthesizeWithMacSay(text, selectedVoice);
  } catch (error) {
    console.error(`❌ Mac-say TTS 也失败了:`, (error as Error).message);
    
    return {
      provider: "fallback",
      voice: selectedVoice,
      audioBase64: null,
      mimeType: null,
      text,
      fallback: true
    };
  }
}
