import { StreamDJAgent, LobsterCoreXAgent } from "lobster-radio-agents";
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

const streamDJ = new StreamDJAgent();
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
 * Pulse-X: 本地根基电台引擎
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

  if (validLocalTracks.length === 0) throw new Error("本地频率库空竭。");

  // 2. LLM 编排：告诉 Agent 只准从本地库选歌
  const librarySummary = `Gordon 的本地曲库中有 ${validLocalTracks.length} 首歌。请仅从这些本地资源中编排主题。`;
  const playlistResp = await streamDJ.generatePlaylist(
    `当前 DNA: ${JSON.stringify(dna?.spectralMap)}. ${librarySummary}`, 
    "zh-CN", "trivia", currentThemeContext || undefined, 1
  );

  let recommendedSong = playlistResp.songs[0];
  let targetTrack: any = null;

  // 3. 寻找本地匹配项
  targetTrack = validLocalTracks.find(t => 
    !recentlyPlayedIds.has(t.id) && (
      recommendedSong.title.toLowerCase().includes(t.title.toLowerCase()) || 
      t.title.toLowerCase().includes(recommendedSong.title.toLowerCase())
    )
  );

  // 4. 本地相关性回退：如果 LLM 幻觉了库里没有的歌，随机抓一首本地非重复曲目
  if (!targetTrack) {
    const fallbackPool = validLocalTracks.filter(t => !recentlyPlayedIds.has(t.id));
    targetTrack = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || validLocalTracks[0];
  }

  recentlyPlayedIds.add(targetTrack.id);
  if (recentlyPlayedIds.size > 50) recentlyPlayedIds.delete(recentlyPlayedIds.values().next().value);

  // 5. 获取 Wiki 信息以丰富旁白
  const wiki = await getSongWiki(targetTrack.id);
  const trackInfo = {
    title: targetTrack.title,
    artist: targetTrack.artist,
    album: targetTrack.album,
    releaseYear: wiki?.releaseYear,
    hotComments: wiki?.hotComments?.slice(0, 3),
    trivia: wiki?.trivia?.[0]
  };

  // 6. 生成具有温度的旁白
  const pureAgent = new LobsterCoreXAgent(dna);
  const narrationPrompt = ` Gordon 正在听电台。当前是【本地根基】模式。曲目:《${targetTrack.title}》。请生成一段 20 字内的、体现审美共鸣的冷峻旁白。`;
  const logs = await pureAgent.chat(narrationPrompt);
  const dj_talk = logs.find(l => l.type === 'message')?.content || "接入根基频率。";

  // 7. TTS 注入
  const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: secrets.openAiApiKey,
    language: "zh-CN"
  });

  currentThemeContext = playlistResp.theme_update;

  if (ttsResult.audioBase64) {
    const tmpFile = path.join(os.tmpdir(), `pulse_v_${Date.now()}.mp3`);
    await fsp.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    agentPlayer.add(tmpFile, `🎙️: ${dj_talk}`);
  }

  // 8. 物理路径注入
  const finalPath = getLocalPathFromUrl(targetTrack.previewUrl);
  if (finalPath) agentPlayer.add(finalPath, targetTrack.title);

  return { track: targetTrack, dj_talk };
}
