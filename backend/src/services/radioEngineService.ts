import { StreamDJAgent } from "lobster-radio-agents";
import { getPlayHistory, getRuntimeSettings, getAestheticDna } from "./storageService.js";
import { scanMusicLibrary } from "./musicLibraryService.js";
import { synthesizeSpeech } from "./ttsService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
import { agentPlayer } from "./agentPlayerService.js";
import { getSongWiki } from "./wikiService.js";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Pulse-X 专属电台身份
const PULSE_X_IDENTITY = {
  name: "Pulse-X",
  englishName: "Pulse-X",
  programName: "共振频率",
  englishProgramName: "Resonance Frequency",
  persona: "Gordon 的共振内核，一名穿梭在数字废墟与情感脉冲之间的破障者",
  englishPersona: "Gordon's resonance core, a breacher traversing digital ruins and emotional pulses"
};

const streamDJ = new StreamDJAgent(PULSE_X_IDENTITY);
let currentThemeContext: any = null;
const recentlyPlayedIds = new Set<string>();

function getLocalPathFromUrl(previewUrl: string): string | null {
    if (!previewUrl) return null;
    try {
        if (previewUrl.startsWith('/api/library/stream/')) {
            const b64 = previewUrl.split("/stream/")[1];
            return Buffer.from(b64, "base64url").toString();
        }
        return previewUrl;
    } catch (e) { return null; }
}

/**
 * Pulse-X: 深度对位电台引擎
 */
export async function fetchNextRadioSegment() {
  const secrets = await resolveRuntimeSecrets();
  const settings = await getRuntimeSettings();
  const dna = await getAestheticDna();
  
  // 1. 获取并验证本地库
  const rawLocalTracks = await scanMusicLibrary();
  const validLocalTracks = rawLocalTracks.filter(t => {
      const realPath = getLocalPathFromUrl(t.previewUrl || "");
      return realPath && fs.existsSync(realPath);
  });

  // 2. 精准选词：从库里随机抓 15 首候选，交给 LLM 钦点
  const candidates = validLocalTracks
    .filter(t => !recentlyPlayedIds.has(t.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 15);
  
  const candidateList = candidates.map(c => `${c.artist} - ${c.title}`).join(", ");

  // 3. 调用 StreamDJ 生成主题（强制从候选名单中选）
  const playlistResp = await streamDJ.generatePlaylist(
    `候选信号列表: [${candidateList}]. 请从中选出 1 首最契合当前 DNA ${JSON.stringify(dna?.spectralMap)} 的信号。`, 
    "zh-CN", "classic", currentThemeContext || undefined, 1
  );

  const selectedTitle = playlistResp.songs[0].title;
  const targetTrack = candidates.find(t => selectedTitle.includes(t.title) || t.title.includes(selectedTitle)) || candidates[0];

  recentlyPlayedIds.add(targetTrack.id);
  if (recentlyPlayedIds.size > 50) recentlyPlayedIds.delete(recentlyPlayedIds.values().next().value);

  // 4. 获取 Wiki 深度素材
  const wiki = await getSongWiki(targetTrack.id);
  const trackInfo = {
    title: targetTrack.title,
    artist: targetTrack.artist,
    album: targetTrack.album,
    releaseYear: wiki?.releaseYear,
    composer: wiki?.composer,
    lyricist: wiki?.lyricist,
    hotComments: wiki?.hotComments?.slice(0, 3),
    trivia: wiki?.trivia?.[0]
  };

  // 5. 生成「电台级别」的旁白
  const narrationResp = await streamDJ.generateNarrationForTrack(
    trackInfo,
    playlistResp.theme_update,
    "zh-CN",
    "night" // 强制使用深夜治愈模式，更具质感
  );

  const dj_talk = narrationResp.dj_talk;
  currentThemeContext = narrationResp.theme_update;

  // 6. TTS & 注入播放器
  const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: secrets.openAiApiKey,
    language: "zh-CN"
  });

  if (ttsResult.audioBase64) {
    const tmpFile = path.join(os.tmpdir(), `pulse_v_${Date.now()}.mp3`);
    await fsp.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    // 注入播放器
    agentPlayer.add(tmpFile, `🎙️: ${dj_talk}`);
  }

  const finalPath = getLocalPathFromUrl(targetTrack.previewUrl);
  if (finalPath) {
    agentPlayer.add(finalPath, `${targetTrack.artist} - ${targetTrack.title}`, targetTrack.id);
  }

  return { track: targetTrack, dj_talk };
}
