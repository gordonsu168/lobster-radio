import type { MoodOption } from "../types.js";
interface MoodAnalyzerInput {
    selectedMood: MoodOption;
    timeOfDay: string;
    weatherApiKey?: string;
}
export declare class MoodAnalyzerAgent {
    analyze(input: MoodAnalyzerInput): Promise<{
        summary: string;
    }>;
}
export {};
