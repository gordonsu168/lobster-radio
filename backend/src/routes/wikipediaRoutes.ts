import { Router, Request, Response } from "express";
import { searchWikipedia, searchSongInfo, enrichSongsWithWikipedia } from "../services/wikipediaService.js";
import { getAllSongs } from "../services/wikiService.js";

export const wikipediaRouter = Router();

// 搜索维基百科
wikipediaRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q as string;
    if (!query) {
      res.status(400).json({ error: "Query required" });
      return;
    }

    const results = await searchWikipedia(query);
    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: "Search failed" });
  }
});

// 搜索单首歌曲信息
wikipediaRouter.get("/song/:title", async (req: Request, res: Response) => {
  try {
    const artist = Array.isArray(req.query.artist) ? req.query.artist[0] : req.query.artist as string | undefined;
    const info = await searchSongInfo(req.params.title, artist);
    if (!info) {
      res.status(404).json({ error: "Song info not found" });
      return;
    }
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: "Failed to get song info" });
  }
});

// 批量补全歌曲信息
wikipediaRouter.post("/enrich", async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.body as { limit?: number };
    const allSongs = await getAllSongs();

    // 选择需要补全的歌曲（艺术家未知的优先）
    const songsToEnrich = allSongs
      .filter((s) => s.artist === "未知艺术家" || !s.artist)
      .slice(0, limit);

    if (songsToEnrich.length === 0) {
      res.json({ message: "No songs to enrich" });
      return;
    }

    // 开始异步处理
    res.json({
      message: `Started enriching ${songsToEnrich.length} songs with Wikipedia`,
      songs: songsToEnrich.map((s) => ({ id: s.id, title: s.title, artist: s.artist }))
    });

    // 后台处理
    enrichSongsWithWikipedia(songsToEnrich).then((count) => {
      console.log(`✅ Wikipedia enrichment complete: ${count}/${songsToEnrich.length} songs updated`);
    });
  } catch (e) {
    res.status(500).json({ error: "Enrichment failed" });
  }
});

// 手动补全指定歌曲
wikipediaRouter.post("/enrich/:songId", async (req: Request, res: Response) => {
  try {
    const { title, artist } = req.body as { title?: string; artist?: string };

    if (!title) {
      res.status(400).json({ error: "Title required" });
      return;
    }

    const info = await searchSongInfo(title, artist);
    if (!info) {
      res.status(404).json({ error: "No info found" });
      return;
    }

    // 更新到 Wiki
    const { updateSongWiki } = await import("../services/wikiService.js");
    await updateSongWiki(req.params.songId, info as any);

    res.json({ songId: req.params.songId, info });
  } catch (e) {
    res.status(500).json({ error: "Failed to enrich song" });
  }
});
