import { StreamDJAgent } from "lobster-radio-agents";
import { getPlayHistory, getRuntimeSettings } from "./storageService.js";
import { scanMusicLibrary } from "./musicLibraryService.js";
import { synthesizeSpeech } from "./ttsService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
import { agentPlayer } from "./agentPlayerService.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const streamDJ = new StreamDJAgent();
let currentThemeContext: any = null;

/**
 * 核心电台引擎：对接 http://localhost:5173/stream 的逻辑核心
 */
export async function fetchNextRadioSegment() {
  const secrets = await resolveRuntimeSecrets();
  const settings = await getRuntimeSettings();
  
  // 1. 获取本地库作为上下文
  const localTracks = await scanMusicLibrary();
  const libraryContext = `Gordon 的本地曲库中包含 ${localTracks.length} 首高质量信号碎片。`;

  // 2. 调用 StreamDJ 生成具有“黑客主题”的播放计划
  process.stderr.write("[ENGINE] 🧬 正在通过 LLM 编排审美路径...\n");
  const playlistResp = await streamDJ.generatePlaylist(
    libraryContext, 
    "zh-CN", 
    "classic", 
    currentThemeContext || undefined, 
    1
  );

  const recommendedSong = playlistResp.songs[0];
  // 模糊匹配寻找本地路径
  const track = localTracks.find(t => 
    recommendedSong.title.toLowerCase().includes(t.title.toLowerCase()) || 
    t.title.toLowerCase().includes(recommendedSong.title.toLowerCase())
  ) || localTracks[Math.floor(Math.random() * localTracks.length)];

  // 3. 生成黑客旁白
  process.stderr.write(`[ENGINE] 🎙️ 正在为频率《${track.title}》生成破障台本...\n`);
  const narrationResp = await streamDJ.generateNarrationForTrack(
    { title: track.title, artist: track.artist, album: track.album },
    playlistResp.theme_update,
    "zh-CN",
    "classic"
  );

  // 4. TTS 物理合成
  const ttsResult: any = await synthesizeSpeech(narrationResp.dj_talk, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: secrets.openAiApiKey,
    language: "zh-CN"
  });

  // 5. 更新上下文
  currentThemeContext = narrationResp.theme_update;

  // 6. 顺序注入全局播放器
  if (ttsResult.audioBase64) {
    const tmpFile = path.join(os.tmpdir(), `x_narration_${Date.now()}.mp3`);
    await fs.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    agentPlayer.add(tmpFile, "🎙️ LOBSTER-VOICE (Live)");
  }

  if (track.previewUrl) {
    let finalPath = track.previewUrl;
    if (track.previewUrl.startsWith('/api')) {
        const b64 = track.previewUrl.split("/stream/")[1];
        finalPath = Buffer.from(b64, "base64url").toString();
    }
    agentPlayer.add(finalPath, track.title);
  }

  return { track, dj_talk: narrationResp.dj_talk };
}
