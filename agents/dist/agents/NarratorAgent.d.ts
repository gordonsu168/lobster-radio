import type { DJLanguage, MoodOption, PlaybackHistoryItem, Track } from "../types.js";
export interface SongWiki {
    id: string;
    title: string;
    artist: string;
    album: string;
    explanation?: string;
    djMaterial?: {
        intro?: string[];
        outro?: string[];
        vibe?: string[];
        funFact?: string[];
    };
    trivia?: string[];
}
export type DJStyle = "classic" | "night" | "vibe" | "trivia";
export interface NarratorInput {
    mood: MoodOption;
    contextSummary: string;
    shortTermMemory?: string;
    longTermMemory?: string;
    memoryInsight?: string;
    track: Track;
    history: PlaybackHistoryItem[];
    style?: DJStyle;
    language?: DJLanguage;
}
export declare class NarratorAgent {
    generate(input: NarratorInput): Promise<string>;
    private getFallbackTemplate;
    private getSystemPrompt;
    private getUserPrompt;
    generateOutro(song: SongWiki, language?: DJLanguage): Promise<string>;
    private getFallbackOutro;
    private getOutroSystemPrompt;
    private getOutroUserPrompt;
}
