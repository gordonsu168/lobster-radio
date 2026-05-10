import { Router } from "express";
import { buildRecommendations, captureFeedback } from "../services/recommendationService.js";
export const recommendationRouter = Router();
recommendationRouter.get("/", async (req, res) => {
    const mood = req.query.mood ?? "Working";
    const style = req.query.style ?? "classic";
    const language = req.query.language ?? "zh-CN";
    const payload = await buildRecommendations(mood, style, language);
    res.json(payload);
});
recommendationRouter.post("/feedback", async (req, res) => {
    const { trackId, feedback, mood } = req.body;
    const payload = await captureFeedback(trackId, feedback, mood);
    res.json(payload);
});
