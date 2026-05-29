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

const DJ_X_IDENTITY = {
  name: "DJ-X",
  englishName: "DJ-X",
  programName: "共振频率",
  englishProgramName: "Resonance Frequency",
  persona: "Gordon 的共振内核，深夜电台主持人",
  englishPersona: "Gordon's resonance core, late-night radio DJ"
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

export async function fetchNextRadioSegment() {
  if (isFetching) return { track: null, dj_talk: null };
  isFetching = true;

  try {
    const secrets = await resolveRuntimeSecrets();
    const settings = await getRuntimeSettings();
    const dna = await getAestheticDna();
    
    const rawLocalTracks = await scanMusicLibrary();
    const validLocalTracks = rawLocalTracks.filter(t => {
        const realPath = getLocalPathFromUrl(t.previewUrl || "");
        return realPath && fs.existsSync(realPath);
    });

    if (validLocalTracks.length === 0) return { track: null, dj_talk: null };

    const candidates = validLocalTracks
      .filter(t => !recentlyPlayedIds.has(t.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);
    
    const finalCandidates = candidates.length > 0 ? candidates : validLocalTracks.slice(0, 15);
    const candidateList = finalCandidates.map(c => `${c.artist} - ${c.title}`).join(", ");

    const playlistResp = await streamDJ.generatePlaylist(
      `候选列表: [${candidateList}]。请选一首契合 DNA 的信号。`,
      "zh-CN", "classic", currentThemeContext || undefined, 1
    );

    const selectedSong = playlistResp.songs[0];
    let targetTrack = finalCandidates.find(t => 
      t.title.toLowerCase().includes(selectedSong.title.toLowerCase()) || 
      selectedSong.title.toLowerCase().includes(t.title.toLowerCase())
    );

    if (!targetTrack) targetTrack = finalCandidates[0];
    recentlyPlayedIds.add(targetTrack.id);

    const wiki = await getSongWiki(targetTrack.id);
    const narrationResp = await streamDJ.generateNarrationForTrack(
      { ...targetTrack, releaseYear: wiki?.releaseYear, trivia: wiki?.trivia?.[0] },
      playlistResp.theme_update as any,
      "zh-CN", "night"
    );

    const dj_talk = narrationResp.dj_talk;
    currentThemeContext = narrationResp.theme_update;

    const ttsResult: any = await synthesizeSpeech(dj_talk, settings.defaultVoice, {
      provider: settings.defaultTtsProvider,
      apiKey: secrets.openAiApiKey,
      language: "zh-CN"
    });

    if (ttsResult.audioBase64) {
      const voicePath = path.join(os.tmpdir(), `dj_v_${Date.now()}.mp3`);
      await fsp.writeFile(voicePath, Buffer.from(ttsResult.audioBase64, 'base64'));
      // 1. 先加旁白
      agentPlayer.addVoice(voicePath, dj_talk);
    }

    const musicPath = getLocalPathFromUrl(targetTrack.previewUrl || "") || "";
    // 2. 再加音乐
    agentPlayer.addMusic(musicPath, `${targetTrack.artist} - ${targetTrack.title}`, targetTrack.id);

    return { track: targetTrack, dj_talk };
  } finally {
    isFetching = false;
  }
}
