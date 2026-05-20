import { Router } from "express";
import { getRuntimeSettings, saveRuntimeSettings } from "../services/storageService.js";
import { getDJIdentity, saveDJIdentity, getDJPersona, saveDJPersona } from "../services/djIdentityService.js";
import type { RuntimeSettings, DJIdentity } from "../types.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const settings = await getRuntimeSettings();
  res.json(settings);
});

settingsRouter.put("/", async (req, res) => {
  const payload = req.body as RuntimeSettings;
  const saved = await saveRuntimeSettings(payload);
  res.json(saved);
});

settingsRouter.get("/dj-identity", (_req, res) => {
  const identity = getDJIdentity();
  res.json(identity);
});

settingsRouter.put("/dj-identity", (req, res) => {
  const payload = req.body as DJIdentity;
  saveDJIdentity(payload);
  res.json({ success: true });
});

settingsRouter.get("/dj-persona", (_req, res) => {
  const persona = getDJPersona();
  res.json({ persona });
});

settingsRouter.put("/dj-persona", (req, res) => {
  const { persona } = req.body;
  saveDJPersona(persona);
  res.json({ success: true });
});
