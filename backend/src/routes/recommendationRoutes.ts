import { Router } from "express";
import { buildRecommendations, captureFeedback } from "../services/recommendationService.js";
import type { MoodOption } from "../types.js";

export const recommendationRouter = Router();

recommendationRouter.get("/", async (req, res) => {
  const mood = (req.query.mood as MoodOption | undefined) ?? "Working";
  const payload = await buildRecommendations(mood);
  res.json(payload);
});

recommendationRouter.post("/feedback", async (req, res) => {
  const { trackId, feedback, mood } = req.body as {
    trackId: string;
    feedback: "like" | "dislike";
    mood: MoodOption;
  };
  const payload = await captureFeedback(trackId, feedback, mood);
  res.json(payload);
});
