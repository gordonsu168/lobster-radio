import express from "express";
import cors from "cors";
import { recommendationRouter } from "./routes/recommendationRoutes.js";
import { preferencesRouter } from "./routes/preferencesRoutes.js";
import { settingsRouter } from "./routes/settingsRoutes.js";
import { ttsRouter } from "./routes/ttsRoutes.js";
import { libraryRouter } from "./routes/libraryRoutes.js";
import { wikiRouter } from "./routes/wikiRoutes.js";
import { wikipediaRouter } from "./routes/wikipediaRoutes.js";
import { resolveRuntimeSecrets } from "./services/settingsResolver.js";
import { scanMusicLibrary } from "./services/musicLibraryService.js";
import { importSongsFromTracks } from "./services/wikiService.js";
const app = express();
async function start() {
    const secrets = await resolveRuntimeSecrets();
    const port = Number(process.env.PORT || 4000);
    // 音频流需要更宽松的 CORS 配置
    app.use(cors({ origin: true, credentials: false }));
    app.use(express.json({ limit: "2mb" }));
    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, service: "lobster-radio-backend" });
    });
    app.use("/api/recommendations", recommendationRouter);
    app.use("/api/preferences", preferencesRouter);
    app.use("/api/settings", settingsRouter);
    app.use("/api/tts", ttsRouter);
    app.use("/api/library", libraryRouter);
    app.use("/api/wiki", wikiRouter);
    app.use("/api/wikipedia", wikipediaRouter);
    // 启动时自动导入歌曲到 Wiki
    (async () => {
        try {
            const allTracks = await scanMusicLibrary(true);
            await importSongsFromTracks(allTracks);
            console.log(`Auto-imported ${allTracks.length} tracks to Wiki`);
        }
        catch (e) {
            console.warn("Wiki import failed, but server still works:", e);
        }
    })();
    app.listen(port, () => {
        console.log(`Lobster Radio backend listening on http://localhost:${port}`);
    });
}
start().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
});
