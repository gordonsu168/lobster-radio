import type {
  MoodOption,
  PreferencesSnapshot,
  RecommendationPayload,
  RuntimeSettings,
  Track,
  VoiceOption
} from "../types";

const API_BASE = (window as Window & { __LOBSTER_API__?: string }).__LOBSTER_API__ ?? "http://localhost:4000";

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

export function synthesizeNarration(text: string, voice: VoiceOption, options?: { provider?: string; emotion?: string; language?: string }) {
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

export type DJStyle = "classic" | "night" | "vibe" | "trivia";

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

export function getTrivia(trackId: string) {
  return request<{
    songId: string;
    title: string;
    artist: string;
    hasTrivia: boolean;
    trivia: string | null;
  }>(`/api/wiki/trivia/${encodeURIComponent(trackId)}`);
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
