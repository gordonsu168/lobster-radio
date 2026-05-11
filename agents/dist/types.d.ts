export type MoodOption = "Working" | "Relaxing" | "Exercising" | "Party" | "Sleepy";
export type DJStyle = "classic" | "night" | "vibe" | "trivia";
export type DJLanguage = "zh-CN" | "zh-HK" | "en-US";
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
}
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
