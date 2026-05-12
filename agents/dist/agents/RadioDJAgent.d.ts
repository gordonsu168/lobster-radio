import type { DJLanguage, MoodOption, DJStyle } from "../types.js";
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
export declare class RadioDJAgent {
    private getTimeOfDay;
    private getTimeTone;
    private getStyleDescription;
    generateIntro(song: SongWiki, mood: MoodOption, style: DJStyle, language: DJLanguage, contextSummary: string, memoryInsight?: string): Promise<string>;
    generateOutro(song: SongWiki, style: DJStyle, language: DJLanguage, contextSummary: string, memoryInsight?: string): Promise<string>;
    generateMidTrackTrivia(song: SongWiki, style: DJStyle, language: DJLanguage, preStoredFact?: string): Promise<string>;
    private getSystemPrompt;
    private getIntroUserPrompt;
    private getOutroUserPrompt;
    private getTriviaUserPrompt;
    private getFallbackIntro;
    private getFallbackOutro;
    private getFallbackTrivia;
}
