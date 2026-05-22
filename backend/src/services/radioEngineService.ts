import { StreamDJAgent, LobsterCoreXAgent } from "lobster-radio-agents";
import { getPlayHistory, getRuntimeSettings, getAestheticDna } from "./storageService.js";
import { scanMusicLibrary } from "./musicLibraryService.js";
import { synthesizeSpeech } from "./ttsService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
import { agentPlayer } from "./agentPlayerService.js";
import { searchTracksByMood } from "./neteaseService.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const streamDJ = new StreamDJAgent();
let currentThemeContext: any = null;
const recentlyPlayedIds = new Set<string>();

export async function fetchNextRadioSegment() {
  const secrets = await resolveRuntimeSecrets();
  const settings = await getRuntimeSettings();
  const dna = await getAestheticDna();
  
  // 1. 获取本地库 (确保只取有 URL 的)
  const localTracks = (await scanMusicLibrary()).filter(t => t.previewUrl);
  
  // 2. LLM 编排 (强力负向引导)
  const playlistResp = await streamDJ.generatePlaylist(
    `当前 DNA: ${JSON.stringify(dna?.spectralMap)}. 种子: ${Math.random()}. 严禁推荐《城南花已开》。`, 
    "zh-CN", 
    "trivia", 
    currentThemeContext || undefined, 
    1
  );

  let recommendedSong = playlistResp.songs[0];
  let targetTrack: any = null;

  // 3. 信号寻找算法：本地优先
  targetTrack = localTracks.find(t => 
    !recentlyPlayedIds.has(t.id) && (
      recommendedSong.title.toLowerCase().includes(t.title.toLowerCase()) || 
      t.title.toLowerCase().includes(recommendedSong.title.toLowerCase())
    )
  );

  // 如果本地没找到 LLM 想听的那首，不要去翻模拟库，直接从 408 首歌里随机挑一首
  if (!targetTrack) {
    const fallbackPool = localTracks.filter(t => !recentlyPlayedIds.has(t.id));
    targetTrack = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || localTracks[0];
  }

  recentlyPlayedIds.add(targetTrack.id);
  if (recentlyPlayedIds.size > 30) recentlyPlayedIds.delete(recentlyPlayedIds.values().next().value);

  // 4. 生成旁白
  const pureAgent = new LobsterCoreXAgent(dna);
  // 核心：强制不复读，强制不提城南
  const prompt = ` Gordon 正在听电台。曲目:《${targetTrack.title}》 - ${targetTrack.artist}。写一段 15 字内的冷峻黑客旁白。禁止提及任何关于“花”或“城南”的内容。禁止复读之前的回复。`;
  
  const logs = await pureAgent.chat(prompt);
  const dj_talk = logs.find(l => l.type === 'message')?.content || "信号锁定，开始注入。";

  // 5. TTS & 注入
  const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
    provider: settings.defaultTtsProvider,
    apiKey: secrets.openAiApiKey,
    language: "zh-CN"
  });

  currentThemeContext = playlistResp.theme_update;

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
