import { Router } from "express";
import { StreamDJAgent } from "lobster-radio-agents";
import { getSongWiki, searchWiki } from "../services/wikiService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getRuntimeSettings } from "../services/storageService.js";

export const streamRouter = Router();
const streamDJ = new StreamDJAgent();

streamRouter.post("/next", async (req, res) => {
  try {
    const { historyContext, lastTrackId, style, language, themeContext } = req.body;

    let lastSong = null;
    if (lastTrackId) {
      lastSong = await getSongWiki(lastTrackId);
    }

    // Build library context summary for smarter song matching
    const { scanMusicLibrary: scanLib } = await import("../services/musicLibraryService.js");
    let libraryContext = "";
    try {
      const allTracks = await scanLib();
      const artistCounts: Record<string, number> = {};
      const moodCounts: Record<string, number> = {};
      for (const t of allTracks) {
        artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
        for (const m of t.moodTags) {
          if (["Working", "Relaxing", "Exercising", "Party", "Sleepy"].includes(m)) {
            moodCounts[m] = (moodCounts[m] || 0) + 1;
          }
        }
      }
      const topArtists = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name]) => name);
      const topMoods = Object.entries(moodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([mood]) => mood);
      libraryContext = `曲库概况: ${allTracks.length}首歌, 主要流派: ${topMoods.join("/")}, 热门艺术家: ${topArtists.slice(0, 12).join(", ")}等`;
    } catch (e) {
      console.warn("Failed to build library context:", e);
    }

    const djResponse = await streamDJ.generateNextSegment(
      historyContext || "",
      lastSong,
      style || "classic",
      language || "zh-CN",
      themeContext || undefined,
      libraryContext
    );

    // Search for a song based on keywords
    let nextWiki = null;
    const keywords = djResponse.song_query.keywords;
    
    for (const keyword of keywords) {
      const results = await searchWiki(keyword);
      if (results.length > 0) {
        // Shuffle to avoid repeating the same song for the same keyword
        const pool = lastTrackId ? results.filter(r => r.id !== lastTrackId) : results;
        nextWiki = pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : results[Math.floor(Math.random() * results.length)];
        break;
      }
    }

    if (!nextWiki) {
        const results = await searchWiki(""); 
        if (results.length > 0) {
             nextWiki = results[Math.floor(Math.random() * results.length)];
        }
    }

    // Convert Wiki entry back to actual Track with previewUrl
    const { getLocalTrackById, scanMusicLibrary } = await import("../services/musicLibraryService.js");
    let nextTrack = null;
    if (nextWiki) {
      nextTrack = await getLocalTrackById(nextWiki.id);
    }

    // Absolute fallback: if still no track, pick any track from the library
    if (!nextTrack) {
        const allTracks = await scanMusicLibrary();
        const pool = lastTrackId ? allTracks.filter(t => t.id !== lastTrackId) : allTracks;
        if (pool.length > 0) {
            nextTrack = pool[Math.floor(Math.random() * pool.length)];
        } else if (allTracks.length > 0) {
            nextTrack = allTracks[Math.floor(Math.random() * allTracks.length)];
        }
    }

    // Generate audio for the DJ talk
    let audioBase64 = "";
    let audioMimeType = "audio/mp3";

    // Fetch settings once for both TTS blocks
    let settings: any = {};
    try {
      settings = await getRuntimeSettings();
    } catch (e) {
      console.warn("Failed to load runtime settings, using defaults");
    }

    if (djResponse.dj_talk) {
      try {
        const ttsResult = await synthesizeSpeech(djResponse.dj_talk, settings.defaultVoice, {
          provider: settings.defaultTtsProvider,
          emotion: "normal",
          apiKey: settings.defaultTtsProvider === "openai" ? settings.openAiApiKey : undefined,
          language: language
        }) as any;
        audioBase64 = ttsResult.audioBase64;
        if (ttsResult.mimeType) {
          audioMimeType = ttsResult.mimeType;
        } else if (settings.defaultTtsProvider === 'moss' || settings.defaultTtsProvider === ('macsay' as any)) {
          audioMimeType = "audio/wav";
        }
      } catch (ttsError) {
        console.error("TTS Generation failed:", ttsError);
      }
    }

    // Synthesize TTS for mid-song inserts
    const insertAudios: Array<{
      text: string;
      audio_base64: string;
      mime_type: string;
      timing: string;
      type: string;
    }> = [];

    if (djResponse.mid_song_inserts && djResponse.mid_song_inserts.length > 0) {
      for (const insert of djResponse.mid_song_inserts) {
        try {
          const ttsResult = await synthesizeSpeech(insert.text, settings.defaultVoice, {
            provider: settings.defaultTtsProvider,
            emotion: insert.type === 'trivia' ? 'whisper' : 'normal',
            apiKey: settings.defaultTtsProvider === 'openai' ? settings.openAiApiKey : undefined,
            language: language
          }) as any;
          if (ttsResult.audioBase64) {
            insertAudios.push({
              text: insert.text,
              audio_base64: ttsResult.audioBase64,
              mime_type: ttsResult.mimeType || 'audio/mp3',
              timing: insert.timing,
              type: insert.type,
            });
          }
        } catch (e) {
          console.warn('Mid-song insert TTS failed, skipping:', e);
        }
      }
    }

    res.json({
      dj_text: djResponse.dj_talk,
      dj_audio_base64: audioBase64,
      dj_audio_mime_type: audioMimeType,
      next_track: nextTrack,
      mood_matched: djResponse.song_query.mood,
      mid_song_inserts: insertAudios,
      theme_update: djResponse.theme_update || null
    });
  } catch (error) {
    console.error("Error in stream next:", error);
    res.status(500).json({ error: "Failed to generate stream segment" });
  }
});
