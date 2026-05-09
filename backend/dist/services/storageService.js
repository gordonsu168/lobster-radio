import fs from "node:fs/promises";
import path from "node:path";
const dataDir = path.resolve(process.cwd(), "src/data/runtime");
const preferencesPath = path.join(dataDir, "preferences.json");
const settingsPath = path.join(dataDir, "settings.json");
const defaultPreferences = {
    likes: [],
    dislikes: [],
    history: [],
    moodAffinity: {}
};
const defaultSettings = {
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
async function readJson(filePath, fallback) {
    await ensureDir();
    try {
        const contents = await fs.readFile(filePath, "utf8");
        return JSON.parse(contents);
    }
    catch {
        await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
        return fallback;
    }
}
async function writeJson(filePath, payload) {
    await ensureDir();
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}
export async function getPreferences() {
    return readJson(preferencesPath, defaultPreferences);
}
export async function savePreferences(preferences) {
    await writeJson(preferencesPath, preferences);
    return preferences;
}
export async function getRuntimeSettings() {
    return readJson(settingsPath, defaultSettings);
}
export async function saveRuntimeSettings(settings) {
    await writeJson(settingsPath, settings);
    return settings;
}
