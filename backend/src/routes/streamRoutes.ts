import { Router } from "express";
import { StreamDJAgent } from "lobster-radio-agents";
import { getSongWiki, searchWiki } from "../services/wikiService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getRuntimeSettings } from "../services/storageService.js";
import type { Track } from "../types.js";
import type { SongWiki } from "../services/wikiService.js";

export const streamRouter = Router();
const streamDJ = new StreamDJAgent();

// ── Server-side playlist state ──
let currentPlaylist: Track[] = [];
let playedTrackIds = new Set<string>();
const MAX_PLAYED_HISTORY = 50;

type ThemePhase = "intro" | "deep_dive" | "reflection" | "twist" | "outro";
let currentTheme: { theme: string; phase: ThemePhase; coveredTopics: string[]; segmentIndex: number } | null = null;

// ── Helpers ──

function trackPlayed(id: string) {
  playedTrackIds.add(id);
  if (playedTrackIds.size > MAX_PLAYED_HISTORY) {
    const first = playedTrackIds.values().next().value;
    if (first) playedTrackIds.delete(first);
  }
}

async function buildLibraryContext(): Promise<string> {
  const { scanMusicLibrary: scanLib } = await import("../services/musicLibraryService.js");
  try {
    const allTracks = await scanLib();
    // Exclude recently played songs from context to encourage variety
    const availableTracks = allTracks.filter(t => !playedTrackIds.has(t.id));
    
    const artistCounts: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};
    for (const t of availableTracks) {
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
      for (const m of t.moodTags) {
        if (["Working", "Relaxing", "Exercising", "Party", "Sleepy"].includes(m)) {
          moodCounts[m] = (moodCounts[m] || 0) + 1;
        }
      }
    }
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name]) => name);
    const topMoods = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mood]) => mood);
    return `曲库概况: ${allTracks.length}首歌 (可用: ${availableTracks.length}), 主要流派: ${topMoods.join("/")}, 热门艺术家: ${topArtists.slice(0, 20).join(", ")}等`;
  } catch (e) {
    console.warn("Failed to build library context:", e);
    return "";
  }
}

async function resolveOneSong(
  artist: string,
  title: string,
  keywords: string[],
  excludeIds: string[] = []
): Promise<SongWiki | null> {
  const combinedExcludes = new Set([...excludeIds, ...playedTrackIds]);

  // Try exact artist + title first
  if (artist && title) {
    const byTitle = await searchWiki(title);
    const exact = byTitle.find(
      s => s.title.toLowerCase() === title.toLowerCase() &&
           s.artist.toLowerCase() === artist.toLowerCase()
    );
    if (exact && !combinedExcludes.has(exact.id)) return exact;
    const byArtist = byTitle.find(
      s => s.artist.toLowerCase().includes(artist.toLowerCase()) && !combinedExcludes.has(s.id)
    );
    if (byArtist) return byArtist;
  }

  // Score-based search using keywords
  const scored: Map<string, { wiki: SongWiki; score: number }> = new Map();
  for (const kw of keywords) {
    const results = await searchWiki(kw);
    const kwLower = kw.toLowerCase();
    for (const r of results) {
      if (combinedExcludes.has(r.id)) continue;
      const prev = scored.get(r.id);
      let weight = 1;
      if (r.title.toLowerCase().includes(kwLower)) weight = 3;
      scored.set(r.id, { wiki: r, score: (prev?.score || 0) + weight });
    }
  }

  if (scored.size > 0) {
    const sorted = [...scored.values()].sort((a, b) => b.score - a.score);
    // Add some randomness among top scores
    const topThreshold = sorted[0].score * 0.8;
    const candidates = sorted.filter(s => s.score >= topThreshold);
    return candidates[Math.floor(Math.random() * candidates.length)].wiki;
  }

  return null;
}

async function resolveToTrack(wiki: SongWiki | null): Promise<Track | null> {
  if (!wiki) return null;
  const { getLocalTrackById, scanMusicLibrary } = await import("../services/musicLibraryService.js");
  let track = await getLocalTrackById(wiki.id);
  if (!track) {
    const allTracks = await scanMusicLibrary();
    const available = allTracks.filter(t => !playedTrackIds.has(t.id));
    track = available[Math.floor(Math.random() * available.length)] || allTracks[0];
  }
  return track;
}

async function synthesizeDJTalk(
  text: string,
  settings: any,
  language: string,
  emotion: string = "normal"
): Promise<{ audioBase64: string; mimeType: string }> {
  try {
    const ttsResult = await synthesizeSpeech(text, settings.defaultVoice, {
      provider: settings.defaultTtsProvider,
      emotion,
      apiKey: settings.defaultTtsProvider === "openai" ? settings.openAiApiKey : undefined,
      language
    }) as any;
    let mimeType = ttsResult.mimeType || "audio/mp3";
    if (!ttsResult.mimeType && (settings.defaultTtsProvider === "moss" || settings.defaultTtsProvider === "macsay")) {
      mimeType = "audio/wav";
    }
    return { audioBase64: ttsResult.audioBase64, mimeType };
  } catch (e) {
    console.error("TTS failed:", e);
    return { audioBase64: "", mimeType: "audio/mp3" };
  }
}

function detectSongRequest(historyContext: string): string | null {
  if (!historyContext) return null;
  // Get the latest message to avoid re-triggering old requests
  const lines = historyContext.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  if (!lastLine || !lastLine.includes("听众:")) return null;

  const patterns = [
    /点歌[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
    /点一首[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
    /我想听[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
    /播放[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
    /点[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
    /request[：:\s]+(.+?)\s*$/im,
  ];
  for (const re of patterns) {
    const match = lastLine.match(re);
    if (match) return match[1].trim();
  }
  return null;
}

// ── POST /init ──
// Generates a theme + playlist, resolves all songs to actual tracks.
streamRouter.post("/init", async (req, res) => {
  try {
    const { style, language } = req.body;
    playedTrackIds.clear(); // Reset on fresh init
    const libraryContext = await buildLibraryContext();

    const playlistResp = await streamDJ.generatePlaylist(
      libraryContext,
      language || "zh-CN",
      style || "classic",
      undefined,
      4
    );

    console.log("[stream] theme:", playlistResp.theme_update?.theme);
    console.log("[stream] playlist songs:", playlistResp.songs.map(s => `${s.artist} - ${s.title}`));

    // Resolve each song to an actual Track in the library
    const targetCount = playlistResp.songs.length || 4;
    const resolvedTracks: Track[] = [];
    const usedIdsInThisPlaylist = new Set<string>();
    
    for (const song of playlistResp.songs) {
      const wiki = await resolveOneSong(song.artist, song.title, song.keywords, [...usedIdsInThisPlaylist]);
      const track = await resolveToTrack(wiki);
      if (track && !usedIdsInThisPlaylist.has(track.id)) {
        usedIdsInThisPlaylist.add(track.id);
        resolvedTracks.push(track);
      }
    }

    // Fill remaining slots with random songs to reach targetCount
    if (resolvedTracks.length < targetCount) {
      const { scanMusicLibrary } = await import("../services/musicLibraryService.js");
      const all = await scanMusicLibrary();
      const pool = all.filter(t => !usedIdsInThisPlaylist.has(t.id));
      while (resolvedTracks.length < targetCount && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        resolvedTracks.push(pool[idx]);
        usedIdsInThisPlaylist.add(pool[idx].id);
        pool.splice(idx, 1);
      }
    }

    currentPlaylist = resolvedTracks.slice(1); // first track will be served immediately
    currentTheme = {
      theme: playlistResp.theme_update.theme,
      phase: playlistResp.theme_update.phase,
      coveredTopics: playlistResp.theme_update.coveredTopics,
      segmentIndex: 0
    };

    console.log("[stream] resolved playlist:", resolvedTracks.map(t => `${t.title} by ${t.artist}`));

    // Generate narration for the FIRST resolved track
    const firstTrack = resolvedTracks[0];
    console.log("--------------------------------------------------");
    console.log("[stream] >>> INITIAL TRACK <<<");
    console.log("[stream] Track ID:", firstTrack?.id);
    console.log("[stream] Track Title:", firstTrack?.title);
    console.log("[stream] Track Artist:", firstTrack?.artist);
    if (firstTrack?.source === "local" && firstTrack?.previewUrl?.includes("/stream/")) {
      try {
        const b64 = firstTrack.previewUrl.split("/stream/")[1];
        const decodedPath = Buffer.from(b64, "base64url").toString();
        console.log("[stream] Local File Path:", decodedPath);
      } catch (e) {
        console.log("[stream] Preview URL:", firstTrack.previewUrl);
      }
    } else {
      console.log("[stream] Preview URL:", firstTrack?.previewUrl);
    }
    console.log("--------------------------------------------------");

    let firstNarration = playlistResp.intro_talk; 

    if (firstTrack) {
      trackPlayed(firstTrack.id);
      let wiki: SongWiki | null = null;
      try { 
        const { getSongWiki } = await import("../services/wikiService.js");
        wiki = await getSongWiki(firstTrack.id); 
      } catch (e) {}
      const narrationResp = await streamDJ.generateNarrationForTrack(
        {
          title: firstTrack.title,
          artist: firstTrack.artist,
          album: firstTrack.album,
          explanation: firstTrack.explanation || undefined,
          composer: wiki?.composer,
          lyricist: wiki?.lyricist,
          releaseYear: wiki?.releaseYear,
          hotComments: wiki?.hotComments,
          trivia: wiki?.trivia?.[0] || wiki?.wikiAbstract,
        },
        currentTheme,
        language || "zh-CN",
        style || "classic"
      );
      firstNarration = narrationResp.dj_talk;
      if (narrationResp.theme_update) {
        currentTheme = {
          theme: narrationResp.theme_update.theme,
          phase: narrationResp.theme_update.phase,
          coveredTopics: narrationResp.theme_update.coveredTopics,
          segmentIndex: 0
        };
      }
    }

    let settings: any = {};
    try { settings = await getRuntimeSettings(); } catch (e) {}

    const ttsResult = await synthesizeDJTalk(firstNarration, settings, language || "zh-CN");

    res.json({
      theme_update: {
        theme: currentTheme.theme,
        phase: currentTheme.phase,
        coveredTopics: currentTheme.coveredTopics
      },
      playlist: currentPlaylist.map(t => ({  
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        artwork: t.artwork, moodTags: t.moodTags, previewUrl: t.previewUrl
      })),
      first_segment: {
        dj_text: firstNarration,
        dj_audio_base64: ttsResult.audioBase64,
        dj_audio_mime_type: ttsResult.mimeType,
        next_track: firstTrack,
      }
    });
  } catch (error) {
    console.error("Error in stream init:", error);
    res.status(500).json({ error: "Failed to initialize stream" });
  }
});

// ── POST /next ──
// Pops the next track from the playlist, generates narration specifically for it.
streamRouter.post("/next", async (req, res) => {
  try {
    const { historyContext, lastTrackId, style, language } = req.body;

    // Handle song requests from chat
    const songRequest = detectSongRequest(historyContext || "");
    if (songRequest) {
      console.log(`[stream] song request detected: "${songRequest}"`);
      // When explicitly requested, we might allow playing it even if it was played a while ago, 
      // but let's pass an empty exclude list for the search.
      const wiki = await resolveOneSong("", songRequest, [songRequest], []);
      if (wiki) {
        const track = await resolveToTrack(wiki);
        if (track) {
          // Push to front of playlist to play immediately
          currentPlaylist.unshift(track);
          console.log(`[stream] inserted requested track at front: ${track.title} by ${track.artist}`);
        }
      } else {
        console.log(`[stream] song request not found in library: "${songRequest}"`);
      }
    }

    // Pop next track from playlist
    let nextTrack = currentPlaylist.shift();
    
    if (!nextTrack) {
      // Playlist exhausted — generate a new one
      console.log("[stream] playlist exhausted, generating new one...");
      const libraryContext = await buildLibraryContext();
      const playlistResp = await streamDJ.generatePlaylist(
        libraryContext, language || "zh-CN", style || "classic", 
        currentTheme ? {
          theme: currentTheme.theme,
          phase: currentTheme.phase,
          segmentIndex: currentTheme.segmentIndex,
          coveredTopics: currentTheme.coveredTopics
        } : undefined, 
        4
      );
      
      const usedIdsInNext = new Set<string>();
      for (const song of playlistResp.songs) {
        const wiki = await resolveOneSong(song.artist, song.title, song.keywords, [...usedIdsInNext]);
        const track = await resolveToTrack(wiki);
        if (track && !usedIdsInNext.has(track.id)) {
          currentPlaylist.push(track);
          usedIdsInNext.add(track.id);
        }
      }
      
      // Fallback: fill to at least 4 tracks if resolution failed
      if (currentPlaylist.length < 4) {
        const { scanMusicLibrary } = await import("../services/musicLibraryService.js");
        const all = await scanMusicLibrary();
        const existingIds = new Set(currentPlaylist.map(t => t.id));
        const pool = all.filter(t => !existingIds.has(t.id) && !playedTrackIds.has(t.id));
        while (currentPlaylist.length < 4 && pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          currentPlaylist.push(pool[idx]);
          existingIds.add(pool[idx].id);
          pool.splice(idx, 1);
        }
      }
      
      nextTrack = currentPlaylist.shift();
    }

    if (!nextTrack) {
      return res.status(500).json({ error: "No tracks available" });
    }

    trackPlayed(nextTrack.id);
    return await serveNextSegment(nextTrack, req.body, res);
  } catch (error) {
    console.error("Error in stream next:", error);
    res.status(500).json({ error: "Failed to generate stream segment" });
  }
});

async function serveNextSegment(track: Track, reqBody: any, res: any) {
  const { historyContext, style, language } = reqBody;

  // Get wiki info for richer narration
  let wiki: SongWiki | null = null;
  try { 
    const { getSongWiki } = await import("../services/wikiService.js");
    wiki = await getSongWiki(track.id); 
  } catch (e) {}

  console.log("--------------------------------------------------");
  console.log("[stream] >>> SERVING NEXT SEGMENT <<<");
  console.log("[stream] Track ID:", track.id);
  console.log("[stream] Track Title:", track.title);
  console.log("[stream] Track Artist:", track.artist);
  if (track.source === "local" && track.previewUrl?.includes("/stream/")) {
    try {
      const b64 = track.previewUrl.split("/stream/")[1];
      const decodedPath = Buffer.from(b64, "base64url").toString();
      console.log("[stream] Local File Path:", decodedPath);
    } catch (e) {
      console.log("[stream] Preview URL:", track.previewUrl);
    }
  } else {
    console.log("[stream] Preview URL:", track.previewUrl);
  }
  console.log("--------------------------------------------------");

  // Build TrackInfo for the DJ agent
  const trackInfo = {
    title: track.title,
    artist: track.artist,
    album: track.album,
    explanation: track.explanation || undefined,
    composer: wiki?.composer,
    lyricist: wiki?.lyricist,
    releaseYear: wiki?.releaseYear,
    hotComments: wiki?.hotComments,
    trivia: wiki?.trivia?.[0] || wiki?.wikiAbstract,
  };

  console.log(`[stream] 为 DJ 提供事实: 年份=${trackInfo.releaseYear || '未知'}, 作词=${trackInfo.lyricist || '未知'}, 热评=${trackInfo.hotComments?.length || 0}条`);

  // Advance theme segment index
  if (currentTheme) {
    currentTheme.segmentIndex++;
  }

  const narrationResp = await streamDJ.generateNarrationForTrack(
    trackInfo,
    currentTheme || undefined,
    language || "zh-CN",
    style || "classic",
    historyContext || ""
  );

  console.log("[stream] DJ narration:", narrationResp.dj_talk?.substring(0, 120));

  // Update theme
  if (narrationResp.theme_update) {
    currentTheme = {
      theme: narrationResp.theme_update.theme,
      phase: narrationResp.theme_update.phase,
      coveredTopics: narrationResp.theme_update.coveredTopics,
      segmentIndex: currentTheme?.segmentIndex ?? 0
    };
  }

  // TTS for DJ talk
  let settings: any = {};
  try { settings = await getRuntimeSettings(); } catch (e) {}

  const ttsResult = await synthesizeDJTalk(narrationResp.dj_talk, settings, language || "zh-CN");

  // TTS for mid-song inserts
  const insertAudios: Array<{
    text: string; audio_base64: string; mime_type: string; timing: string; type: string;
  }> = [];
  if (narrationResp.mid_song_inserts && narrationResp.mid_song_inserts.length > 0) {
    for (const insert of narrationResp.mid_song_inserts) {
      const result = await synthesizeDJTalk(
        insert.text, settings, language || "zh-CN",
        insert.type === "trivia" ? "whisper" : "normal"
      );
      if (result.audioBase64) {
        insertAudios.push({
          text: insert.text,
          audio_base64: result.audioBase64,
          mime_type: result.mimeType,
          timing: insert.timing,
          type: insert.type,
        });
      }
    }
  }

  // Replenish playlist if running low
  if (currentPlaylist.length < 3) {
    console.log("[stream] playlist running low, replenishing...");
    const libraryContext = await buildLibraryContext();
    const playlistResp = await streamDJ.generatePlaylist(
      libraryContext, language || "zh-CN", style || "classic",
      currentTheme ? {
        theme: currentTheme.theme,
        phase: currentTheme.phase,
        segmentIndex: currentTheme.segmentIndex,
        coveredTopics: currentTheme.coveredTopics
      } : undefined,
      4
    );
    for (const song of playlistResp.songs) {
      const w = await resolveOneSong(song.artist, song.title, song.keywords, [...currentPlaylist.map(t => t.id)]);
      const t = await resolveToTrack(w);
      if (t && !currentPlaylist.find(existing => existing.id === t.id)) {
        currentPlaylist.push(t);
      }
    }
    
    // Fallback: fill to at least 4 tracks
    if (currentPlaylist.length < 4) {
      const { scanMusicLibrary } = await import("../services/musicLibraryService.js");
      const all = await scanMusicLibrary();
      const existingIds = new Set(currentPlaylist.map(t => t.id));
      const pool = all.filter(t => !existingIds.has(t.id) && !playedTrackIds.has(t.id));
      while (currentPlaylist.length < 4 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        currentPlaylist.push(pool[idx]);
        existingIds.add(pool[idx].id);
        pool.splice(idx, 1);
      }
    }
    console.log(`[stream] playlist replenished, now ${currentPlaylist.length} tracks`);
  }

  res.json({
    dj_text: narrationResp.dj_talk,
    dj_audio_base64: ttsResult.audioBase64,
    dj_audio_mime_type: ttsResult.mimeType,
    next_track: track,
    mood_matched: track.moodTags?.[0] || "Relaxing",
    mid_song_inserts: insertAudios,
    theme_update: narrationResp.theme_update || null,
    playlist: currentPlaylist.map(t => ({  
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      artwork: t.artwork, moodTags: t.moodTags, previewUrl: t.previewUrl
    }))
  });
}
