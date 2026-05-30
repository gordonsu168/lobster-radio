import { Router } from "express";
import { getRuntimeSettings, saveRuntimeSettings } from "../services/storageService.js";
import { getDJIdentity, saveDJIdentity, getDJPersona, saveDJPersona } from "../services/djIdentityService.js";
import type { RuntimeSettings, DJIdentity } from "../types.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const settings = await getRuntimeSettings();
  // 合并环境变量中的小米音响配置
  (settings as any).xiaomiSpeaker = {
    enabled: process.env.XIAOMI_SPEAKER_ENABLED === "true" || (settings as any).xiaomiSpeaker?.enabled || false,
    apiUrl: process.env.XIAOMI_SPEAKER_API_URL || (settings as any).xiaomiSpeaker?.apiUrl || "http://localhost:8090",
    deviceId: process.env.XIAOMI_SPEAKER_DEVICE_ID || (settings as any).xiaomiSpeaker?.deviceId || "",
    lanHost: process.env.XIAOMI_SPEAKER_LAN_HOST || (settings as any).xiaomiSpeaker?.lanHost || "",
  };
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
