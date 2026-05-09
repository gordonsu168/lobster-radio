import { Router } from "express";
import { getRuntimeSettings, saveRuntimeSettings } from "../services/storageService.js";
export const settingsRouter = Router();
settingsRouter.get("/", async (_req, res) => {
    const settings = await getRuntimeSettings();
    res.json(settings);
});
settingsRouter.put("/", async (req, res) => {
    const payload = req.body;
    const saved = await saveRuntimeSettings(payload);
    res.json(saved);
});
