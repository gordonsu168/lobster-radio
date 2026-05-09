import type { MoodOption, PlaybackHistoryItem, Track } from "../types.js";
interface NarratorInput {
    mood: MoodOption;
    contextSummary: string;
    track: Track;
    history: PlaybackHistoryItem[];
}
export declare class NarratorAgent {
    generate(input: NarratorInput): Promise<string>;
}
export {};
