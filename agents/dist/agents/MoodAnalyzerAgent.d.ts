import type { DJLanguage, MoodOption } from "../types.js";
interface MoodAnalyzerInput {
    selectedMood: MoodOption;
    timeOfDay: string;
    weatherApiKey?: string;
    language?: DJLanguage;
}
export declare class MoodAnalyzerAgent {
    analyze(input: MoodAnalyzerInput): Promise<{
        summary: string;
    }>;
    private getFallbackTemplate;
    private getSystemPrompt;
    private getUserPrompt;
}
export {};
