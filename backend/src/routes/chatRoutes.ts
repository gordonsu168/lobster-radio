import { Router } from "express";
import { ProducerAgent, type ChatMessage, type ToolCall } from "lobster-radio-agents";
import { getPreferences, savePreferences } from "../services/storageService.js";
import { getSongWiki, updateSongWiki } from "../services/wikiService.js";
import type { Track } from "lobster-radio-agents";

export const chatRouter = Router();
const producer = new ProducerAgent();

chatRouter.post("/", async (req, res) => {
  try {
    // Input validation
    if (!req.body.message || typeof req.body.message !== "string") {
      return res.status(400).json({
        error: "Invalid input",
        message: "Message is required and must be a string"
      });
    }

    // Validate history - default to empty array if missing or not an array
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    // Validate currentTrack - allow null/undefined as per type signature
    const currentTrack = req.body.currentTrack === null || req.body.currentTrack === undefined ? null : req.body.currentTrack;
    const message = req.body.message;

    const prefs = await getPreferences();
    const output = await producer.generateResponse(message, history, currentTrack, prefs);

    // Apply directives implicitly
    let updated = false;
    if (output.directives) {
      if (output.directives.memoryInsight) {
        prefs.memoryInsight = output.directives.memoryInsight;
        updated = true;
      }

      if (output.directives.suggestedMood) {
        prefs.moodAffinity[output.directives.suggestedMood] = (prefs.moodAffinity[output.directives.suggestedMood] || 0) + 1;
        updated = true;
      }

      if (output.directives.likedArtist) {
        if (!prefs.likes.includes(output.directives.likedArtist)) {
          prefs.likes.push(output.directives.likedArtist);
          updated = true;
        }
      }

      if (output.directives.dislikedArtist) {
        if (!prefs.dislikes.includes(output.directives.dislikedArtist)) {
          prefs.dislikes.push(output.directives.dislikedArtist);
          updated = true;
        }
      }
    }

    // Execute tool calls if any
    const toolResults: Array<{ name: string; result: string }> = [];
    if (output.toolCalls && output.toolCalls.length > 0) {
      for (const toolCall of output.toolCalls) {
        try {
          switch (toolCall.name) {
            case "updateWiki": {
              const { trackId, field, value } = toolCall.parameters as {
                trackId: string;
                field: "artist" | "album" | "year";
                value: string
              };
              const wiki = await getSongWiki(trackId);
              if (wiki) {
                (wiki as any)[field] = value;
                await updateSongWiki(trackId, wiki);
                toolResults.push({
                  name: "updateWiki",
                  result: `Updated ${field} to "${value}"`
                });
                console.log(`[Producer Tool] Updated wiki for track ${trackId}: ${field} = ${value}`);
              }
              break;
            }
            case "setMood": {
              const { mood } = toolCall.parameters as { mood: string };
              prefs.moodAffinity[mood] = (prefs.moodAffinity[mood] || 0) + 1;
              updated = true;
              toolResults.push({ name: "setMood", result: `Set mood to "${mood}"` });
              break;
            }
            case "refreshRecommendations": {
              // Refresh is handled by frontend after chat response
              toolResults.push({ name: "refreshRecommendations", result: "Triggered refresh" });
              break;
            }
            case "searchAndAddTrack": {
              // Search the wiki database for matching songs
              const { query } = toolCall.parameters as { query: string };
              const { searchWiki } = await import("../services/wikiService.js");
              const results = await searchWiki(query);
              if (results.length === 0) {
                toolResults.push({ name: "searchAndAddTrack", result: `No songs found matching "${query}"` });
              } else if (results.length === 1) {
                // Add the matching song to... (will be picked up in next recommendation)
                toolResults.push({ name: "searchAndAddTrack", result: `Found "${results[0].title}" by ${results[0].artist}` });
              } else {
                // Multiple matches - need to ask user to choose
                toolResults.push({
                  name: "searchAndAddTrack",
                  result: `Found ${results.length} matches: ${results.map(s => `${s.title} - ${s.artist}`).join("; ")}`
                });
              }
              break;
            }
          }
        } catch (e) {
          console.error(`[Producer Tool] Error executing ${toolCall.name}:`, e);
          toolResults.push({ name: toolCall.name, result: `Error: ${e}` });
        }
      }

      if (updated) {
        await savePreferences(prefs);
      }
    }

    console.log(`[Producer Chat] User message: "${message}" → reply: "${output.reply}", ${toolResults.length} tool calls executed`);
    toolResults.forEach(t => console.log(`  - ${t.name}: ${t.result}`));

    res.status(200).json({
      reply: output.reply,
      skipRequested: !!output.directives?.skipRequested,
      toolResults
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to process chat request"
    });
  }
});
