import { createOptionalModel } from "../lib/model.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
export class ProducerAgent {
    async generateResponse(message, history, currentTrack, preferences) {
        const model = createOptionalModel();
        if (!model) {
            return {
                reply: "Got it. I'll let the DJ know.",
                directives: {}
            };
        }
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
            const result = await model.invoke([
                new SystemMessage("You output strictly valid JSON."),
                new HumanMessage(prompt)
            ]);
            const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
            // clean up any markdown code blocks
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanContent);
        }
        catch (e) {
            console.error("ProducerAgent failed to parse JSON", e);
            return {
                reply: "Got it. I'll let the DJ know.",
                directives: {}
            };
        }
    }
}
