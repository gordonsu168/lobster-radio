import { neteaseCatalog } from "../data/neteaseCatalog.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
const moodKeywords = {
    Working: "工作 专注 学习 轻音乐 纯音乐",
    Relaxing: "放松 治愈 安静 民谣 爵士",
    Exercising: "运动 健身 跑步 电音 动感",
    Party: "派对 蹦迪 热闹 流行 抖音",
    Sleepy: "睡眠 睡前 催眠 安静 轻音乐"
};
async function searchWithCustomApi(apiBase, keyword, mood) {
    try {
        const url = `${apiBase}/search?keywords=${encodeURIComponent(keyword)}&limit=8`;
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const songs = data.result?.songs || [];
        return await Promise.all(songs.map(async (item, index) => {
            let previewUrl = null;
            try {
                const urlResp = await fetch(`${apiBase}/song/url?id=${item.id}`, { signal: AbortSignal.timeout(5000) });
                const urlData = await urlResp.json();
                previewUrl = urlData.data?.[0]?.url || null;
            }
            catch { }
            return {
                id: `netease-${item.id}`,
                title: item.name || "Unknown Title",
                artist: item.ar?.map((a) => a.name).join(", ") || "Unknown Artist",
                album: item.al?.name || "Unknown Album",
                previewUrl,
                artwork: item.al?.picUrl || neteaseCatalog[index % neteaseCatalog.length].artwork,
                moodTags: ["netease", moodKeywords[mood].split(" ")[0]],
                energy: Math.max(20, 90 - index * 7),
                explanation: `来自网易云音乐的推荐，为你精选适合当前${mood}氛围的中文歌曲。`,
                source: "netease"
            };
        }));
    }
    catch {
        return [];
    }
}
export async function fetchNeteaseFacts(title, artist) {
    const secrets = await resolveRuntimeSecrets();
    if (!secrets.neteaseApiEnabled || !secrets.neteaseApiUrl)
        return null;
    try {
        const apiBase = secrets.neteaseApiUrl;
        // 1. 搜索歌曲
        const searchUrl = `${apiBase}/search?keywords=${encodeURIComponent(`${title} ${artist}`)}&limit=1`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const song = searchData.result?.songs?.[0];
        if (!song)
            return null;
        const songId = song.id;
        // 2. 获取歌曲详情 (包含作者信息)
        const detailUrl = `${apiBase}/song/detail?ids=${songId}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        const fullSong = detailData.songs?.[0];
        // 3. 获取热评
        const commentUrl = `${apiBase}/comment/hot?id=${songId}&type=0&limit=5`;
        const commentRes = await fetch(commentUrl);
        const commentData = await commentRes.json();
        const hotComments = commentData.hotComments?.map((c) => c.content) || [];
        // 尝试解析发行年份
        let releaseYear;
        if (fullSong?.publishTime) {
            releaseYear = new Date(fullSong.publishTime).getFullYear();
        }
        else if (song?.publishTime) {
            releaseYear = new Date(song.publishTime).getFullYear();
        }
        // 尝试从歌曲名或描述中提取作词作曲 (网易云搜索结果有时包含这些)
        // 如果没有，后续靠 Wikipedia 补全
        return {
            neteaseId: songId.toString(),
            releaseYear,
            hotComments: hotComments.slice(0, 3),
        };
    }
    catch (e) {
        console.warn("[netease] Failed to fetch facts:", e);
        return null;
    }
}
export async function searchTracksByMood(mood) {
    const secrets = await resolveRuntimeSecrets();
    if (!secrets.neteaseApiEnabled) {
        return [];
    }
    // 如果配置了自定义 API 地址，尝试使用
    if (secrets.neteaseApiUrl) {
        const keyword = moodKeywords[mood];
        const apiTracks = await searchWithCustomApi(secrets.neteaseApiUrl, keyword, mood);
        if (apiTracks.length > 0) {
            return apiTracks;
        }
    }
    // 默认使用内置的网易云风格歌单
    return neteaseCatalog.filter((track) => track.moodTags.includes(mood));
}
