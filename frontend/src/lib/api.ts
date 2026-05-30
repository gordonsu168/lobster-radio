import type {
  MoodOption,
  PreferencesSnapshot,
  RecommendationPayload,
  RuntimeSettings,
  Track,
  DJStyle
} from "../types";

export const API_BASE = (window as Window & { __LOBSTER_API__?: string }).__LOBSTER_API__ ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getRecommendations(mood: MoodOption, language?: string) {
  let url = `/api/recommendations?mood=${encodeURIComponent(mood)}`;
  if (language) {
    url += `&language=${encodeURIComponent(language)}`;
  }
  return request<RecommendationPayload>(url);
}

export function submitFeedback(trackId: string, feedback: "like" | "dislike", mood: MoodOption) {
  return request<PreferencesSnapshot>("/api/recommendations/feedback", {
    method: "POST",
    body: JSON.stringify({ trackId, feedback, mood })
  });
}

export function getPreferences() {
  return request<PreferencesSnapshot>("/api/preferences");
}

export function getSettings() {
  return request<RuntimeSettings>("/api/settings");
}

export function saveSettings(settings: RuntimeSettings) {
  return request<RuntimeSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

export interface DJIdentity {
  name: string;
  englishName: string;
  programName: string;
  englishProgramName: string;
  persona: string;
  englishPersona: string;
}

export function getDJIdentity() {
  return request<DJIdentity>("/api/settings/dj-identity");
}

export function saveDJIdentity(identity: DJIdentity) {
  return request<{ success: boolean }>("/api/settings/dj-identity", {
    method: "PUT",
    body: JSON.stringify(identity)
  });
}

export function getDJPersona() {
  return request<{ persona: string }>("/api/settings/dj-persona");
}

export function saveDJPersona(persona: string) {
  return request<{ success: boolean }>("/api/settings/dj-persona", {
    method: "PUT",
    body: JSON.stringify({ persona })
  });
}

export function synthesizeNarration(text: string, voice: string, options?: { provider?: string; emotion?: string; language?: string }) {
  return request<{
    provider: string;
    voice: string;
    audioBase64: string | null;
    mimeType: string | null;
    text: string;
    fallback: boolean;
    emotion?: string;
  }>("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text, voice, ...options })
  });
}

export interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
  previewText: string;
}

export function getVoices(provider?: string) {
  const params = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  return request<{ voices: VoiceInfo[] }>(`/api/tts/voices${params}`);
}

export function getLibraryStats() {
  return request<{
    total: number;
    byMood: Record<MoodOption, number>;
  }>("/api/library/stats");
}

export function scanLibrary() {
  return request<{
    scanned: number;
    tracks: any[];
  }>("/api/library/scan", { method: "POST" });
}


export function generateNarration(trackId: string, style: DJStyle, language?: string) {
  return request<{
    songId: string;
    title: string;
    style: string;
    narration: string;
  }>(`/api/wiki/narration/${encodeURIComponent(trackId)}`, {
    method: "POST",
    body: JSON.stringify({ style, language })
  });
}

// 生成 DJ 闲聊插话
export function generateChat(trackId: string, style: DJStyle, position?: string) {
  return request<{
    songId: string;
    title: string;
    style: string;
    position: string;
    chat: string;
  }>(`/api/wiki/chat/${encodeURIComponent(trackId)}`, {
    method: "POST",
    body: JSON.stringify({ style, position })
  });
}

export function generateOutro(songId: string, style: DJStyle, language: string) {
  return request<{ outro: string }>(`/api/wiki/outro/${encodeURIComponent(songId)}`, {
    method: "POST",
    body: JSON.stringify({ style, language }),
  });
}

export function getTrivia(songId: string) {
  return request<{ hasTrivia: boolean; trivia: string | null }>(`/api/wiki/trivia/${encodeURIComponent(songId)}`);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolResult {
  name: string;
  result: string;
}

export function sendChatMessage(message: string, history: ChatMessage[], currentTrack: Track | null) {
  return request<{
    reply: string;
    skipRequested: boolean;
    toolResults?: ToolResult[];
  }>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, history, currentTrack })
  });
}

// ---- 小米音响 API ----

export interface XiaomiSpeakerConfig {
  enabled: boolean;
  apiUrl: string;
  deviceId: string;
  lanHost?: string;
}

export interface XiaomiDevice {
  name: string;
  did: string;
  hardware: string;
  miotDID?: string;
}

export interface XiaomiPlaybackStatus {
  isPlaying: boolean;
  volume: number;
  currentTitle?: string;
}

export function getXiaomiConfig() {
  return request<XiaomiSpeakerConfig>("/api/speaker/xiaomi/config");
}

export function saveXiaomiConfig(config: XiaomiSpeakerConfig) {
  return request<{ success: boolean; config: XiaomiSpeakerConfig }>("/api/speaker/xiaomi/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function testXiaomiConnection() {
  return request<{ ok: boolean; error?: string; version?: string }>("/api/speaker/xiaomi/test");
}

export function getXiaomiDevices() {
  return request<{ devices: XiaomiDevice[] }>("/api/speaker/xiaomi/devices");
}

export function getXiaomiStatus(did?: string) {
  const params = did ? `?did=${encodeURIComponent(did)}` : "";
  return request<XiaomiPlaybackStatus>(`/api/speaker/xiaomi/status${params}`);
}

export function playUrlOnXiaomi(url: string, did?: string) {
  return request<{ success: boolean }>("/api/speaker/xiaomi/play-url", {
    method: "POST",
    body: JSON.stringify({ url, did }),
  });
}

export function stopXiaomi(did?: string) {
  return request<{ success: boolean }>("/api/speaker/xiaomi/stop", {
    method: "POST",
    body: JSON.stringify({ did }),
  });
}

export function setXiaomiVolume(volume: number, did?: string) {
  return request<{ success: boolean; volume: number }>("/api/speaker/xiaomi/volume", {
    method: "POST",
    body: JSON.stringify({ volume, did }),
  });
}

/**
 * 在小米音响上播放"旁白 → 音乐"序列
 */
export function playSequenceOnXiaomi(
  narrationBase64: string,
  musicUrl: string,
  did?: string
) {
  return request<{ success: boolean; narrationUrl: string; musicUrl: string }>(
    "/api/speaker/xiaomi/play-sequence",
    {
      method: "POST",
      body: JSON.stringify({
        narrationBase64,
        musicUrl,
        did,
        // 不传 host，让后端自动检测 LAN IP（小米音响无法访问 localhost）
      }),
    }
  );
}

/**
 * 仅在小米音响上播放旁白（返回时长）
 */
export function playNarrationOnXiaomi(base64Audio: string, did?: string) {
  return request<{ success: boolean; audioUrl: string; duration: number }>(
    "/api/speaker/xiaomi/play-narration",
    {
      method: "POST",
      body: JSON.stringify({
        base64Audio,
        did,
        host: window.location.origin || undefined,
      }),
    }
  );
}
