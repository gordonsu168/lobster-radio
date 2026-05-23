import { getAllSongs, updateSongWiki, enrichSongWithLLM } from "../services/wikiService.js";
import { searchSongInfo } from "../services/wikipediaService.js";
import { fetchNeteaseFacts } from "../services/neteaseService.js";
import { fetchNcmFacts } from "../services/ncmService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function populateWiki() {
    const secrets = await resolveRuntimeSecrets();
    console.log("🚀 开始全量异步补全 Wiki 事实数据库...");
    console.log(`📡 配置状态: ncm-cli=已安装, 网易云API=${secrets.neteaseApiEnabled ? '已开启' : '未开启'}`);
    console.log(`🧠 LLM 兜底: 已就绪`);
    console.log(`🌐 百科顺序: 百度百科 → Wikipedia`);
    const songs = await getAllSongs();
    const isForce = process.argv.includes('--force');
    const targetSongs = isForce
        ? songs
        : songs.filter(s => s.enrichmentStatus !== 'completed');
    console.log(`🎵 总共 ${songs.length} 首歌曲, 本次处理: ${targetSongs.length} 首 ${isForce ? '(强制模式)' : ''}`);
    let success = 0;
    let fail = 0;
    for (let i = 0; i < targetSongs.length; i++) {
        const song = targetSongs[i];
        const progress = `[${i + 1}/${targetSongs.length}]`;
        console.log(`${progress} 正在处理: ${song.title} - ${song.artist}...`);
        try {
            const ok = await processSingleSong(song);
            if (ok)
                success++;
            else
                fail++;
        }
        catch (error) {
            console.error(`  ❌ 处理 ${song.title} 时发生非预期错误:`, error.message);
            fail++;
        }
        await delay(1500);
    }
    console.log("\n✨ 批量处理完成!");
    console.log(`📊 统计: 成功 ${success}, 失败 ${fail}`);
    process.exit(0);
}
async function processSingleSong(song) {
    // 1. 并行请求 ncm-cli, 网易云 API, 百度/Wikipedia
    const [ncmFacts, neteaseFacts, wikiInfo] = await Promise.all([
        fetchNcmFacts(song.title, song.artist).catch(err => {
            console.warn(`  [ncm-cli] 失败: ${err.message}`);
            return null;
        }),
        fetchNeteaseFacts(song.title, song.artist).catch(() => null),
        searchSongInfo(song.title, song.artist).catch(() => null)
    ]);
    let finalUpdates = {
        enrichmentStatus: 'completed',
        lastUpdated: new Date().toISOString()
    };
    let foundSomething = false;
    // ncm-cli 作为标准数据源（title/artist 为身份字段，禁止覆盖）
    if (ncmFacts) {
        console.log(`  ✅ ncm-cli 命中标准数据: ${ncmFacts.title} - ${ncmFacts.artist} (年份=${ncmFacts.releaseYear || '未知'})`);
        finalUpdates.album = ncmFacts.album;
        finalUpdates.composer = ncmFacts.composer;
        finalUpdates.lyricist = ncmFacts.lyricist;
        finalUpdates.arranger = ncmFacts.arranger;
        finalUpdates.releaseYear = ncmFacts.releaseYear;
        finalUpdates.hotComments = ncmFacts.hotComments;
        finalUpdates.neteaseId = ncmFacts.neteaseId;
        finalUpdates.lyric = ncmFacts.lyric;
        foundSomething = true;
    }
    if (neteaseFacts) {
        if (!foundSomething)
            console.log(`  ✅ 网易云 API 命中: 年份=${neteaseFacts.releaseYear || '未知'}`);
        if (!finalUpdates.composer)
            finalUpdates.composer = neteaseFacts.composer;
        if (!finalUpdates.lyricist)
            finalUpdates.lyricist = neteaseFacts.lyricist;
        if (!finalUpdates.releaseYear)
            finalUpdates.releaseYear = neteaseFacts.releaseYear;
        if (!finalUpdates.hotComments)
            finalUpdates.hotComments = neteaseFacts.hotComments;
        if (!finalUpdates.neteaseId)
            finalUpdates.neteaseId = neteaseFacts.neteaseId;
        foundSomething = true;
    }
    if (wikiInfo) {
        if (!foundSomething)
            console.log(`  ✅ 百科命中 (百度/Wikipedia): 作曲=${wikiInfo.composer || '未知'}`);
        if (!finalUpdates.composer)
            finalUpdates.composer = wikiInfo.composer;
        if (!finalUpdates.lyricist)
            finalUpdates.lyricist = wikiInfo.lyricist;
        if (!finalUpdates.releaseYear)
            finalUpdates.releaseYear = wikiInfo.releaseYear;
        if (!finalUpdates.trivia || finalUpdates.trivia.length === 0)
            finalUpdates.trivia = wikiInfo.trivia;
        if (!finalUpdates.wikiAbstract)
            finalUpdates.wikiAbstract = wikiInfo.wikiAbstract;
        foundSomething = true;
    }
    // 2. LLM AI 补全 — 传入百科摘要作为上下文
    const webAbstract = wikiInfo?.wikiAbstract || "";
    if (!foundSomething || !finalUpdates.composer || !finalUpdates.releaseYear || !finalUpdates.trivia) {
        console.log(`  🧠 正在调用 LLM 脑内知识库补充事实...`);
        const llmFacts = await enrichSongWithLLM(finalUpdates.title || song.title, finalUpdates.artist || song.artist, webAbstract).catch(() => null);
        if (llmFacts) {
            console.log(`  ✅ LLM 补全成功: 作曲=${llmFacts.composer || 'N/A'}, 年份=${llmFacts.releaseYear || 'N/A'}`);
            if (!finalUpdates.composer && llmFacts.composer)
                finalUpdates.composer = llmFacts.composer;
            if (!finalUpdates.lyricist && llmFacts.lyricist)
                finalUpdates.lyricist = llmFacts.lyricist;
            if (!finalUpdates.arranger && llmFacts.arranger)
                finalUpdates.arranger = llmFacts.arranger;
            if (!finalUpdates.releaseYear && llmFacts.releaseYear)
                finalUpdates.releaseYear = llmFacts.releaseYear;
            if (!finalUpdates.genre && llmFacts.genre)
                finalUpdates.genre = llmFacts.genre;
            if (llmFacts.trivia && llmFacts.trivia.length > 0) {
                finalUpdates.trivia = [...new Set([...(finalUpdates.trivia || []), ...llmFacts.trivia])];
            }
            if (llmFacts.hotComments && llmFacts.hotComments.length > 0) {
                finalUpdates.hotComments = [...new Set([...(finalUpdates.hotComments || []), ...llmFacts.hotComments])];
            }
            foundSomething = true;
        }
    }
    if (foundSomething) {
        await updateSongWiki(song.id, finalUpdates);
        return true;
    }
    else {
        console.warn(`  ⚠️  所有渠道均未找到 ${song.title} 的事实`);
        await updateSongWiki(song.id, { enrichmentStatus: 'failed' });
        return false;
    }
}
populateWiki().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
