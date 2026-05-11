import { Router } from "express";
import { ProducerAgent, type ChatMessage } from "lobster-radio-agents";
import { getPreferences, savePreferences } from "../services/storageService.js";
import type { Track } from "lobster-radio-agents";

export const chatRouter = Router();
const producer = new ProducerAgent();

chatRouter.post("/", async (req, res) => {
  const { message, history, currentTrack } = req.body as {
    message: string;
    history: ChatMessage[];
    currentTrack: Track | null;
  };

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

  res.json({
    reply: output.reply,
    skipRequested: !!output.directives.skipRequested
  });
});
