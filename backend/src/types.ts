export type MoodOption = "Working" | "Relaxing" | "Exercising" | "Party" | "Sleepy";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string | null;
  artwork: string;
  moodTags: string[];
  energy: number;
  explanation: string;
  source: "spotify" | "netease" | "local" | "fallback";
}

export interface PlaybackHistoryItem extends Track {
  playedAt: string;
  feedback?: "like" | "dislike";
}

export interface Preferences {
  likes: string[];
  dislikes: string[];
  history: PlaybackHistoryItem[];
  moodAffinity: Record<string, number>;
  memoryInsight?: string;
  chatHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface RuntimeSettings {
  spotifyClientId: string;
  spotifyClientSecret: string;
  neteaseApiEnabled: boolean;
  neteaseApiUrl: string;
  openAiApiKey: string;
  elevenLabsApiKey: string;
  defaultVoice: string;
  defaultTtsProvider: "openai" | "elevenlabs" | "edge" | "gemini" | "macsay";
  djLanguage?: "zh-CN" | "zh-HK" | "en-US";
  djEmotion?: "normal" | "happy" | "sad" | "angry" | "calm" | "excited" | "whisper" | "radio";
  preferredMusicSource: "local" | "netease" | "spotify" | "auto";
  localMusicPath: string;
}

export interface RecommendationResponse {
  mood: MoodOption;
  contextSummary: string;
  narration: string;
  tracks: Track[];
  selectedTrack: Track;
}
