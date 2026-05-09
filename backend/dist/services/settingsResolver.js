import dotenv from "dotenv";
import { getRuntimeSettings } from "./storageService.js";
dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });
export async function resolveRuntimeSecrets() {
    const stored = await getRuntimeSettings();
    return {
        spotifyClientId: process.env.SPOTIFY_CLIENT_ID || stored.spotifyClientId,
        spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || stored.spotifyClientSecret,
        neteaseApiEnabled: stored.neteaseApiEnabled ?? true,
        neteaseApiUrl: process.env.NETEASE_API_URL || stored.neteaseApiUrl || "",
        openAiApiKey: process.env.OPENAI_API_KEY || stored.openAiApiKey,
        elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || stored.elevenLabsApiKey,
        defaultVoice: process.env.DEFAULT_TTS_VOICE || stored.defaultVoice,
        defaultTtsProvider: process.env.DEFAULT_TTS_PROVIDER || stored.defaultTtsProvider,
        preferredMusicSource: process.env.PREFERRED_MUSIC_SOURCE || stored.preferredMusicSource || "auto",
        localMusicPath: process.env.LOCAL_MUSIC_PATH || stored.localMusicPath || "",
        weatherApiKey: process.env.WEATHER_API_KEY || "",
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173"
    };
}
