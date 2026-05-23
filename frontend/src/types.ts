export type MoodOption = "Working" | "Relaxing" | "Exercising" | "Party" | "Sleepy";
export type DJStyle = "classic" | "night" | "vibe" | "trivia";

export interface UserSchedule {
  workStart: string;
  workEnd: string;
  workDays: number[];
  sleepTime: string;
  wakeTime: string;
}

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
  userSchedule?: UserSchedule;
}

export interface SongWiki {
  id: string;
  title: string;
  artist: string;
  album: string;
  
  // --- Hard Facts ---
  releaseYear?: number;
  genre?: string[];
  composer?: string;
  lyricist?: string;
  arranger?: string;
  producer?: string;
  recordLabel?: string;
  
  // --- External Links ---
  neteaseId?: string;
  wikipediaUrl?: string;
  
  // --- Original Materials ---
  hotComments?: string[];
  wikiAbstract?: string;
  trivia?: string[];
  lyric?: string;
  
  // --- Playback ---
  previewUrl?: string;

  // --- Task Status ---
  enrichmentStatus: 'pending' | 'completed' | 'failed';
  lastUpdated: string;

  // --- Deprecated ---
  moodTags?: string[];
  djMaterial?: {
    intro?: string[];
    vibe?: string[];
    funFact?: string[];
  };
  relatedSongs?: string[];
  tags?: string[];
}

export interface AestheticDNA {
  spectralMap: {
    lowEnd: number;
    midTexture: number;
    highAir: number;
    analogHeat: number;
  };
  evolution: {
    precision: number;
    entropyThreshold: number;
    autonomyLevel: number;
    fatigueIndex: number;
    level: number;
  };
  anchors: {
    localRoots: string[];
    phantomNodes: string[];
    blackList: string[];
  };
}

export type XPacketType = 'thought' | 'action' | 'message' | 'error';

export interface XPacket {
  id: string;
  timestamp: number;
  type: XPacketType;
  content: string;
  metadata?: any;
}

