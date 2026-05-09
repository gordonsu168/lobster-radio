import fs from "node:fs/promises";
import path from "node:path";
import type { Preferences, RuntimeSettings } from "../types.js";

const dataDir = path.resolve(process.cwd(), "src/data/runtime");
const preferencesPath = path.join(dataDir, "preferences.json");
const settingsPath = path.join(dataDir, "settings.json");

const defaultPreferences: Preferences = {
  likes: [],
  dislikes: [],
  history: [],
  moodAffinity: {}
};

const defaultSettings: RuntimeSettings = {
  spotifyClientId: "",
  spotifyClientSecret: "",
  neteaseApiEnabled: true,
  neteaseApiUrl: "",
  openAiApiKey: "",
  elevenLabsApiKey: "",
  defaultVoice: "alloy",
  defaultTtsProvider: "openai",
  preferredMusicSource: "auto",
  localMusicPath: ""
};

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDir();
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function writeJson<T>(filePath: string, payload: T) {
  await ensureDir();
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export async function getPreferences() {
  return readJson(preferencesPath, defaultPreferences);
}

export async function savePreferences(preferences: Preferences) {
  await writeJson(preferencesPath, preferences);
  return preferences;
}

export async function getRuntimeSettings() {
  return readJson(settingsPath, defaultSettings);
}

export async function saveRuntimeSettings(settings: RuntimeSettings) {
  await writeJson(settingsPath, settings);
  return settings;
}
