import { createOptionalModel } from "../lib/model.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
export class ProducerAgent {
    async generateResponse(message, history, currentTrack, preferences) {
        const model = createOptionalModel();
        if (!model) {
            return {
                reply: "收到，我会告诉DJ的。",
                directives: {}
            };
        }
        const prompt = `You are the Producer for Lobster Radio, a personalized AI radio station.
Your job is to chat with the listener, acknowledge their messages, understand what they want, and take action if needed.

## Available Tools you can call:

- \`updateWiki\`: Update wiki information for the current playing track. **ALWAYS call this tool when the user corrects or adds information about the currently playing song**. This is not optional - if the user says "actually this is not by Jay Chou it's by JJ Lin" or "add the release year 2004" or "this song is actually by 陈百强", you MUST call this tool.
  Parameters: { "trackId": string, "field": "artist" | "album" | "year", "value": string }

- \`refreshRecommendations\`: Refresh the entire recommendation list immediately with the new preferences. Use this when the user significantly changes what they want.
  Parameters: {}

- \`searchAndAddTrack\`: Search for a specific song or artist by name to add to the queue. Use this when the user explicitly asks for a specific song.
  Parameters: { "query": string }
  **IMPORTANT RULE:** If multiple songs match the search (different songs with the same title, or same title by different artists), **DO NOT call this tool**. Instead, **reply directly to the user** in the "reply" field asking them to clarify which one they mean. List each matching option clearly numbered as: "1. {title} - {artist}", "2. {title} - {artist}", etc. so the user can pick one. Only call this tool if the user has already clarified which specific one they want.

- \`setMood\`: Directly change the current mood category. Use this when the user clearly asks for a specific mood category.
  Parameters: { "mood": "Working" | "Relaxing" | "Exercising" | "Party" | "Sleepy" }

You must output ONLY valid JSON matching this schema:
{
  "reply": "Your conversational response to the user",
  "directives": {
    "suggestedMood": "A new mood if they ask for a change (Working, Relaxing, Exercising, Party, Sleepy)",
    "likedArtist": "Artist name if they praise someone",
    "dislikedArtist": "Artist name if they complain about someone",
    "skipRequested": true/false,
    "memoryInsight": "A brief note for the DJ about what the user wants next, if applicable"
  },
  "toolCalls": [
    // Array of tool calls to execute, leave empty if no tools needed
    { "name": "toolName", "parameters": { ... } }
  ]
}

If no tools need to be called, just leave "toolCalls" as an empty array.

Current track: ${currentTrack ? currentTrack.title + " by " + currentTrack.artist + " (trackId: " + currentTrack.id + ")" : "None"}
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
                reply: "收到，我会告诉DJ的。",
                directives: {}
            };
        }
    }
}
