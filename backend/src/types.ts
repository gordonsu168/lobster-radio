export interface DJIdentity {
  name: string;
  englishName: string;
  programName: string;
  englishProgramName: string;
  persona: string;
  englishPersona: string;
}

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
  lyric?: string;
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

export interface UserSchedule {
  workStart: string;   // "09:00"
  workEnd: string;     // "18:00"
  workDays: number[];  // [1,2,3,4,5] Mon-Fri
  sleepTime: string;   // "23:00"
  wakeTime: string;    // "07:00"
}

export interface RuntimeSettings {
  spotifyClientId: string;
  spotifyClientSecret: string;
  neteaseApiEnabled: boolean;
  neteaseApiUrl: string;
  openAiApiKey: string;
  deepseekApiKey?: string;
  elevenLabsApiKey: string;
  defaultVoice: string;
  defaultTtsProvider: "openai" | "elevenlabs" | "edge" | "gemini" | "macsay" | "moss" | "cosyvoice";
  djLanguage?: "zh-CN" | "zh-HK" | "en-US";
  djEmotion?: "normal" | "happy" | "sad" | "angry" | "calm" | "excited" | "whisper" | "radio";
  djStyle?: "classic" | "night" | "vibe" | "trivia";
  enableAiNarration?: boolean;
  preferredMusicSource: "local" | "netease" | "spotify" | "auto";
  localMusicPath: string;
  userSchedule?: UserSchedule;
}

export interface RecommendationResponse {
  mood: MoodOption;
  contextSummary: string;
  narration: string;
  tracks: Track[];
  selectedTrack: Track;
}
