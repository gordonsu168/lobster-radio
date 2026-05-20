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
    // 构建搜索查询 - 优先使用 歌手 + 歌曲名
    const queries = [
        artist && songTitle ? `${artist} ${songTitle}` : null,
        `${songTitle} 歌曲`,
        songTitle
    ].filter(Boolean);
    for (const query of queries) {
        const results = await searchWikipedia(query);
        for (const result of results) {
            // 验证：如果结果标题不包含歌曲名，或者我们有歌手但结果标题/摘要不包含该歌手，则跳过
            const titleLower = result.title.toLowerCase();
            const songTitleLower = songTitle.toLowerCase();
            const artistLower = artist?.toLowerCase() || "";
            // 提取摘要
            const extract = await getWikipediaExtract(result.pageid);
            if (!extract || extract.length < 50)
                continue;
            const extractLower = extract.toLowerCase();
            // 如果提供了歌手，必须在标题或摘要中出现
            if (artistLower && !titleLower.includes(artistLower) && !extractLower.includes(artistLower)) {
                console.log(`[wiki] 跳过无关结果: ${result.title} (未提及 ${artist})`);
                continue;
            }
            // 必须提及歌曲名
            if (!titleLower.includes(songTitleLower) && !extractLower.includes(songTitleLower)) {
                continue;
            }
            // 从摘要中提取信息
            const info = parseSongInfo(extract, songTitle, artist);
            if (info) {
                // 如果我们有预期的歌手，而解析出来的歌手明显不对，则跳过
                if (artist && info.artist && !info.artist.includes(artist) && !artist.includes(info.artist)) {
                    // 这里有个特殊情况：海鸣威作曲，洪卓立演唱。
                    // 如果摘要主语是专辑/作曲人，解析出的 info.artist 可能是作曲人。
                    // 我们增加一个更宽松的检查：只要提到演唱者即可。
                    if (!extract.includes(artist)) {
                        console.log(`[wiki] 歌手不匹配: 解析结果为 ${info.artist}, 期望为 ${artist}`);
                        continue;
                    }
                }
                return { ...info, wikiAbstract: extract };
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
    // 提取作曲信息 (更精确的正则)
    const composerMatch = extract.match(/(?:作曲)[：:]?\s*([^，。、\n（(]+)/);
    if (composerMatch)
        composer = composerMatch[1].trim();
    // 提取填词信息 (更精确的正则)
    const lyricistMatch = extract.match(/(?:填词|作词)[：:]?\s*([^，。、\n（(]+)/);
    if (lyricistMatch)
        lyricist = lyricistMatch[1].trim();
    // 提取歌手/演唱者
    if (!foundArtist) {
        const singerMatch = extract.match(/(?:歌手|演唱|演唱者)[：:]?\s*([^，。、\n（(]+)/);
        if (singerMatch)
            foundArtist = singerMatch[1].trim();
    }
    // 特殊解析：如果摘要中提到 "由xxx演唱" 或 "由xxx主唱"
    if (artist) {
        // 如果已知 artist，我们要确认它是否作为演唱者出现
        if (!extract.includes(artist)) {
            // 如果摘要根本没提 artist，那解析出来的结果可能张冠李戴
            // 但是由于我们在 searchSongInfo 已经过滤了，所以能到这里通常已经提及了
        }
    }
    // 提取发行年份
    const yearMatch = extract.match(/(\d{4})年/);
    if (yearMatch)
        releaseYear = parseInt(yearMatch[1]);
    // 从摘要中提取有用的句子作为趣闻
    // 避开仅仅是列表性质的句子
    const sentences = extract.split(/[。！？\n]/).filter((s) => {
        const trimmed = s.trim();
        return trimmed.length > 15 &&
            trimmed.includes(songTitle) &&
            !trimmed.includes("列表");
    });
    if (sentences.length > 0) {
        trivia.push(...sentences.slice(0, 3).map((s) => s.trim() + "。"));
    }
    else {
        // 如果没找到带标题的句子，就拿前两句
        const firstTwo = extract.split(/[。！？\n]/).filter(s => s.trim().length > 10).slice(0, 2);
        trivia.push(...firstTwo.map(s => s.trim() + "。"));
    }
    // 只要提到过歌曲名或者解析出了一些事实即可
    if (!extract.includes(songTitle) && !composer && !lyricist) {
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
