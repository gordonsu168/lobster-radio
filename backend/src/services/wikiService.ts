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
  releaseYear?: number;
  genre?: string[];
  composer?: string;
  lyricist?: string;
  arranger?: string;
  producer?: string;
  
  // 歌曲趣闻
  trivia?: string[];
  
  // 情绪标签
  moodTags?: string[];
  
  // DJ 素材库
  djMaterial?: {
    intro?: string[];
    outro?: string[];
    vibe?: string[];
    funFact?: string[];
  };
  
  // 相关歌曲
  relatedSongs?: string[];
  
  // 自定义标签
  tags?: string[];
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
    genre: [],
    moodTags: track.moodTags || [],
    trivia: [],
    djMaterial: {
      intro: [],
      outro: [],
      vibe: [],
      funFact: []
    },
    relatedSongs: [],
    tags: []
  };
}

// 获取歌曲 Wiki
export async function getSongWiki(songId: string): Promise<SongWiki | null> {
  const wiki = await loadWiki();
  if (wiki.songs[songId]) {
    return wiki.songs[songId];
  }

  // 尝试在备用歌曲库中查找
  const fallbackTrack = fallbackCatalog.find(t => t.id === songId);
  if (fallbackTrack) {
    const key = `${fallbackTrack.title} - ${fallbackTrack.artist}`.toLowerCase();
    const existingWiki = Object.values(wiki.songs).find(s => `${s.title} - ${s.artist}`.toLowerCase() === key);
    if (existingWiki) {
      return existingWiki;
    }
    return generateDefaultWiki(fallbackTrack);
  }

  // 尝试在本地库中查找
  const localTrack = await getLocalTrackById(songId);
  if (localTrack) {
    const key = `${localTrack.title} - ${localTrack.artist}`.toLowerCase();
    const existingWiki = Object.values(wiki.songs).find(s => `${s.title} - ${s.artist}`.toLowerCase() === key);
    if (existingWiki) {
      return existingWiki;
    }
    return generateDefaultWiki(localTrack);
  }

  return null;
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
