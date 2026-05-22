import { StreamDJAgent, LobsterCoreXAgent } from "lobster-radio-agents";
import { getPlayHistory, getRuntimeSettings, getAestheticDna } from "./storageService.js";
import { scanMusicLibrary } from "./musicLibraryService.js";
import { synthesizeSpeech } from "./ttsService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
import { agentPlayer } from "./agentPlayerService.js";
import { searchTracksByMood } from "./neteaseService.js";
import { getSongWiki } from "./wikiService.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// 定义 Pulse-X 的电台身份
const PULSE_X_IDENTITY = {
  name: "Pulse-X",
  englishName: "Pulse-X",
  programName: "共振频率",
  englishProgramName: "Resonance Frequency",
  persona: "Gordon 的共振内核，潜伏在数字深渊中的破障者",
  englishPersona: "Gordon's resonance core, a breacher lurking in the digital abyss"
};

const streamDJ = new StreamDJAgent(PULSE_X_IDENTITY);
let currentThemeContext: any = null;
const recentlyPlayedIds = new Set<string>(["netease-buildin-1"]);

/**
 * Pulse-X: 深度电台引擎 (共振流)
 * 采用 StreamDJAgent 策略生成具有温度和深度的旁白
 */
export async function fetchNextRadioSegment() {
  const secrets = await resolveRuntimeSecrets();
  const settings = await getRuntimeSettings();
  const dna = await getAestheticDna();
  
  // 1. 获取本地库 (确保只取有 URL 的)
  const localTracks = (await scanMusicLibrary()).filter(t => t.previewUrl);
  
  // 2. LLM 编排主题和选歌
  const playlistResp = await streamDJ.generatePlaylist(
    `当前 DNA 频谱偏好: ${JSON.stringify(dna?.spectralMap)}.  Gordon 的审美精度: ${(dna?.evolution?.precision || 0).toFixed(4)}. 严禁推荐《城南花已开》。`, 
    "zh-CN", 
    "trivia", 
    currentThemeContext || undefined, 
    1
  );

  let recommendedSong = playlistResp.songs[0];
  let targetTrack: any = null;
  let isUnderground = false;

  // 3. 寻找信号源
  targetTrack = localTracks.find(t => 
    !recentlyPlayedIds.has(t.id) && (
      recommendedSong.title.toLowerCase() === t.title.toLowerCase() ||
      t.title.toLowerCase().includes(recommendedSong.title.toLowerCase())
    )
  );

  if (!targetTrack) {
    try {
      const ncmTracks = await searchTracksByMood("Relaxing");
      const candidates = ncmTracks.filter(t => t.previewUrl && !recentlyPlayedIds.has(t.id));
      targetTrack = candidates[Math.floor(Math.random() * candidates.length)];
      isUnderground = true;
    } catch (e) {}
  }

  // 兜底
  if (!targetTrack) targetTrack = localTracks[Math.floor(Math.random() * localTracks.length)] || localTracks[0];

  recentlyPlayedIds.add(targetTrack.id);
  if (recentlyPlayedIds.size > 30) recentlyPlayedIds.delete(recentlyPlayedIds.values().next().value);

  // 4. 获取歌曲百科信息，用于丰富旁白内容
  const wiki = await getSongWiki(targetTrack.id);
  const trackInfo = {
    title: targetTrack.title,
    artist: targetTrack.artist,
    album: targetTrack.album,
    releaseYear: wiki?.releaseYear,
    composer: wiki?.composer,
    lyricist: wiki?.lyricist,
    hotComments: wiki?.hotComments?.slice(0, 3),
    trivia: wiki?.trivia?.[0],
    explanation: targetTrack.explanation
  };

  // 5. 使用 StreamDJAgent 策略生成旁白
  const narrationResp = await streamDJ.generateNarrationForTrack(
    trackInfo,
    playlistResp.theme_update,
    "zh-CN",
    "trivia"
  );

  const dj_talk = narrationResp.dj_talk;
  currentThemeContext = narrationResp.theme_update;

  // 6. TTS & 注入
  const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: secrets.openAiApiKey,
    language: "zh-CN"
  });

  if (ttsResult.audioBase64) {
    const tmpFile = path.join(os.tmpdir(), `v_${Date.now()}.mp3`);
    await fs.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    agentPlayer.add(tmpFile, `🎙️: ${dj_talk}`);
  }

  let finalPath = targetTrack.previewUrl;
  if (finalPath.startsWith('/api')) {
      const b64 = finalPath.split("/stream/")[1];
      finalPath = Buffer.from(b64, "base64url").toString();
  }
  
  agentPlayer.add(finalPath, targetTrack.title);

  return { track: targetTrack, dj_talk };
}
