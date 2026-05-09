import { Router } from "express";
import { synthesizeSpeech } from "../services/ttsService.js";

export const ttsRouter = Router();

ttsRouter.post("/", async (req, res) => {
  const { text, voice } = req.body as { text: string; voice?: string };
  const payload = await synthesizeSpeech(text, voice);
  res.json(payload);
});
