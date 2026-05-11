import type { DJLanguage, MoodOption, PlaybackHistoryItem, Track } from "../types.js";
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
}
