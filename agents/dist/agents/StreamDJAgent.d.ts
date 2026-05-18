import type { DJLanguage, DJStyle, MoodOption, ThemeContext, ThemePhase } from "../types.js";
import type { SongWiki } from "./RadioDJAgent.js";
export interface MidSongInsert {
    text: string;
    timing: 'early' | 'middle' | 'late';
    type: 'trivia' | 'commentary' | 'listener_response';
}
export interface StreamDJResponse {
    dj_talk: string;
    song_query: {
        keywords: string[];
        mood: MoodOption;
    };
    mid_song_inserts?: MidSongInsert[];
    theme_update?: {
        theme: string;
        phase: ThemePhase;
        coveredTopics: string[];
    };
}
export interface PlaylistSong {
    artist: string;
    title: string;
    keywords: string[];
    mood: MoodOption;
}
export interface PlaylistResponse {
    theme_update: {
        theme: string;
        phase: ThemePhase;
        coveredTopics: string[];
    };
    songs: PlaylistSong[];
    intro_talk: string;
}
export interface TrackInfo {
    title: string;
    artist: string;
    album?: string;
    explanation?: string;
    funFact?: string;
    trivia?: string;
}
export interface NarrationResponse {
    dj_talk: string;
    mid_song_inserts?: MidSongInsert[];
    theme_update?: {
        theme: string;
        phase: ThemePhase;
        coveredTopics: string[];
    };
}
export declare class StreamDJAgent {
    private getTimeOfDay;
    private getTimeTone;
    private getStyleDescription;
    private getSystemPrompt;
    generateNextSegment(historyContext: string, lastSong: SongWiki | null, style?: DJStyle, language?: DJLanguage, themeContext?: ThemeContext, libraryContext?: string): Promise<StreamDJResponse>;
    private parseJsonResponse;
    generatePlaylist(libraryContext: string, language?: DJLanguage, style?: DJStyle, themeContext?: ThemeContext, count?: number): Promise<PlaylistResponse>;
    generateNarrationForTrack(track: TrackInfo, themeContext: ThemeContext | undefined, language?: DJLanguage, style?: DJStyle, historyContext?: string): Promise<NarrationResponse>;
}
