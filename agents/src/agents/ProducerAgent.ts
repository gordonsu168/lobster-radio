import { callModel } from "../lib/model.js";
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

export class ProducerAgent {
  async generateResponse(
    message: string,
    history: ChatMessage[],
    currentTrack: Track | null,
    preferences: Preferences | null
  ): Promise<ProducerOutput> {
    const prompt = `You are the Producer for Lobster Radio, a personalized AI radio station.
Your job is to chat with the listener, acknowledge their messages, and extract any directives or preferences.
You must output ONLY valid JSON matching this schema:
{
  "reply": "Your conversational response",
  "directives": {
    "suggestedMood": "A new mood if they ask for a change (Working, Relaxing, Exercising, Party, Sleepy)",
    "likedArtist": "Artist name if they praise someone",
    "dislikedArtist": "Artist name if they complain about someone",
    "skipRequested": true/false,
    "memoryInsight": "A brief note for the DJ about what the user wants next, if applicable"
  }
}

Current track: ${currentTrack ? currentTrack.title + " by " + currentTrack.artist : "None"}
Current mood: ${preferences?.moodAffinity ? Object.keys(preferences.moodAffinity)[0] : "Working"}
History: ${JSON.stringify(history)}
User message: ${message}`;

    try {
      const response = await callModel({
        system: "You output strictly valid JSON.",
        prompt,
        temperature: 0.7,
      });
      return JSON.parse(response) as ProducerOutput;
    } catch (e) {
      console.error("ProducerAgent failed to parse JSON", e);
      return {
        reply: "Got it. I'll let the DJ know.",
        directives: {}
      };
    }
  }
}
