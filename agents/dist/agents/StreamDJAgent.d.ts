import type { DJLanguage, DJStyle, MoodOption } from "../types.js";
import type { SongWiki } from "./RadioDJAgent.js";
export interface StreamDJResponse {
    dj_talk: string;
    song_query: {
        keywords: string[];
        mood: MoodOption;
    };
}
export declare class StreamDJAgent {
    private getTimeOfDay;
    private getTimeTone;
    private getStyleDescription;
    private getSystemPrompt;
    generateNextSegment(historyContext: string, lastSong: SongWiki | null, style?: DJStyle, language?: DJLanguage): Promise<StreamDJResponse>;
}
