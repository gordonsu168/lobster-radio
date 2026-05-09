import { Router } from "express";
import { scanMusicLibrary, getLibraryStats } from "../services/musicLibraryService.js";
export const libraryRouter = Router();
// 获取音乐库统计
libraryRouter.get("/stats", async (_req, res) => {
    try {
        const stats = await getLibraryStats();
        res.json(stats);
    }
    catch (e) {
        res.status(500).json({ error: "Failed to get library stats" });
    }
});
// 重新扫描音乐库
libraryRouter.post("/scan", async (_req, res) => {
    try {
        const tracks = await scanMusicLibrary(true);
        res.json({ scanned: tracks.length, tracks });
    }
    catch (e) {
        res.status(500).json({ error: "Failed to scan music library" });
    }
});
// 流式播放音频文件
libraryRouter.get("/stream/:filePathBase64", async (req, res) => {
    try {
        const fs = await import("node:fs");
        const filePathBase64 = req.params.filePathBase64;
        const filePath = Buffer.from(filePathBase64, "base64url").toString("utf8");
        // 安全检查：确保文件路径在配置的音乐目录内
        const secrets = await import("../services/settingsResolver.js").then((m) => m.resolveRuntimeSecrets());
        if (!secrets.localMusicPath || !filePath.startsWith(secrets.localMusicPath)) {
            return res.status(403).json({ error: "Access denied" });
        }
        // 获取文件大小
        const stats = await fs.promises.stat(filePath);
        const fileSize = stats.size;
        // 根据文件扩展名设置正确的内容类型
        const ext = filePath.toLowerCase().split(".").pop();
        const contentType = {
            mp3: "audio/mpeg",
            m4a: "audio/mp4",
            aac: "audio/aac",
            wav: "audio/wav",
            flac: "audio/flac",
            ogg: "audio/ogg",
            opus: "audio/opus"
        }[ext || ""] || "audio/mpeg";
        // 支持范围请求
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600"
            });
            const stream = fs.createReadStream(filePath, { start, end });
            stream.on("error", () => res.status(404).end());
            stream.pipe(res);
        }
        else {
            res.writeHead(200, {
                "Accept-Ranges": "bytes",
                "Content-Length": fileSize,
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600"
            });
            const stream = fs.createReadStream(filePath);
            stream.on("error", () => res.status(404).end());
            stream.pipe(res);
        }
    }
    catch (e) {
        console.error("Stream error:", e);
        res.status(500).json({ error: "Failed to stream audio" });
    }
});
