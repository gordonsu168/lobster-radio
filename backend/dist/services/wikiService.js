import fs from "node:fs/promises";
import path from "node:path";
const WIKI_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "../data/songs-wiki.json");
// 加载 Wiki 数据库
async function loadWiki() {
    try {
        const data = await fs.readFile(WIKI_PATH, "utf-8");
        return JSON.parse(data);
    }
    catch {
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
async function saveWiki(wiki) {
    wiki._meta.lastUpdated = new Date().toISOString().split("T")[0];
    wiki._meta.totalSongs = Object.keys(wiki.songs).length;
    await fs.writeFile(WIKI_PATH, JSON.stringify(wiki, null, 2), "utf-8");
}
// 从 Track 生成默认 Wiki 条目
function generateDefaultWiki(track) {
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
            vibe: [],
            funFact: []
        },
        relatedSongs: [],
        tags: []
    };
}
// 获取歌曲 Wiki
export async function getSongWiki(songId) {
    const wiki = await loadWiki();
    return wiki.songs[songId] || null;
}
// 更新歌曲 Wiki
export async function updateSongWiki(songId, data) {
    const wiki = await loadWiki();
    if (!wiki.songs[songId]) {
        wiki.songs[songId] = {
            id: songId,
            title: "",
            artist: "",
            album: "",
            ...data
        };
    }
    else {
        wiki.songs[songId] = {
            ...wiki.songs[songId],
            ...data
        };
    }
    await saveWiki(wiki);
    return wiki.songs[songId];
}
// 批量导入歌曲
export async function importSongsFromTracks(tracks) {
    const wiki = await loadWiki();
    let imported = 0;
    for (const track of tracks) {
        if (!wiki.songs[track.id]) {
            wiki.songs[track.id] = generateDefaultWiki(track);
            imported++;
        }
    }
    if (imported > 0) {
        await saveWiki(wiki);
        console.log(`Imported ${imported} songs into Wiki`);
    }
}
// 搜索 Wiki
export async function searchWiki(query) {
    const wiki = await loadWiki();
    const q = query.toLowerCase();
    return Object.values(wiki.songs).filter(song => song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.album.toLowerCase().includes(q));
}
// 获取所有歌曲
export async function getAllSongs() {
    const wiki = await loadWiki();
    return Object.values(wiki.songs);
}
