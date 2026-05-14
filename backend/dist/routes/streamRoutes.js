import { Router } from "express";
import { StreamDJAgent } from "lobster-radio-agents";
import { getSongWiki, searchWiki } from "../services/wikiService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getRuntimeSettings } from "../services/storageService.js";
export const streamRouter = Router();
const streamDJ = new StreamDJAgent();
streamRouter.post("/next", async (req, res) => {
    try {
        const { historyContext, lastTrackId, style, language } = req.body;
        let lastSong = null;
        if (lastTrackId) {
            lastSong = await getSongWiki(lastTrackId);
        }
        const djResponse = await streamDJ.generateNextSegment(historyContext || "", lastSong, style || "classic", language || "zh-CN");
        // Search for a song based on keywords
        let nextWiki = null;
        const keywords = djResponse.song_query.keywords;
        for (const keyword of keywords) {
            const results = await searchWiki(keyword);
            if (results.length > 0) {
                nextWiki = results[0];
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
            if (allTracks.length > 0) {
                nextTrack = allTracks[Math.floor(Math.random() * allTracks.length)];
            }
        }
        // Generate audio for the DJ talk
        let audioBase64 = "";
        let audioMimeType = "audio/mp3";
        if (djResponse.dj_talk) {
            try {
                const settings = await getRuntimeSettings();
                const ttsResult = await synthesizeSpeech(djResponse.dj_talk, settings.defaultVoice, {
                    provider: settings.defaultTtsProvider,
                    emotion: "normal",
                    apiKey: settings.defaultTtsProvider === "openai" ? settings.openAiApiKey : undefined,
                    language: language
                });
                audioBase64 = ttsResult.audioBase64;
                if (ttsResult.mimeType) {
                    audioMimeType = ttsResult.mimeType;
                }
                else if (settings.defaultTtsProvider === 'moss' || settings.defaultTtsProvider === 'macsay') {
                    audioMimeType = "audio/wav";
                }
            }
            catch (ttsError) {
                console.error("TTS Generation failed:", ttsError);
            }
        }
        res.json({
            dj_text: djResponse.dj_talk,
            dj_audio_base64: audioBase64,
            dj_audio_mime_type: audioMimeType,
            next_track: nextTrack,
            mood_matched: djResponse.song_query.mood
        });
    }
    catch (error) {
        console.error("Error in stream next:", error);
        res.status(500).json({ error: "Failed to generate stream segment" });
    }
});
