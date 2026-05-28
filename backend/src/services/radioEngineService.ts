import { StreamDJAgent } from "lobster-radio-agents";
import { getPlayHistory, getRuntimeSettings, getAestheticDna } from "./storageService.js";
import { scanMusicLibrary } from "./musicLibraryService.js";
import { synthesizeSpeech } from "./ttsService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
import { agentPlayer } from "./agentPlayerService.js";
import { getSongWiki } from "./wikiService.js";
import { getCachedUserState } from "./userStateMonitor.js";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// DJ-X 专属电台身份
const DJ_X_IDENTITY = {
  name: "DJ-X",
  englishName: "DJ-X",
  programName: "共振频率",
  englishProgramName: "Resonance Frequency",
  persona: "Gordon 的共振内核，一名穿梭在数字废墟与情感脉冲之间的破障者",
  englishPersona: "Gordon's resonance core, a breacher traversing digital ruins and emotional pulses"
};

const streamDJ = new StreamDJAgent(DJ_X_IDENTITY);
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

let isFetching = false;

/**
 * DJ-X: 深度对位电台引擎
 */
export async function fetchNextRadioSegment() {
  if (isFetching) {
    console.error("⚠️ [RADIO_ENGINE] 已经在获取中，跳过重复请求。");
    return { track: null, dj_talk: null };
  }
  isFetching = true;

  try {
    const secrets = await resolveRuntimeSecrets();
    const settings = await getRuntimeSettings();
    const dna = await getAestheticDna();
    
    // 1. 获取并验证本地库
    const rawLocalTracks = await scanMusicLibrary();
    const validLocalTracks = rawLocalTracks.filter(t => {
        const realPath = getLocalPathFromUrl(t.previewUrl || "");
        return realPath && fs.existsSync(realPath);
    });

    if (validLocalTracks.length === 0) {
        console.error("❌ [RADIO_ENGINE] 曲库为空或路径无效。");
        return { track: null, dj_talk: null };
    }

    // 2. 精准选词：从库里随机抓 15 首候选，交给 LLM 钦点
    const candidates = validLocalTracks
      .filter(t => !recentlyPlayedIds.has(t.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);
    
    // 如果候选太少，放宽限制
    const finalCandidates = candidates.length > 0 ? candidates : validLocalTracks.slice(0, 15);
    const candidateList = finalCandidates.map(c => `${c.artist} - ${c.title}`).join(", ");

    // 3. 调用 StreamDJ 生成主题（强制从候选名单中选）
    const userState = getCachedUserState();
    const userStateDesc = userState
      ? `听众当前状态: ${userState.label}，${userState.dayOfWeek} ${userState.timeOfDay}。`
      : "";

    const playlistResp = await streamDJ.generatePlaylist(
      `${userStateDesc}候选信号列表: [${candidateList}]. 请从中选出 1 首最契合当前 DNA ${JSON.stringify(dna?.spectralMap)} 的信号。`,
      "zh-CN", "classic", currentThemeContext || undefined, 1
    );

    const selectedTitle = playlistResp.songs[0].title;
    const selectedArtist = playlistResp.songs[0].artist;
    
    // 优先匹配标题和艺术家
    let targetTrack = finalCandidates.find(t => 
      (t.title.toLowerCase().includes(selectedTitle.toLowerCase()) || selectedTitle.toLowerCase().includes(t.title.toLowerCase())) &&
      (t.artist.toLowerCase().includes(selectedArtist.toLowerCase()) || selectedArtist.toLowerCase().includes(t.artist.toLowerCase()))
    );

    // 如果没匹配到，退而求其次只匹配标题
    if (!targetTrack) {
        targetTrack = finalCandidates.find(t => t.title.toLowerCase().includes(selectedTitle.toLowerCase()) || selectedTitle.toLowerCase().includes(t.title.toLowerCase()));
    }

    // 还没匹配到，用第一个
    if (!targetTrack) targetTrack = finalCandidates[0];

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
      "night", // 强制使用深夜治愈模式，更具质感
      userState ? `${userState.label}，${userState.dayOfWeek} ${userState.timeOfDay}` : undefined
    );

    const dj_talk = narrationResp.dj_talk;
    currentThemeContext = narrationResp.theme_update;

    // 立即将旁白输出到 stderr，以便 CLI 用户能看到
    console.error(`\n\x1b[38;5;11m【DJ-X 信号对焦】\x1b[0m ${dj_talk}\n`);
    console.error(`\x1b[38;5;82m【即将播放】\x1b[0m ${targetTrack.artist} - ${targetTrack.title}\n`);

    // 6. TTS & 准备注入
    const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
      provider: settings.defaultTtsProvider,
      apiKey: secrets.openAiApiKey,
      language: "zh-CN"
    });

    let narrationFile: string | null = null;
    if (ttsResult.audioBase64) {
      narrationFile = path.join(os.tmpdir(), `dj_v_${Date.now()}.mp3`);
      await fsp.writeFile(narrationFile, Buffer.from(ttsResult.audioBase64, 'base64'));
    }

    const finalPath = getLocalPathFromUrl(targetTrack.previewUrl);
    
    // 【关键】同步连续注入，确保旁白和歌曲紧邻，中间不被其他并发请求插入
    if (narrationFile) {
      agentPlayer.add(narrationFile, `🎙️: ${dj_talk}`);
    }
    if (finalPath) {
      agentPlayer.add(finalPath, `${targetTrack.artist} - ${targetTrack.title}`, targetTrack.id);
    }

    return { track: targetTrack, dj_talk };
  } finally {
    isFetching = false;
  }
}
