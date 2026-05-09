import type { MoodOption, Preferences } from "../types.js";
interface LearningInput {
    trackId: string;
    feedback: "like" | "dislike";
    mood: MoodOption;
    preferences: Preferences;
}
export declare class LearningAgent {
    learn(input: LearningInput): Promise<Preferences>;
}
export {};
