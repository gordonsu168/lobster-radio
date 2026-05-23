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
import { generateAINarration } from "../services/AINarrationService.js";
import { getRuntimeSettings, getPreferences } from "../services/storageService.js";
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
    const song = await getSongWiki(req.params.id as string);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    // Attach previewUrl from local music library if available
    try {
      const { getLocalTrackById, scanMusicLibrary } = await import("../services/musicLibraryService.js");
      const allTracks = await scanMusicLibrary();

      // Helpers for fuzzy artist matching (handle "Boy'z, Twins" vs "Boy'z" etc.)
      const artistParts = (name: string) =>
        name.toLowerCase().split(/[,&\/、，]|\s+feat\.?\s+|\s+featuring\s+|\s+x\s+/i).map(p => p.trim()).filter(Boolean);
      const artistsOverlap = (a: string, b: string) => {
        const pa = artistParts(a);
        const pb = artistParts(b);
        return pa.some(p => pb.includes(p)) || pb.some(p => pa.includes(p));
      };

      // 1. Exact ID match
      let track = allTracks.find(t => t.id === song.id);

      // 2. Title + Artist (exact & fuzzy)
      if (!track) {
        track = allTracks.find(t => {
          if (t.title.toLowerCase() !== song.title.toLowerCase()) return false;
          if (t.artist.toLowerCase() === song.artist.toLowerCase()) return true;
          return artistsOverlap(t.artist, song.artist);
        });
      }

      // 3. Title-only exact match
      if (!track) {
        track = allTracks.find(t => t.title.toLowerCase() === song.title.toLowerCase());
      }

      // 4. Title fuzzy match (one contains the other)
      if (!track) {
        track = allTracks.find(
          t => t.title.toLowerCase().includes(song.title.toLowerCase()) ||
               song.title.toLowerCase().includes(t.title.toLowerCase())
        );
      }

      if (track) {
        console.log(`[wiki] preview matched: "${song.title}" -> "${track.title}" by "${track.artist}"`);
      } else {
        console.log(`[wiki] preview NOT matched for: "${song.title}" by "${song.artist}"`);
      }
      if (track?.previewUrl) {
        (song as any).previewUrl = track.previewUrl;
      }
    } catch (e) {
      console.error("[wiki] failed to resolve track for preview:", e);
    }
    console.log(`[wiki] GET /song/${song.id}: previewUrl=${(song as any).previewUrl || "none"}`);
    res.json(song);
  } catch (e) {
    res.status(500).json({ error: "Failed to get song wiki" });
  }
});

// 更新歌曲 Wiki
wikiRouter.put("/song/:id", async (req: Request, res: Response) => {
  try {
    const data = req.body as Partial<SongWiki>;
    // Ensure we track when an edit happens
    data.lastUpdated = new Date().toISOString();
    
    const updated = await updateSongWiki(req.params.id as string, data);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Failed to update song wiki" });
  }
});

// 搜索 Wiki
wikiRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const query = (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q) as string;
    const results = await searchWiki(query);
    res.json({ count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: "Failed to search wiki" });
  }
});

// 手动触发补全
wikiRouter.post("/song/:id/enrich", async (req: Request, res: Response) => {
  try {
    const { enqueueWikiEnrichment, getSongWiki, updateSongWiki } = await import("../services/wikiService.js");
    const song = await getSongWiki(req.params.id as string);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // 重置状态为 pending 并触发异步补全
    const updated = await updateSongWiki(song.id, { enrichmentStatus: 'pending' });
    enqueueWikiEnrichment(updated);
    
    res.json({ status: "pending", message: "Enrichment started" });
  } catch (e) {
    res.status(500).json({ error: "Failed to start enrichment" });
  }
});

// 生成歌曲中间的闲聊插话
wikiRouter.post("/chat/:id", async (req: Request, res: Response) => {
  try {
    const { style, position } = req.body as { style?: DJStyle, position?: string };
    const song = await getSongWiki(req.params.id as string);
    
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
    const songId = req.params.id as string;
    const song = await getSongWiki(songId);
    const settings = await getRuntimeSettings();

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    let narration: string;

    // Check if AI narration is enabled via env var and user settings
    const aiEnabled = process.env.DISABLE_AI_NARRATION !== "true" && (settings.enableAiNarration ?? true);

    if (aiEnabled) {
      try {
        const djAgent = new RadioDJAgent();
        const prefs = await getPreferences();
        
        // 自动包含最近的聊天历史作为上下文
        const recentChat = (prefs.chatHistory || []).slice(-5).map((m: any) => `${m.role === 'user' ? '听众' : 'DJ小龙'}: ${m.content}`).join("\n");
        const contextSummary = `正在播放列表。用户喜欢：${prefs.likes.join(", ")}。\n最近对话：\n${recentChat}`;
        
        narration = await djAgent.generateIntro(
          song as any,
          Object.keys(prefs.moodAffinity)[0] as any || "Working",
          (style as any) || "classic",
          (language as any) || "zh-CN",
          contextSummary,
          prefs.memoryInsight
        );
      } catch (aiError) {
        console.warn("AI generation failed, falling back to template:", aiError);
        narration = style
          ? generateNarration(song, style, (language as any) || "zh-CN")
          : generateRandomNarration(song, (language as any) || "zh-CN");
      }
    } else {
      narration = style
        ? generateNarration(song, style, (language as any) || "zh-CN")
        : generateRandomNarration(song, (language as any) || "zh-CN");
    }

    res.json({
      songId,
      title: song.title,
      style: style || "classic",
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
    const settings = await getRuntimeSettings();
    const results: Array<{ songId: string; title: string; narration: string }> = [];

    const aiEnabled = process.env.DISABLE_AI_NARRATION !== "true" && (settings.enableAiNarration ?? true);

    for (const id of songIds) {
      const song = await getSongWiki(id);
      if (song) {
        let narration: string;

        if (aiEnabled && style) {
          try {
            narration = await generateAINarration(song, style, (language as any) || "zh-HK");
          } catch (aiError) {
            console.warn("AI generation failed for batch, falling back to template:", aiError);
            narration = style
              ? generateNarration(song, style, language as any)
              : generateRandomNarration(song, language as any);
          }
        } else {
          narration = style
            ? generateNarration(song, style, language as any)
            : generateRandomNarration(song, language as any);
        }

        results.push({
          songId: song.id,
          title: song.title,
          narration
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
    const { style, language, contextSummary: providedContext = "" } = req.body as { style?: DJStyle; language?: string; contextSummary?: string };
    const song = await getSongWiki(req.params.id as string);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    let outro: string;

    // 获取偏好和历史
    const prefs = await getPreferences();
    const recentChat = (prefs.chatHistory || []).slice(-5).map((m: any) => `${m.role === 'user' ? '听众' : 'DJ小龙'}: ${m.content}`).join("\n");
    const contextSummary = providedContext || `最近对话：\n${recentChat}`;

    const memoryInsight = (req.body as any).memoryInsight || prefs.memoryInsight;

    // 如果有预存的 outro 素材且没有 memoryInsight (意味着没有特殊需求)，随机选一条
    if (song.djMaterial?.outro && song.djMaterial.outro.length > 0 && !memoryInsight) {
      const outros = song.djMaterial.outro;
      outro = outros[Math.floor(Math.random() * outros.length)];
    } else {
      // 调用 RadioDJAgent 生成，更具互动性
      try {
        const radioDJAgent = new RadioDJAgent();
        outro = await radioDJAgent.generateOutro(
          song, 
          (style || "classic") as DJStyle, 
          (language || "zh-CN") as DJLanguage, 
          contextSummary, 
          memoryInsight
        );
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
      generated: true,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate outro" });
  }
});

// 获取歌曲中间插播的冷知识 trivia
wikiRouter.get("/trivia/:id", async (req: Request, res: Response) => {
  try {
    const { style = "trivia", language = "zh-CN" } = req.query as { style?: DJStyle; language?: string };
    const song = await getSongWiki(req.params.id as string);

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    // 获取预存素材作为事实依据，过滤掉模板
    let preStoredFact: string | null = null;
    if (song.djMaterial?.funFact && song.djMaterial.funFact.length > 0) {
      const facts = song.djMaterial.funFact.filter(f => !f.includes("白金唱片"));
      if (facts.length > 0) {
        preStoredFact = facts[Math.floor(Math.random() * facts.length)];
      }
    } 
    
    if (!preStoredFact && song.trivia && song.trivia.length > 0) {
      // fallback 到旧 trivia 字段
      const facts = song.trivia.filter(f => !f.includes("白金唱片"));
      if (facts.length > 0) {
        preStoredFact = facts[Math.floor(Math.random() * facts.length)];
      }
    }

    // 如果本地没有真实的冷知识，则尝试联网获取（维基百科）
    if (!preStoredFact) {
      try {
        console.log(`[Wiki] 联网获取冷知识: ${song.artist} - ${song.title}`);
        const query = encodeURIComponent(`${song.artist} ${song.title}`);
        const res = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&utf8=&format=json`, { signal: AbortSignal.timeout(10_000) });
        const data = await res.json();
        
        if (data.query?.search?.length > 0) {
          const snippet = data.query.search[0].snippet.replace(/<[^>]*>?/gm, ''); // 移除HTML标签
          if (snippet && snippet.length > 10) {
            preStoredFact = snippet;
            console.log(`[Wiki] 成功获取维基冷知识: ${preStoredFact}`);
            
            // 更新本地缓存，替换掉原有的模板
            const newTriviaList = song.trivia ? song.trivia.filter(t => !t.includes("白金唱片")) : [];
            newTriviaList.push(preStoredFact as string);
            await updateSongWiki(song.id, { trivia: newTriviaList });
            song.trivia = newTriviaList; // 更新当前对象
          }
        }
      } catch (e) {
        console.error("[Wiki] 联网获取冷知识失败:", e);
      }
    }

    let trivia: string | null = null;

    // 只有在确实有冷知识时才插入（确实有趣的才加）
    if (preStoredFact) {
      try {
        const radioDJAgent = new RadioDJAgent();
        // 每次都让 AI 重新演绎这个冷知识，保证不千篇一律，像真实的 DJ 分享
        trivia = await radioDJAgent.generateMidTrackTrivia(song, style as DJStyle, language as DJLanguage, preStoredFact);
      } catch (error) {
        console.error("RadioDJAgent generateMidTrackTrivia failed:", error);
        trivia = preStoredFact; // AI失败时 fallback 到原素材
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

// 批量补全所有 pending 歌曲
wikiRouter.post("/enrich-all", async (req: Request, res: Response) => {
  try {
    const { enqueueWikiEnrichment, getAllSongs } = await import("../services/wikiService.js");
    const force = req.query.force === "true";
    const songs = await getAllSongs();

    const targets = force
      ? songs
      : songs.filter(s => s.enrichmentStatus !== "completed" && s.enrichmentStatus !== "skipped");

    for (const song of targets) {
      // reset to pending to trigger re-enrichment
      const { updateSongWiki } = await import("../services/wikiService.js");
      const reset = { ...song, enrichmentStatus: "pending" as const };
      await updateSongWiki(song.id, { enrichmentStatus: "pending" });
      enqueueWikiEnrichment(reset);
    }

    console.log(`[wiki] Batch enrich enqueued: ${targets.length} songs (force=${force})`);
    res.json({
      status: "started",
      total: songs.length,
      enqueued: targets.length,
      force,
      message: `Batch enrichment started for ${targets.length} songs. This runs in the background.`
    });
  } catch (e) {
    console.error("[wiki] Batch enrich failed:", e);
    res.status(500).json({ error: "Failed to start batch enrichment" });
  }
});
