import { Router } from "express";
import { ProducerAgent, type ChatMessage } from "lobster-radio-agents";
import { getPreferences, savePreferences } from "../services/storageService.js";
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
    if (output.directives) {
      let updated = false;

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

      if (updated) {
        await savePreferences(prefs);
      }
    }

    res.status(200).json({
      reply: output.reply,
      skipRequested: !!output.directives.skipRequested
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to process chat request"
    });
  }
});
