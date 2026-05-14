// 维基百科搜索服务 - 自动补全歌曲信息
import fetch from "node-fetch";
// 搜索维基百科
export async function searchWikipedia(query) {
    try {
        const url = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "LobsterRadio/1.0 (https://github.com/lobster-radio)"
            }
        });
        const data = await response.json();
        return data?.query?.search || [];
    }
    catch (e) {
        console.warn("Wikipedia search failed:", e);
        return [];
    }
}
// 获取页面摘要
export async function getWikipediaExtract(pageId) {
    try {
        const url = `https://zh.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "LobsterRadio/1.0 (https://github.com/lobster-radio)"
            }
        });
        const data = await response.json();
        const pages = data?.query?.pages;
        if (!pages)
            return null;
        const page = pages[Object.keys(pages)[0]];
        return page?.extract || null;
    }
    catch (e) {
        console.warn("Wikipedia extract failed:", e);
        return null;
    }
}
// 搜索歌曲并提取有用信息
export async function searchSongInfo(songTitle, artist) {
    // 构建搜索查询
    const queries = [
        `${songTitle} 歌曲`,
        artist ? `${artist} ${songTitle}` : songTitle,
        songTitle
    ];
    for (const query of queries) {
        const results = await searchWikipedia(query);
        for (const result of results) {
            // 提取摘要
            const extract = await getWikipediaExtract(result.pageid);
            if (!extract || extract.length < 50)
                continue;
            // 从摘要中提取信息
            const info = parseSongInfo(extract, songTitle, artist);
            if (info) {
                return info;
            }
        }
    }
    return null;
}
// 获取维基百科搜索结果的摘要内容（用于 Producer Agent 查询资料）
export async function fetchWikipediaContent(query) {
    const results = await searchWikipedia(query);
    if (results.length === 0) {
        return `No Wikipedia results found for "${query}".`;
    }
    // Take the first result and get its extract
    const extract = await getWikipediaExtract(results[0].pageid);
    if (!extract) {
        return `Found Wikipedia page for "${results[0].title}" but failed to get content.`;
    }
    // Truncate to keep it concise
    return extract.slice(0, 500) + (extract.length > 500 ? "..." : "");
}
// 从维基百科摘要中解析歌曲信息
function parseSongInfo(extract, songTitle, artist) {
    const trivia = [];
    let composer = "";
    let lyricist = "";
    let releaseYear;
    let foundArtist = artist || "";
    // 提取作曲信息
    const composerMatch = extract.match(/作曲[：:]?\s*([^，。、\n]+)/);
    if (composerMatch)
        composer = composerMatch[1].trim();
    // 提取填词信息
    const lyricistMatch = extract.match(/填词[：:]?\s*([^，。、\n]+)/);
    if (lyricistMatch)
        lyricist = lyricistMatch[1].trim();
    // 提取歌手
    const singerMatch = extract.match(/歌手[：:]?\s*([^，。、\n]+)/);
    if (singerMatch && !foundArtist)
        foundArtist = singerMatch[1].trim();
    // 提取发行年份
    const yearMatch = extract.match(/(\d{4})年/);
    if (yearMatch)
        releaseYear = parseInt(yearMatch[1]);
    // 从摘要中提取前2-3句作为趣闻
    const sentences = extract.split(/[。！？.!?]/).filter((s) => s.trim().length > 10);
    if (sentences.length > 0) {
        trivia.push(...sentences.slice(0, 3).map((s) => s.trim() + "。"));
    }
    // 至少要有一些有用信息
    if (!composer && !lyricist && trivia.length === 0) {
        return null;
    }
    return {
        artist: foundArtist,
        composer,
        lyricist,
        releaseYear,
        trivia
    };
}
// 批量补全歌曲信息
export async function enrichSongsWithWikipedia(songs) {
    let successCount = 0;
    for (const song of songs) {
        console.log(`正在搜索: ${song.artist} - ${song.title}`);
        try {
            const info = await searchSongInfo(song.title, song.artist);
            if (info) {
                // 更新到 Wiki 数据库
                const { updateSongWiki } = await import("./wikiService.js");
                const updateData = {};
                if (info.artist && info.artist !== "未知艺术家")
                    updateData.artist = info.artist;
                if (info.composer)
                    updateData.composer = info.composer;
                if (info.lyricist)
                    updateData.lyricist = info.lyricist;
                if (info.releaseYear)
                    updateData.releaseYear = info.releaseYear;
                if (info.trivia.length > 0)
                    updateData.trivia = info.trivia;
                if (Object.keys(updateData).length > 0) {
                    await updateSongWiki(song.id, updateData);
                    successCount++;
                    console.log(`✅ 补全成功: ${song.title}`);
                }
            }
            // 避免请求太快
            await new Promise((r) => setTimeout(r, 800));
        }
        catch (e) {
            console.warn(`❌ 补全失败: ${song.title}`, e);
        }
    }
    return successCount;
}
