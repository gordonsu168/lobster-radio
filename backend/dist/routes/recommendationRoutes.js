import { Router } from "express";
import { buildRecommendations, captureFeedback } from "../services/recommendationService.js";
export const recommendationRouter = Router();
recommendationRouter.get("/", async (req, res) => {
    const mood = req.query.mood ?? "Working";
    const payload = await buildRecommendations(mood);
    res.json(payload);
});
recommendationRouter.post("/feedback", async (req, res) => {
    const { trackId, feedback, mood } = req.body;
    const payload = await captureFeedback(trackId, feedback, mood);
    res.json(payload);
});
