import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
const dataDir = path.resolve(process.cwd(), "src/data/runtime");
const preferencesPath = path.join(dataDir, "preferences.json");
const settingsPath = path.join(dataDir, "settings.json");
let db;
async function ensureDir() {
    await fs.mkdir(dataDir, { recursive: true });
}
// Initialize SQLite Database
function initDb() {
    if (db)
        return;
    db = new Database(path.join(dataDir, "history.db"));
    db.pragma('journal_mode = WAL'); // Better concurrency
    db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT,
      title TEXT,
      artist TEXT,
      album TEXT,
      preview_url TEXT,
      artwork TEXT,
      mood_tags TEXT,
      energy INTEGER,
      explanation TEXT,
      source TEXT,
      played_at TEXT,
      feedback TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT,
      content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
const defaultPreferences = {
    likes: [],
    dislikes: [],
    history: [],
    moodAffinity: {},
    chatHistory: []
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
    djStyle: "classic",
    enableAiNarration: true,
    preferredMusicSource: "auto",
    localMusicPath: ""
};
// --- SQLite Methods ---
export function addPlayHistory(item) {
    initDb();
    const stmt = db.prepare(`
    INSERT INTO history (
      track_id, title, artist, album, preview_url, artwork, mood_tags, energy, explanation, source, played_at, feedback
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(item.id, item.title, item.artist, item.album, item.previewUrl, item.artwork, JSON.stringify(item.moodTags || []), item.energy, item.explanation, item.source, item.playedAt, item.feedback || null);
}
export function updateFeedback(trackId, feedback) {
    initDb();
    const stmt = db.prepare(`
    UPDATE history SET feedback = ? WHERE id = (
      SELECT id FROM history WHERE track_id = ? ORDER BY played_at DESC LIMIT 1
    )
  `);
    stmt.run(feedback, trackId);
}
export function getPlayHistory(limit = 50) {
    initDb();
    const stmt = db.prepare(`SELECT * FROM history ORDER BY played_at DESC LIMIT ?`);
    const rows = stmt.all(limit);
    return rows.map(row => ({
        id: row.track_id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        previewUrl: row.preview_url,
        artwork: row.artwork,
        moodTags: JSON.parse(row.mood_tags || '[]'),
        energy: row.energy,
        explanation: row.explanation,
        source: row.source,
        playedAt: row.played_at,
        feedback: row.feedback
    }));
}
export function addChatHistory(role, content) {
    initDb();
    const stmt = db.prepare(`INSERT INTO chat_history (role, content) VALUES (?, ?)`);
    stmt.run(role, content);
}
export function getChatHistory(limit = 50) {
    initDb();
    const stmt = db.prepare(`SELECT role, content FROM chat_history ORDER BY id DESC LIMIT ?`);
    const rows = stmt.all(limit);
    return rows.reverse();
}
// --- JSON Methods ---
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
let migrated = false;
export async function getPreferences() {
    await ensureDir();
    initDb();
    const prefs = await readJson(preferencesPath, defaultPreferences);
    // One-time migration
    if (!migrated && ((prefs.history && prefs.history.length > 0) || (prefs.chatHistory && prefs.chatHistory.length > 0))) {
        console.log("Migrating JSON history to SQLite...");
        db.transaction(() => {
            if (prefs.history) {
                for (const item of [...prefs.history].reverse()) {
                    addPlayHistory(item);
                }
            }
            if (prefs.chatHistory) {
                for (const msg of prefs.chatHistory) {
                    addChatHistory(msg.role, msg.content);
                }
            }
        })();
        migrated = true;
        // Save to strip them from JSON
        await savePreferences(prefs);
    }
    // Always return the latest history from DB
    prefs.history = getPlayHistory(50);
    prefs.chatHistory = getChatHistory(50);
    return prefs;
}
export async function savePreferences(preferences) {
    // Strip out the array data so it's not saved to JSON
    const toSave = { ...preferences };
    delete toSave.history;
    delete toSave.chatHistory;
    await writeJson(preferencesPath, toSave);
    return preferences;
}
export async function getRuntimeSettings() {
    return readJson(settingsPath, defaultSettings);
}
export async function saveRuntimeSettings(settings) {
    await writeJson(settingsPath, settings);
    return settings;
}
