import type { Preferences, Track } from "../types.js";
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
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
}
export declare class ProducerAgent {
    generateResponse(message: string, history: ChatMessage[], currentTrack: Track | null, preferences: Preferences | null): Promise<ProducerOutput>;
}
