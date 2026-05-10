import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import type { Track, MoodOption } from "../types.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";

// 支持的音频格式
const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wma"
]);

// 简单的 Mood 匹配关键词
const MOOD_KEYWORDS: Record<MoodOption, string[]> = {
  Working: ["工作", "学习", "专注", "钢琴", "轻音乐", "纯音乐", "古典", "爵士", "jazz", "piano", "focus", "work"],
  Relaxing: ["放松", "治愈", "安静", "民谣", "chill", "relax", "calm", "peaceful", "soft", "温柔"],
  Exercising: ["运动", "健身", "跑步", "电音", "摇滚", "热血", "edm", "rock", "运动", "gym", "workout", "fast"],
  Party: ["派对", "蹦迪", "热闹", "流行", "抖音", "pop", "dance", "party", "remix", "动感"],
  Sleepy: ["睡眠", "睡前", "催眠", "安静", "sleep", "night", "quiet", "睡前", "摇篮曲"]
};

// 内存中的音乐库缓存
let musicLibraryCache: Track[] = [];
let lastScanTime = 0;
const SCAN_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

// 检测歌曲 Mood
function detectMood(filename: string): MoodOption[] {
  const lower = filename.toLowerCase();
  const moods: MoodOption[] = [];

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
      moods.push(mood as MoodOption);
    }
  }

  // 如果没有匹配到关键词，根据文件名特征智能分配
  if (moods.length === 0) {
    // 高 BPM / 快节奏特征词 → Exercising/Party
    const highEnergy = /fast|high|bpm|rock|edm|dance|remix|电音|摇滚|动感|蹦迪|热血/.test(lower);
    // 安静/夜晚/钢琴 → Sleepy
    const sleepy = /night|sleep|lullaby|quiet|soft|深夜|晚安|摇篮曲|安静/.test(lower);
    // 纯音乐/器乐 → Working
    const instrumental = /instrumental|piano|guitar|violin|纯音乐|钢琴|吉他|轻音乐/.test(lower);
    
    if (highEnergy) {
      moods.push(Math.random() > 0.5 ? "Exercising" : "Party");
    } else if (sleepy) {
      moods.push("Sleepy");
    } else if (instrumental) {
      moods.push("Working");
    } else {
      // 随机分散到 Working 和 Relaxing
      moods.push(Math.random() > 0.3 ? "Relaxing" : "Working");
    }
  }

  return moods;
}

// 递归扫描目录
async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // 跳过隐藏目录
        if (!entry.name.startsWith(".")) {
          const subFiles = await scanDirectory(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (e) {
    console.warn("Failed to scan directory:", dirPath, e);
  }

  return files;
}

// 读取简单的文件信息（暂时不用复杂的 ID3 解析库，用文件名推断）
async function parseTrack(filePath: string): Promise<Track> {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);

  // 尝试从文件名解析：艺术家 - 标题
  let artist = "未知艺术家";
  let title = nameWithoutExt;
  let album = path.basename(path.dirname(filePath));

  // 去除歌曲序号前缀，如 "01  歌名" → "歌名"
  const cleanName = nameWithoutExt.replace(/^\d+\s+/, "");

  if (cleanName.includes(" - ")) {
    const parts = cleanName.split(" - ");
    artist = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  } else if (cleanName.includes("-")) {
    const parts = cleanName.split("-");
    artist = parts[0].trim();
    title = parts.slice(1).join("-").trim();
  } else {
    title = cleanName;
  }

  const moods = detectMood(filename + " " + artist + " " + title);

  // 简单的能量值估算
  const isHighEnergy = moods.includes("Exercising") || moods.includes("Party");
  const isLowEnergy = moods.includes("Sleepy");
  const energy = isHighEnergy ? 85 : isLowEnergy ? 25 : 50;

  // 获取后端地址
  const backendPort = process.env.PORT || "4000";
  const backendHost = process.env.BACKEND_HOST || "http://localhost";
  const baseUrl = `${backendHost}:${backendPort}`;

  // 用完整文件名做 hash，避免 ID 重复
  const filePathBase64 = Buffer.from(filePath).toString("base64url");
  const fileHash = filePathBase64.slice(-16);
  return {
    id: `local-${fileHash}`,
    title,
    artist,
    album,
    previewUrl: `${baseUrl}/api/library/stream/${filePathBase64}`,
    artwork: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=500&q=80",
    moodTags: [...moods, "local", "本地"],
    energy,
    explanation: `来自你的本地音乐库：${filename}`,
    source: "local" as any
  };
}

// 扫描并重建音乐库
export async function scanMusicLibrary(force = false): Promise<Track[]> {
  const secrets = await resolveRuntimeSecrets();

  // 如果没有配置本地音乐路径，返回空
  if (!secrets.localMusicPath) {
    return [];
  }

  // 检查缓存
  const now = Date.now();
  if (!force && musicLibraryCache.length > 0 && now - lastScanTime < SCAN_CACHE_TTL) {
    return musicLibraryCache;
  }

  try {
    await fs.access(secrets.localMusicPath);
  } catch {
    console.warn("Local music path not accessible:", secrets.localMusicPath);
    return [];
  }

  const files = await scanDirectory(secrets.localMusicPath);
  const tracks: Track[] = [];

  for (const file of files) {
    try {
      const track = await parseTrack(file);
      tracks.push(track);
    } catch (e) {
      console.warn("Failed to parse track:", file, e);
    }
  }

  musicLibraryCache = tracks;
  lastScanTime = now;

  console.log(`Scanned local music library: ${tracks.length} tracks found`);
  return tracks;
}

// 根据 ID 获取本地歌曲
export async function getLocalTrackById(id: string): Promise<Track | undefined> {
  const library = await scanMusicLibrary();
  return library.find((track) => track.id === id);
}

// 按 Mood 获取本地歌曲
export async function getLocalTracksByMood(mood: MoodOption): Promise<Track[]> {
  const library = await scanMusicLibrary();
  return library.filter((track) => track.moodTags.includes(mood));
}

// 获取音频流
export function getAudioStream(filePath: string) {
  return createReadStream(filePath);
}

// 获取音乐库统计
export async function getLibraryStats() {
  const library = await scanMusicLibrary();
  return {
    total: library.length,
    byMood: {
      Working: library.filter((t) => t.moodTags.includes("Working")).length,
      Relaxing: library.filter((t) => t.moodTags.includes("Relaxing")).length,
      Exercising: library.filter((t) => t.moodTags.includes("Exercising")).length,
      Party: library.filter((t) => t.moodTags.includes("Party")).length,
      Sleepy: library.filter((t) => t.moodTags.includes("Sleepy")).length
    }
  };
}
