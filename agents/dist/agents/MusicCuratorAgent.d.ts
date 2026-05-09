import type { MoodOption, Preferences, Track } from "../types.js";
interface MusicCuratorInput {
    mood: MoodOption;
    contextSummary: string;
    candidateTracks: Track[];
    preferences: Preferences;
}
export declare class MusicCuratorAgent {
    curate(input: MusicCuratorInput): Promise<Track[]>;
}
export {};
