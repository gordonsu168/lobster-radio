import { Router } from "express";
import { StreamDJAgent } from "lobster-radio-agents";
import { getSongWiki, searchWiki } from "../services/wikiService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getRuntimeSettings } from "../services/storageService.js";
export const streamRouter = Router();
const streamDJ = new StreamDJAgent();
// ── Server-side playlist state ──
let currentPlaylist = [];
let currentTheme = null;
// ── Helpers ──
async function buildLibraryContext() {
    const { scanMusicLibrary: scanLib } = await import("../services/musicLibraryService.js");
    try {
        const allTracks = await scanLib();
        const artistCounts = {};
        const moodCounts = {};
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
            .slice(0, 30)
            .map(([name]) => name);
        const topMoods = Object.entries(moodCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([mood]) => mood);
        return `曲库概况: ${allTracks.length}首歌, 主要流派: ${topMoods.join("/")}, 热门艺术家: ${topArtists.slice(0, 20).join(", ")}等`;
    }
    catch (e) {
        console.warn("Failed to build library context:", e);
        return "";
    }
}
async function resolveOneSong(artist, title, keywords, excludeId) {
    // Try exact artist + title first
    if (artist && title) {
        const byTitle = await searchWiki(title);
        const exact = byTitle.find(s => s.title.toLowerCase() === title.toLowerCase() &&
            s.artist.toLowerCase() === artist.toLowerCase());
        if (exact && exact.id !== excludeId)
            return exact;
        const byArtist = byTitle.find(s => s.artist.toLowerCase().includes(artist.toLowerCase()) && s.id !== excludeId);
        if (byArtist)
            return byArtist;
    }
    // Score-based search using keywords
    const scored = new Map();
    for (const kw of keywords) {
        const results = await searchWiki(kw);
        const kwLower = kw.toLowerCase();
        for (const r of results) {
            if (excludeId && r.id === excludeId)
                continue;
            const prev = scored.get(r.id);
            let weight = 1;
            if (r.title.toLowerCase().includes(kwLower))
                weight = 3;
            scored.set(r.id, { wiki: r, score: (prev?.score || 0) + weight });
        }
    }
    if (scored.size > 0) {
        const sorted = [...scored.values()].sort((a, b) => b.score - a.score);
        const top = sorted.filter(s => s.score === sorted[0].score);
        return top[Math.floor(Math.random() * top.length)].wiki;
    }
    return null;
}
async function resolveToTrack(wiki) {
    if (!wiki)
        return null;
    const { getLocalTrackById, scanMusicLibrary } = await import("../services/musicLibraryService.js");
    let track = await getLocalTrackById(wiki.id);
    if (!track) {
        const allTracks = await scanMusicLibrary();
        track = allTracks[Math.floor(Math.random() * allTracks.length)] || null;
    }
    return track;
}
async function synthesizeDJTalk(text, settings, language, emotion = "normal") {
    try {
        const ttsResult = await synthesizeSpeech(text, settings.defaultVoice, {
            provider: settings.defaultTtsProvider,
            emotion,
            apiKey: settings.defaultTtsProvider === "openai" ? settings.openAiApiKey : undefined,
            language
        });
        let mimeType = ttsResult.mimeType || "audio/mp3";
        if (!ttsResult.mimeType && (settings.defaultTtsProvider === "moss" || settings.defaultTtsProvider === "macsay")) {
            mimeType = "audio/wav";
        }
        return { audioBase64: ttsResult.audioBase64, mimeType };
    }
    catch (e) {
        console.error("TTS failed:", e);
        return { audioBase64: "", mimeType: "audio/mp3" };
    }
}
function detectSongRequest(historyContext) {
    if (!historyContext)
        return null;
    const patterns = [
        /点歌[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
        /点一首[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
        /我想听[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
        /播放[：:\s]*[《「"']?(.+?)[》」"']?\s*$/im,
        /request[：:\s]+(.+?)\s*$/im,
    ];
    for (const re of patterns) {
        const match = historyContext.match(re);
        if (match)
            return match[1].trim();
    }
    return null;
}
// ── POST /init ──
// Generates a theme + playlist, resolves all songs to actual tracks.
streamRouter.post("/init", async (req, res) => {
    try {
        const { style, language } = req.body;
        const libraryContext = await buildLibraryContext();
        const playlistResp = await streamDJ.generatePlaylist(libraryContext, language || "zh-CN", style || "classic", undefined, 4);
        console.log("[stream] theme:", playlistResp.theme_update?.theme);
        console.log("[stream] playlist songs:", playlistResp.songs.map(s => `${s.artist} - ${s.title}`));
        // Resolve each song to an actual Track in the library
        const resolvedTracks = [];
        for (const song of playlistResp.songs) {
            const wiki = await resolveOneSong(song.artist, song.title, song.keywords);
            if (!wiki) {
                console.log(`[stream] not found: ${song.artist} - ${song.title}, trying random`);
            }
            const track = await resolveToTrack(wiki);
            if (track) {
                // Avoid duplicates within the playlist
                if (!resolvedTracks.find(t => t.id === track.id)) {
                    resolvedTracks.push(track);
                }
            }
        }
        // Fallback: fill remaining slots with random songs
        if (resolvedTracks.length === 0) {
            const { scanMusicLibrary } = await import("../services/musicLibraryService.js");
            const all = await scanMusicLibrary();
            for (let i = 0; i < Math.min(4, all.length); i++) {
                const pick = all[Math.floor(Math.random() * all.length)];
                if (!resolvedTracks.find(t => t.id === pick.id)) {
                    resolvedTracks.push(pick);
                }
            }
        }
        currentPlaylist = resolvedTracks;
        currentTheme = {
            theme: playlistResp.theme_update.theme,
            phase: playlistResp.theme_update.phase,
            coveredTopics: playlistResp.theme_update.coveredTopics,
            segmentIndex: 0
        };
        console.log("[stream] resolved playlist:", resolvedTracks.map(t => `${t.title} by ${t.artist}`));
        // Generate TTS for the intro talk (treating it as the first narration)
        let settings = {};
        try {
            settings = await getRuntimeSettings();
        }
        catch (e) { }
        const ttsResult = await synthesizeDJTalk(playlistResp.intro_talk, settings, language || "zh-CN");
        res.json({
            theme_update: playlistResp.theme_update,
            playlist: resolvedTracks.map(t => ({
                id: t.id, title: t.title, artist: t.artist, album: t.album,
                artwork: t.artwork, moodTags: t.moodTags
            })),
            first_segment: {
                dj_text: playlistResp.intro_talk,
                dj_audio_base64: ttsResult.audioBase64,
                dj_audio_mime_type: ttsResult.mimeType,
                next_track: resolvedTracks[0] || null,
            }
        });
    }
    catch (error) {
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
            const wiki = await resolveOneSong("", songRequest, [songRequest], lastTrackId);
            if (wiki) {
                const track = await resolveToTrack(wiki);
                if (track) {
                    // Insert at position 1 (after current/next song) so it plays soon
                    if (currentPlaylist.length <= 1) {
                        currentPlaylist.push(track);
                    }
                    else {
                        currentPlaylist.splice(1, 0, track);
                    }
                    console.log(`[stream] inserted request: ${track.title} by ${track.artist}`);
                }
            }
            else {
                console.log(`[stream] song request not found in library: "${songRequest}"`);
            }
        }
        // Pop next track from playlist
        const nextTrack = currentPlaylist.shift();
        if (!nextTrack) {
            // Playlist exhausted — generate a new one
            console.log("[stream] playlist exhausted, generating new one...");
            const libraryContext = await buildLibraryContext();
            const playlistResp = await streamDJ.generatePlaylist(libraryContext, language || "zh-CN", style || "classic", undefined, 4);
            for (const song of playlistResp.songs) {
                const wiki = await resolveOneSong(song.artist, song.title, song.keywords);
                const track = await resolveToTrack(wiki);
                if (track && !currentPlaylist.find(t => t.id === track.id)) {
                    currentPlaylist.push(track);
                }
            }
            if (currentPlaylist.length === 0) {
                // Absolute fallback
                const { scanMusicLibrary } = await import("../services/musicLibraryService.js");
                const all = await scanMusicLibrary();
                const pick = all[Math.floor(Math.random() * all.length)];
                if (pick)
                    currentPlaylist.push(pick);
            }
            // Now try again with the freshly generated playlist
            const freshTrack = currentPlaylist.shift();
            if (!freshTrack) {
                return res.status(500).json({ error: "No tracks available" });
            }
            return await serveNextSegment(freshTrack, req.body, res);
        }
        return await serveNextSegment(nextTrack, req.body, res);
    }
    catch (error) {
        console.error("Error in stream next:", error);
        res.status(500).json({ error: "Failed to generate stream segment" });
    }
});
async function serveNextSegment(track, reqBody, res) {
    const { historyContext, style, language } = reqBody;
    // Get wiki info for richer narration
    let wiki = null;
    try {
        wiki = await getSongWiki(track.id);
    }
    catch (e) { }
    console.log("[stream] next track from playlist:", track.title, "by", track.artist);
    // Build TrackInfo for the DJ agent
    const trackInfo = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        explanation: track.explanation || undefined,
        funFact: wiki?.djMaterial?.funFact?.[0],
        trivia: wiki?.trivia?.[0],
    };
    // Advance theme segment index
    if (currentTheme) {
        currentTheme.segmentIndex++;
    }
    const narrationResp = await streamDJ.generateNarrationForTrack(trackInfo, currentTheme || undefined, language || "zh-CN", style || "classic", historyContext || "");
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
    let settings = {};
    try {
        settings = await getRuntimeSettings();
    }
    catch (e) { }
    const ttsResult = await synthesizeDJTalk(narrationResp.dj_talk, settings, language || "zh-CN");
    // TTS for mid-song inserts
    const insertAudios = [];
    if (narrationResp.mid_song_inserts && narrationResp.mid_song_inserts.length > 0) {
        for (const insert of narrationResp.mid_song_inserts) {
            const result = await synthesizeDJTalk(insert.text, settings, language || "zh-CN", insert.type === "trivia" ? "whisper" : "normal");
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
    if (currentPlaylist.length < 2) {
        console.log("[stream] playlist running low, replenishing...");
        const libraryContext = await buildLibraryContext();
        const playlistResp = await streamDJ.generatePlaylist(libraryContext, language || "zh-CN", style || "classic", currentTheme ? {
            theme: currentTheme.theme,
            phase: currentTheme.phase,
            segmentIndex: currentTheme.segmentIndex,
            coveredTopics: currentTheme.coveredTopics
        } : undefined, 4);
        for (const song of playlistResp.songs) {
            const w = await resolveOneSong(song.artist, song.title, song.keywords);
            const t = await resolveToTrack(w);
            if (t && !currentPlaylist.find(existing => existing.id === t.id)) {
                currentPlaylist.push(t);
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
        playlist_remaining: currentPlaylist.length
    });
}
