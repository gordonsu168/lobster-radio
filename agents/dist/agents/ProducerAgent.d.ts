import type { Preferences, Track } from "../types.js";
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
export interface ToolCall {
    name: "updateWiki" | "refreshRecommendations" | "searchAndAddTrack" | "setMood";
    parameters: Record<string, string | number | boolean>;
}
export interface ProducerOutput {
    reply: string;
    directives: {
        suggestedMood?: string;
        likedArtist?: string;
        dislikedArtist?: string;
        skipRequested?: boolean;
        memoryInsight?: string;
    };
    toolCalls?: ToolCall[];
}
export declare class ProducerAgent {
    generateResponse(message: string, history: ChatMessage[], currentTrack: Track | null, preferences: Preferences | null): Promise<ProducerOutput>;
}
