export type MoodOption = "Working" | "Relaxing" | "Exercising" | "Party" | "Sleepy";
export type DJStyle = "classic" | "night" | "vibe" | "trivia";

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

export interface RecommendationPayload {
  mood: MoodOption;
  contextSummary: string;
  narration: string;
  tracks: Track[];
  selectedTrack: Track;
}

export interface PreferencesSnapshot {
  likes: string[];
  dislikes: string[];
  history: PlaybackHistoryItem[];
  moodAffinity: Record<string, number>;
}

export interface RuntimeSettings {
  spotifyClientId: string;
  spotifyClientSecret: string;
  neteaseApiEnabled: boolean;
  neteaseApiUrl: string;
  openAiApiKey: string;
  elevenLabsApiKey: string;
  defaultVoice: string;
  defaultTtsProvider: "openai" | "elevenlabs" | "edge" | "gemini" | "macsay" | "moss" | "cosyvoice";
  djLanguage?: "zh-CN" | "zh-HK" | "en-US";
  djEmotion?: "normal" | "happy" | "sad" | "angry" | "calm" | "excited" | "whisper" | "radio";
  djStyle?: "classic" | "night" | "vibe" | "trivia";
  enableAiNarration?: boolean;
  preferredMusicSource: "local" | "netease" | "spotify" | "auto";
  localMusicPath: string;
}

export interface SongWiki {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear?: number;
  genre?: string[];
  composer?: string;
  lyricist?: string;
  arranger?: string;
  producer?: string;
  trivia?: string[];
  moodTags?: string[];
  djMaterial?: {
    intro?: string[];
    vibe?: string[];
    funFact?: string[];
  };
  relatedSongs?: string[];
  tags?: string[];
}
