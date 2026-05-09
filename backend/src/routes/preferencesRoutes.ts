import { Router } from "express";
import { getPreferences } from "../services/storageService.js";

export const preferencesRouter = Router();

preferencesRouter.get("/", async (_req, res) => {
  const preferences = await getPreferences();
  res.json(preferences);
});
