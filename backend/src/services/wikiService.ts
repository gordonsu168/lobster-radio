import fs from "node:fs/promises";
import path from "node:path";
import type { Track } from "../types.js";
import { fallbackCatalog } from "../data/fallbackCatalog.js";
import { getLocalTrackById } from "./musicLibraryService.js";

export interface SongWiki {
  id: string;
  title: string;
  artist: string;
  album: string;
  
  // --- 核心事实 (Hard Facts) ---
  releaseYear?: number;
  genre?: string[];
  composer?: string;
  lyricist?: string;
  arranger?: string;
  producer?: string;
  recordLabel?: string;
  
  // --- 外部关联 ---
  neteaseId?: string;
  wikipediaUrl?: string;
  
  // --- 原始素材 (Original Materials) ---
  hotComments?: string[]; // 网易云热评
  wikiAbstract?: string;  // 维基百科摘要
  trivia?: string[];      // 真实趣闻
  lyric?: string;         // 歌词
  
  // --- 任务状态 ---
  enrichmentStatus: 'pending' | 'completed' | 'failed';
  lastUpdated: string;

  // --- 弃用字段 (仅为兼容性保留，后续清理) ---
  djMaterial?: {
    intro?: string[];
    outro?: string[];
    vibe?: string[];
    funFact?: string[];
  };
  relatedSongs?: string[];
  tags?: string[];
  moodTags?: string[];
}

interface WikiDatabase {
  _meta: {
    version: string;
    lastUpdated: string;
    totalSongs: number;
  };
  songs: Record<string, SongWiki>;
}

const WIKI_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "../data/songs-wiki.json");

// 加载 Wiki 数据库
async function loadWiki(): Promise<WikiDatabase> {
  try {
    const data = await fs.readFile(WIKI_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      _meta: {
        version: "1.0",
        lastUpdated: new Date().toISOString().split("T")[0],
        totalSongs: 0
      },
      songs: {}
    };
  }
}

// 保存 Wiki 数据库
async function saveWiki(wiki: WikiDatabase): Promise<void> {
  wiki._meta.lastUpdated = new Date().toISOString().split("T")[0];
  wiki._meta.totalSongs = Object.keys(wiki.songs).length;
  await fs.writeFile(WIKI_PATH, JSON.stringify(wiki, null, 2), "utf-8");
}

// 从 Track 生成默认 Wiki 条目
function generateDefaultWiki(track: Track): SongWiki {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    enrichmentStatus: 'pending',
    lastUpdated: new Date().toISOString()
  };
}

// 获取歌曲 Wiki
export async function getSongWiki(songId: string): Promise<SongWiki | null> {
  const wiki = await loadWiki();
  let foundWiki = wiki.songs[songId] || null;

  if (foundWiki && foundWiki.enrichmentStatus === 'completed') {
    console.log(`[wiki] 命中缓存: ${foundWiki.title} (Year: ${foundWiki.releaseYear}, Composer: ${foundWiki.composer})`);
  }

  if (!foundWiki) {
    // 尝试在备用歌曲库中查找
    const fallbackTrack = fallbackCatalog.find(t => t.id === songId);
    if (fallbackTrack) {
      const key = `${fallbackTrack.title} - ${fallbackTrack.artist}`.toLowerCase();
      foundWiki = Object.values(wiki.songs).find(s => `${s.title} - ${s.artist}`.toLowerCase() === key) || null;
      if (!foundWiki) foundWiki = generateDefaultWiki(fallbackTrack);
    }
  }

  if (!foundWiki) {
    // 尝试在本地库中查找
    const localTrack = await getLocalTrackById(songId);
    if (localTrack) {
      const key = `${localTrack.title} - ${localTrack.artist}`.toLowerCase();
      foundWiki = Object.values(wiki.songs).find(s => `${s.title} - ${s.artist}`.toLowerCase() === key) || null;
      if (!foundWiki) foundWiki = generateDefaultWiki(localTrack);
    }
  }

  // 异步触发补全
  if (foundWiki && foundWiki.enrichmentStatus === 'pending') {
    enqueueWikiEnrichment(foundWiki);
  }

  return foundWiki;
}

// 异步补全队列
const enrichmentQueue = new Set<string>();

export async function enrichSongWithLLM(title: string, artist: string): Promise<Partial<SongWiki> | null> {
  const { createOptionalModel } = await import("lobster-radio-agents/dist/lib/model.js");
  const model = createOptionalModel();
  if (!model) return null;

  const prompt = `你是一个专业的音乐百科全书。请根据你的知识储备，提供以下歌曲的硬核事实。
歌曲：${title}
歌手：${artist}

请严格按 JSON 格式返回，不要包含任何额外文字：
{
  "composer": "作曲人",
  "lyricist": "作词人",
  "arranger": "编曲人 (可选)",
  "releaseYear": 2024,
  "genre": ["流派1", "流派2"],
  "trivia": ["冷知识1", "冷知识2"],
  "hotComments": ["模拟听众最可能产生的共鸣评论1", "模拟感性点评2"]
}`;

  try {
    const { HumanMessage } = await import("@langchain/core/messages");
    const result = await model.invoke([new HumanMessage(prompt)]);
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    
    // 简单的 JSON 提取
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`[LLM-Enrich] 失败: ${title}`, e);
    return null;
  }
}

export function enqueueWikiEnrichment(wiki: SongWiki) {
  if (enrichmentQueue.has(wiki.id)) return;
  enrichmentQueue.add(wiki.id);

  // 延迟执行，不阻塞当前请求
  setTimeout(async () => {
    try {
      console.log(`[wiki-worker] 开始补全: ${wiki.title} - ${wiki.artist}`);
      
      const { searchSongInfo } = await import("./wikipediaService.js");
      const { fetchNeteaseFacts } = await import("./neteaseService.js");
      const { fetchNcmFacts } = await import("./ncmService.js");

      const updates: Partial<SongWiki> = {
        enrichmentStatus: 'completed',
        lastUpdated: new Date().toISOString()
      };

      // 1. 优先级最高：ncm-cli (网易云本地能力) - 作为标准
      const ncmFacts = await fetchNcmFacts(wiki.title, wiki.artist);
      if (ncmFacts) {
        console.log(`[wiki-worker] ncm-cli命中标准数据: ${ncmFacts.title} - ${ncmFacts.artist}`);
        Object.assign(updates, {
          title: ncmFacts.title,
          artist: ncmFacts.artist,
          album: ncmFacts.album,
          composer: ncmFacts.composer,
          lyricist: ncmFacts.lyricist,
          arranger: ncmFacts.arranger,
          releaseYear: ncmFacts.releaseYear,
          hotComments: ncmFacts.hotComments,
          neteaseId: ncmFacts.neteaseId,
          lyric: ncmFacts.lyric
        });
      }

      // 2. 尝试网易云 HTTP API (仅在 ncm-cli 没拿到年份/热评时补充)
      if (!updates.releaseYear || !updates.hotComments) {
        const neteaseFacts = await fetchNeteaseFacts(wiki.title, wiki.artist);
        if (neteaseFacts) {
          if (!updates.releaseYear) updates.releaseYear = neteaseFacts.releaseYear;
          if (!updates.hotComments) updates.hotComments = neteaseFacts.hotComments;
          if (!updates.neteaseId) updates.neteaseId = neteaseFacts.neteaseId;
        }
      }
      // 3. Wikipedia 补全 (仅补充缺失字段)
      const wikiInfo = await searchSongInfo(wiki.title, wiki.artist);
      if (wikiInfo) {
        if (!updates.composer) updates.composer = wikiInfo.composer;
        if (!updates.lyricist) updates.lyricist = wikiInfo.lyricist;
        if (!updates.releaseYear) updates.releaseYear = wikiInfo.releaseYear;
        if (!updates.trivia || updates.trivia.length === 0) updates.trivia = wikiInfo.trivia;
        if (!updates.wikiAbstract) updates.wikiAbstract = wikiInfo.wikiAbstract;
      }

      await updateSongWiki(wiki.id, updates);

      console.log(`[wiki-worker] 补全成功: ${wiki.title}`);
    } catch (e) {
      console.error(`[wiki-worker] 补全失败: ${wiki.title}`, e);
      await updateSongWiki(wiki.id, { enrichmentStatus: 'failed' });
    } finally {
      enrichmentQueue.delete(wiki.id);
    }
  }, 1000);
}

// 更新歌曲 Wiki
export async function updateSongWiki(songId: string, data: Partial<SongWiki>): Promise<SongWiki> {
  const wiki = await loadWiki();

  if (!wiki.songs[songId]) {
    wiki.songs[songId] = {
      id: songId,
      title: "",
      artist: "",
      album: "",
      ...data
    };
  } else {
    wiki.songs[songId] = {
      ...wiki.songs[songId],
      ...data
    };
  }

  await saveWiki(wiki);
  return wiki.songs[songId];
}

// 批量导入歌曲
export async function importSongsFromTracks(tracks: Track[]): Promise<void> {
  const wiki = await loadWiki();
  let imported = 0;

  // 用于去重的标题+艺术家集合
  const existingKeys = new Set(
    Object.values(wiki.songs).map(s => `${s.title} - ${s.artist}`.toLowerCase())
  );

  for (const track of tracks) {
    const key = `${track.title} - ${track.artist}`.toLowerCase();

    // 如果ID不存在，并且标题+艺术家组合也不存在
    if (!wiki.songs[track.id] && !existingKeys.has(key)) {
      wiki.songs[track.id] = generateDefaultWiki(track);
      existingKeys.add(key);
      imported++;
    }
  }

  if (imported > 0) {
    await saveWiki(wiki);
    console.log(`Imported ${imported} songs into Wiki`);
  }
}

// 搜索 Wiki
export async function searchWiki(query: string): Promise<SongWiki[]> {
  const wiki = await loadWiki();
  const q = query.toLowerCase();
  
  return Object.values(wiki.songs).filter(
    song =>
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.album.toLowerCase().includes(q)
  );
}

// 获取所有歌曲
export async function getAllSongs(): Promise<SongWiki[]> {
  const wiki = await loadWiki();
  return Object.values(wiki.songs);
}
