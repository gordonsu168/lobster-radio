import { createOptionalModel } from "../lib/model.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
export class MemoryAgent {
    async summarize(prefs) {
        const model = createOptionalModel();
        if (!model) {
            return null;
        }
        // Limit the history we send to the LLM to avoid context limits
        // We send the last 20 chat messages and the last 30 played songs
        const recentChats = prefs.chatHistory ? prefs.chatHistory.slice(-20) : [];
        const recentPlays = prefs.history ? prefs.history.slice(-30).map(t => `${t.title} - ${t.artist} [${t.feedback || "no-feedback"}]`) : [];
        const prompt = `You are the Memory & Profiling Agent for Lobster Radio.
Your job is to analyze the user's recent music listening history and their chats with the Producer, and update the "User Profile / Memory Insight".

Current Memory Insight:
${prefs.memoryInsight || "None"}

Top Likes (Artists):
${prefs.likes.join(", ") || "None"}

Dislikes (Artists):
${prefs.dislikes.join(", ") || "None"}

Recent Play History (Last 30 tracks):
${recentPlays.join("\n")}

Recent Chat with Producer:
${recentChats.map(c => `[${c.role.toUpperCase()}]: ${c.content}`).join("\n")}

Based on the above data, please write an updated, comprehensive User Profile. This profile will be used by the Radio DJ and the Producer to better serve the user.
Include things like:
- General mood preference (based on history)
- Music taste (genres, artists, eras if apparent)
- Specific feedback they gave to the producer recently
- What they are likely doing right now (e.g., "seems to be working based on recent chats")

Return ONLY the updated profile text. Do not include markdown formatting like \`\`\` or extra preamble. Just the raw profile text.`;
        try {
            const result = await model.invoke([
                new SystemMessage("You are an analytical agent that creates concise, accurate user profiles based on data. You output only the profile text."),
                new HumanMessage(prompt)
            ]);
            const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
            return content.trim();
        }
        catch (e) {
            console.error("MemoryAgent failed to generate summary", e);
            return null;
        }
    }
}
