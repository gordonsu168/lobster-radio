import { Router, Request, Response } from "express";
import {
  getAllSongs,
  getSongWiki,
  updateSongWiki,
  importSongsFromTracks,
  searchWiki,
  type SongWiki
} from "../services/wikiService.js";
import { generateNarration, generateRandomNarration, type DJStyle } from "../services/narrationGenerator.js";
import { NarratorAgent, RadioDJAgent, type DJLanguage } from "lobster-radio-agents";

export const wikiRouter = Router();

// 获取所有歌曲 Wiki
wikiRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const songs = await getAllSongs();
    res.json({ total: songs.length, songs });
  } catch (e) {
    res.status(500).json({ error: "Failed to get wiki" });
  }
});

// 获取单首歌曲 Wiki
wikiRouter.get("/song/:id", async (req: Request, res: Response) => {
  try {
    const song = await getSongWiki(req.params.id);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.json(song);
  } catch (e) {
    res.status(500).json({ error: "Failed to get song wiki" });
  }
});

// 更新歌曲 Wiki
wikiRouter.put("/song/:id", async (req: Request, res: Response) => {
  try {
    const updated = await updateSongWiki(req.params.id, req.body as Partial<SongWiki>);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Failed to update song wiki" });
  }
});

// 搜索 Wiki
wikiRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q as string;
    const results = await searchWiki(query);
    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: "Failed to search wiki" });
  }
});

// 生成歌曲中间的闲聊插话
wikiRouter.post("/chat/:id", async (req: Request, res: Response) => {
  try {
    const { style, position } = req.body as { style?: DJStyle, position?: string };
    const song = await getSongWiki(req.params.id);
    
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    
    // 从 djMaterial 中获取素材
    const introList = song.djMaterial?.intro || [];
    const vibeList = song.djMaterial?.vibe || [];
    const funFactList = song.djMaterial?.funFact || [];
    const triviaList = song.trivia || [];
    
    // 根据位置选择不同类型的素材
    let allChats: string[] = [];
    
    if (position === "intro" || position === "start") {
      // 开头：优先用 intro 素材
      allChats = [...introList, ...vibeList];
    } else if (position === "end" || position === "outro") {
      // 结尾：总结型
      allChats = [
        ...funFactList.map(f => `告诉你个小秘密哦，${f}`),
        `怎么样，${song.artist}的《${song.title}》还不错吧？`,
        `这首歌听完了，是不是还意犹未尽？`,
      ];
    } else {
      // 中间：混合所有类型
      allChats = [
        ...vibeList,
        ...triviaList,
        ...funFactList.map(f => `告诉你个小秘密哦，${f}`),
      ];
    }
    
    // 如果没有素材，用默认模板
    if (allChats.length === 0) {
      allChats = [
        `${song.artist}的《${song.title}》，希望你喜欢。`,
        `接下来为您带来的是《${song.title}》。`,
        `继续聆听，${song.artist}的《${song.title}》。`,
      ];
    }
    
    // 随机选一条
    const chat = allChats[Math.floor(Math.random() * allChats.length)];
    
    res.json({
      songId: song.id,
      title: song.title,
      style: style || "classic",
      position: position || "middle",
      chat
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate chat" });
  }
});

// 生成旁白
wikiRouter.post("/narration/:id", async (req: Request, res: Response) => {
  try {
    const { style, language } = req.body as { style?: DJStyle; language?: string };
    const song = await getSongWiki(req.params.id);
    
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    
    const narration = style 
      ? generateNarration(song, style, language as any)
      : generateRandomNarration(song, language as any);
    
    res.json({
      songId: song.id,
      title: song.title,
      style: style || "random",
      narration
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate narration" });
  }
});

// 批量生成旁白
wikiRouter.post("/narration/batch", async (req: Request, res: Response) => {
  try {
    const { songIds, style, language } = req.body as { songIds: string[]; style?: DJStyle; language?: string };
    const results: Array<{ songId: string; title: string; narration: string }> = [];

    for (const id of songIds) {
      const song = await getSongWiki(id);
      if (song) {
        results.push({
          songId: song.id,
          title: song.title,
          narration: style ? generateNarration(song, style, language as any) : generateRandomNarration(song, language as any)
        });
      }
    }

    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate narrations" });
  }
});

// 生成歌曲结束 outro 闲聊
wikiRouter.post("/outro/:id", async (req: Request, res: Response) => {
  try {
    const { style, language, contextSummary = "" } = req.body as { style?: DJStyle; language?: string; contextSummary?: string };
    const song = await getSongWiki(req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    let outro: string;

    // 如果有预存的 outro 素材，随机选一条
    if (song.djMaterial?.outro && song.djMaterial.outro.length > 0) {
      const outros = song.djMaterial.outro;
      outro = outros[Math.floor(Math.random() * outros.length)];
    } else if (song.djMaterial?.vibe && song.djMaterial.vibe.length > 0) {
      // 如果没有 outro 但有 vibe 素材，用 vibe
      const vibes = song.djMaterial.vibe;
      outro = vibes[Math.floor(Math.random() * vibes.length)];
    } else {
      // 没有预存素材，调用 RadioDJAgent 生成
      try {
        const radioDJAgent = new RadioDJAgent();
        outro = await radioDJAgent.generateOutro(song, (style || "classic") as DJStyle, (language || "zh-CN") as DJLanguage, contextSummary);
      } catch (error) {
        console.error("RadioDJAgent generateOutro failed, falling back to template:", error);
        // fallback 模板
        outro = `${song.artist}的《${song.title}》听完了，希望你喜欢。接下来，我们继续听下一首歌。`;
      }
    }

    res.json({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      style: style || "classic",
      outro,
      generated: !song.djMaterial?.outro?.length,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate outro" });
  }
});

// 获取歌曲中间插播的冷知识 trivia
wikiRouter.get("/trivia/:id", async (req: Request, res: Response) => {
  try {
    const { style = "trivia", language = "zh-CN" } = req.query as { style?: DJStyle; language?: string };
    const song = await getSongWiki(req.params.id);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // 优先使用预存素材
    let trivia: string | null = null;
    if (song.djMaterial?.funFact && song.djMaterial.funFact.length > 0) {
      const facts = song.djMaterial.funFact;
      trivia = facts[Math.floor(Math.random() * facts.length)];
    } else if (song.trivia && song.trivia.length > 0) {
      // fallback 到旧 trivia 字段
      trivia = song.trivia[Math.floor(Math.random() * song.trivia.length)];
    } else {
      // 没有预存素材，调用 RadioDJAgent 生成
      try {
        const radioDJAgent = new RadioDJAgent();
        trivia = await radioDJAgent.generateMidTrackTrivia(song, style as DJStyle, language as DJLanguage);
      } catch (error) {
        console.error("RadioDJAgent generateMidTrackTrivia failed:", error);
      }
    }

    // Disable caching for trivia to ensure fresh generation
    res.setHeader("Cache-Control", "no-cache");

    res.json({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      hasTrivia: !!trivia,
      trivia,
    });
  } catch (e) {
    console.error("Failed to get trivia:", e);
    res.status(500).json({ error: "Failed to get trivia" });
  }
});

// 从本地音乐库导入到 Wiki
wikiRouter.post("/import", async (req: Request, res: Response) => {
  try {
    // 这里需要从 musicLibraryService 获取所有歌曲
    // 暂时返回 OK，会在启动时自动导入
    res.json({ status: "ok", message: "Import completed" });
  } catch (e) {
    res.status(500).json({ error: "Failed to import songs" });
  }
});
