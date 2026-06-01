import dotenv from "dotenv";
import { getRuntimeSettings } from "./storageService.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });

export async function resolveRuntimeSecrets() {
  const stored = await getRuntimeSettings();
  return {
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || stored.spotifyClientId,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || stored.spotifyClientSecret,
    neteaseApiEnabled: (process.env.NETEASE_API_ENABLED === "true") || stored.neteaseApiEnabled || false,
    neteaseApiUrl: process.env.NETEASE_API_URL || stored.neteaseApiUrl || "",
    openAiApiKey: process.env.OPENAI_API_KEY || stored.openAiApiKey,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || (stored as any).deepseekApiKey,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || stored.elevenLabsApiKey,
    defaultVoice: process.env.DEFAULT_TTS_VOICE || stored.defaultVoice,
    defaultTtsProvider: (process.env.DEFAULT_TTS_PROVIDER as "openai" | "elevenlabs" | "edge" | "gemini" | "macsay" | "moss" | "cosyvoice" | undefined) || stored.defaultTtsProvider,
    djLanguage: (process.env.DJ_LANGUAGE as "zh-CN" | "zh-HK" | "en-US" | undefined) || stored.djLanguage || "zh-CN",
    djEmotion: stored.djEmotion || "normal",
    preferredMusicSource: (process.env.PREFERRED_MUSIC_SOURCE as "local" | "netease" | "spotify" | "auto" | undefined) || stored.preferredMusicSource || "auto",
    localMusicPath: process.env.LOCAL_MUSIC_PATH || stored.localMusicPath || "",
    weatherApiKey: process.env.WEATHER_API_KEY || "",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    xiaomiSpeaker: {
      enabled: process.env.XIAOMI_SPEAKER_ENABLED === "true" || (stored as any).xiaomiSpeaker?.enabled || false,
      apiUrl: process.env.XIAOMI_SPEAKER_API_URL || (stored as any).xiaomiSpeaker?.apiUrl || "http://localhost:8080",
      deviceId: process.env.XIAOMI_SPEAKER_DEVICE_ID || (stored as any).xiaomiSpeaker?.deviceId || "",
      accountId: process.env.XIAOMI_SPEAKER_ACCOUNT_ID || (stored as any).xiaomiSpeaker?.accountId || "",
      jwtToken: process.env.XIAOMI_SPEAKER_JWT_TOKEN || (stored as any).xiaomiSpeaker?.jwtToken || "",
      lanHost: process.env.XIAOMI_SPEAKER_LAN_HOST || (stored as any).xiaomiSpeaker?.lanHost || "",
    },
  };
}
