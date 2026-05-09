import { Router } from "express";
import { buildRecommendations, captureFeedback } from "../services/recommendationService.js";
import type { MoodOption } from "../types.js";
import type { DJStyle } from "lobster-radio-agents";

export const recommendationRouter = Router();

recommendationRouter.get("/", async (req, res) => {
  const mood = (req.query.mood as MoodOption | undefined) ?? "Working";
  const style = (req.query.style as DJStyle | undefined) ?? "classic";
  const language = (req.query.language as string | undefined) ?? "zh-CN";
  const payload = await buildRecommendations(mood, style, language);
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
