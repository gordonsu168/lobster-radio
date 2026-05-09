import type { MoodOption, PlaybackHistoryItem, Track } from "../types.js";
export type DJStyle = "classic" | "night" | "vibe" | "trivia";
interface NarratorInput {
    mood: MoodOption;
    contextSummary: string;
    track: Track;
    history: PlaybackHistoryItem[];
    style?: DJStyle;
}
export declare class NarratorAgent {
    generate(input: NarratorInput): Promise<string>;
}
export {};
