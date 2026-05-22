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
    // 1. Wikipedia 尝试
    const queries = [
        artist && songTitle ? `${artist} ${songTitle}` : null,
        `${songTitle} 歌曲`,
        songTitle
    ].filter(Boolean);
    const skipKeywords = ["列表", "相关", "汇总", "分类", "音樂"];
    for (const query of queries) {
        const results = await searchWikipedia(query);
        for (const result of results) {
            if (skipKeywords.some(kw => result.title.includes(kw)))
                continue;
            const extract = await getWikipediaExtract(result.pageid);
            if (!extract || extract.length < 50)
                continue;
            const extractLower = extract.toLowerCase();
            const titleLower = result.title.toLowerCase();
            const songTitleLower = songTitle.toLowerCase();
            const artistLower = artist?.toLowerCase() || "";
            // 定义/列表识别
            const isDefinitionOfCategory = extract.slice(0, 100).includes("是指") ||
                extract.slice(0, 100).includes("是一些");
            const isSingleSongFormat = extract.trim().startsWith("《") ||
                extract.trim().startsWith("〈") ||
                extract.slice(0, 30).includes(songTitle);
            if (isDefinitionOfCategory && !isSingleSongFormat)
                continue;
            if (extract.includes("列表") && extract.indexOf("列表") < 50)
                continue;
            // 匹配校验
            if (artistLower && !titleLower.includes(artistLower) && !extractLower.includes(artistLower))
                continue;
            if (!titleLower.includes(songTitleLower) && !extractLower.includes(songTitleLower)) {
                // 如果摘要提到了歌手，且标题包含歌曲名的一部分（可能由于繁简差异搜到了），则尝试解析
                if (!artistLower || !extract.includes(artistLower))
                    continue;
            }
            const info = parseSongInfo(extract, songTitle, artist);
            if (info) {
                if (artist && info.artist && !info.artist.includes(artist) && !artist.includes(info.artist)) {
                    if (!extract.includes(artist))
                        continue;
                }
                return { ...info, wikiAbstract: extract };
            }
        }
    }
    // 2. Wikipedia 没搜到，尝试百度百科
    console.log(`[wiki] Wikipedia 无果，转向百度百科: ${artist} - ${songTitle}`);
    const baiduUrls = [
        `https://baike.baidu.com/item/${encodeURIComponent(songTitle)}`,
        artist ? `https://baike.baidu.com/item/${encodeURIComponent(artist + " " + songTitle)}` : null
    ].filter(Boolean);
    for (const baiduUrl of baiduUrls) {
        try {
            const response = await fetch(baiduUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            const html = await response.text();
            // 处理歧义页
            if (html.includes("本词条是一个多义词") && artist) {
                const itemMatch = html.match(new RegExp(`<a[^>]+href="(/item/[^"]+)"[^>]*>[\\s\\S]*?${artist}[\\s\\S]*?<\\/a>`, "i"));
                if (itemMatch) {
                    const subUrl = `https://baike.baidu.com${itemMatch[1].split('?')[0]}`;
                    const subResponse = await fetch(subUrl, {
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    const subHtml = await subResponse.text();
                    const subMetaDesc = subHtml.match(/<meta name="description" content="([^"]+)">/);
                    if (subMetaDesc && subMetaDesc[1].length > 50) {
                        const info = parseSongInfo(subMetaDesc[1], songTitle, artist);
                        if (info)
                            return { ...info, wikiAbstract: subMetaDesc[1] };
                    }
                }
            }
            // 常规提取
            const metaDesc = html.match(/<meta name="description" content="([^"]+)">/);
            if (metaDesc && metaDesc[1].length > 50 && !metaDesc[1].includes("百度百科是一部内容开放")) {
                const abstract = metaDesc[1];
                console.log(`[wiki] 百度百科摘要抓取成功`);
                const info = parseSongInfo(abstract, songTitle, artist);
                if (info)
                    return { ...info, wikiAbstract: abstract };
            }
        }
        catch (e) {
            console.warn("[wiki] 百度百科抓取失败:", e);
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
    const extract = await getWikipediaExtract(results[0].pageid);
    if (!extract) {
        return `Found Wikipedia page for "${results[0].title}" but failed to get content.`;
    }
    return extract.slice(0, 500) + (extract.length > 500 ? "..." : "");
}
// 从摘要中解析歌曲信息
function parseSongInfo(extract, songTitle, artist) {
    const trivia = [];
    let composer = "";
    let lyricist = "";
    let releaseYear;
    let foundArtist = artist || "";
    // 提取信息 (优化正则)
    const composerMatch = extract.match(/([^，。、\n（(]+)(?:作曲)/) || extract.match(/(?:作曲)[：:]?\s*([^，。、\n（(]+)/);
    if (composerMatch) {
        composer = composerMatch[1].replace(/^(?:由|《[^》]+》是由)/, "").trim();
    }
    const lyricistMatch = extract.match(/([^，。、\n（(]+)(?:填词|作词)/) || extract.match(/(?:填词|作词)[：:]?\s*([^，。、\n（(]+)/);
    if (lyricistMatch) {
        lyricist = lyricistMatch[1].replace(/^(?:由|《[^》]+》是由)/, "").trim();
    }
    if (!foundArtist) {
        const singerMatch = extract.match(/(?:歌手|演唱|演唱者)[：:]?\s*([^，。、\n（(]+)/) || extract.match(/([^，。、\n（(]+)(?:演唱|主唱)/);
        if (singerMatch)
            foundArtist = singerMatch[1].replace(/^由/, "").trim();
    }
    const yearMatch = extract.match(/(\d{4})年/);
    if (yearMatch)
        releaseYear = parseInt(yearMatch[1]);
    const sentences = extract.split(/[。！？\n]/).filter((s) => {
        const trimmed = s.trim();
        return trimmed.length > 10 &&
            (trimmed.includes(songTitle) || (artist && trimmed.includes(artist))) &&
            !trimmed.includes("列表");
    });
    if (sentences.length > 0) {
        trivia.push(...sentences.slice(0, 3).map((s) => s.trim() + "。"));
    }
    else {
        const firstTwo = extract.split(/[。！？\n]/).filter(s => s.trim().length > 10).slice(0, 2);
        trivia.push(...firstTwo.map(s => s.trim() + "。"));
    }
    // 只要提到过歌曲名或者解析出了一些事实即可
    // 考虑到百度百科已经是首选且为简体，这里不再进行繁简转换判断
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
                if (info.wikiAbstract)
                    updateData.wikiAbstract = info.wikiAbstract;
                if (Object.keys(updateData).length > 0) {
                    await updateSongWiki(song.id, updateData);
                    successCount++;
                    console.log(`✅ 补全成功: ${song.title}`);
                }
            }
            await new Promise((r) => setTimeout(r, 800));
        }
        catch (e) {
            console.warn(`❌ 补全失败: ${song.title}`, e);
        }
    }
    return successCount;
}
