
import { getAllSongs, updateSongWiki, type SongWiki, enrichSongWithLLM } from "../services/wikiService.js";
import { searchSongInfo } from "../services/wikipediaService.js";
import { fetchNeteaseFacts } from "../services/neteaseService.js";
import { fetchNcmFacts } from "../services/ncmService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function populateWiki() {
  const secrets = await resolveRuntimeSecrets();
  
  console.log("🚀 开始全量异步补全 Wiki 事实数据库...");
  console.log(`📡 配置状态: ncm-cli=已安装, 网易云API=${secrets.neteaseApiEnabled ? '已开启' : '未开启'}`);
  console.log(`🧠 LLM 兜底: 已就绪`);
  
  const songs = await getAllSongs();
  
  // 检查是否带有 --force 参数
  const isForce = process.argv.includes('--force');
  
  // 如果是强制模式，处理所有歌曲；否则只处理未完成的
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
      await processSingleSong(song);
      success++;
    } catch (error) {
      console.error(`  ❌ 处理 ${song.title} 时发生非预期错误:`, error.message);
      fail++;
    }

    // 稍微停顿，释放系统资源，防止 ncm-cli 堆积
    await delay(1500); 
  }

  console.log("\n✨ 批量处理完成!");
  console.log(`📊 统计: 成功 ${success}, 失败 ${fail}`);
  process.exit(0);
}

async function processSingleSong(song: any) {
    // 1. 同时尝试 ncm-cli, 网易云 API 和 Wikipedia
    // 对每个请求增加 catch 防止 Promise.all 崩溃
    const [ncmFacts, neteaseFacts, wikiInfo] = await Promise.all([
      fetchNcmFacts(song.title, song.artist).catch(err => {
        console.warn(`  [ncm-cli] 失败: ${err.message}`);
        return null;
      }),
      fetchNeteaseFacts(song.title, song.artist).catch(() => null),
      searchSongInfo(song.title, song.artist).catch(() => null)
    ]);

    let finalUpdates: Partial<SongWiki> = {
      enrichmentStatus: 'completed',
      lastUpdated: new Date().toISOString()
    };

    let foundSomething = false;

    // 关键：以 ncm-cli 结果作为唯一标准
    if (ncmFacts) {
      console.log(`  ✅ ncm-cli 命中标准数据: ${ncmFacts.title} - ${ncmFacts.artist} (年份=${ncmFacts.releaseYear || '未知'})`);
      
      finalUpdates.title = ncmFacts.title;
      finalUpdates.artist = ncmFacts.artist;
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
      if (!foundSomething) console.log(`  ✅ 网易云 API 命中: 年份=${neteaseFacts.releaseYear || '未知'}`);
      if (!finalUpdates.composer) finalUpdates.composer = neteaseFacts.composer;
      if (!finalUpdates.lyricist) finalUpdates.lyricist = neteaseFacts.lyricist;
      if (!finalUpdates.releaseYear) finalUpdates.releaseYear = neteaseFacts.releaseYear;
      if (!finalUpdates.hotComments) finalUpdates.hotComments = neteaseFacts.hotComments;
      if (!finalUpdates.neteaseId) finalUpdates.neteaseId = neteaseFacts.neteaseId;
      foundSomething = true;
    }

    if (wikiInfo) {
      if (!foundSomething) console.log(`  ✅ Wikipedia 命中: 作曲=${wikiInfo.composer || '未知'}`);
      if (!finalUpdates.composer) finalUpdates.composer = wikiInfo.composer;
      if (!finalUpdates.lyricist) finalUpdates.lyricist = wikiInfo.lyricist;
      if (!finalUpdates.releaseYear) finalUpdates.releaseYear = wikiInfo.releaseYear;
      if (!finalUpdates.trivia || finalUpdates.trivia.length === 0) finalUpdates.trivia = wikiInfo.trivia;
      if (!finalUpdates.wikiAbstract) finalUpdates.wikiAbstract = wikiInfo.wikiAbstract;
      foundSomething = true;
    }

    // 2. 如果前三者都没拿到核心事实，动用 LLM 兜底
    if (!foundSomething || (!finalUpdates.composer && !finalUpdates.releaseYear)) {
      console.log(`  🧠 正在调用 LLM 脑内知识库补充事实...`);
      const llmFacts = await enrichSongWithLLM(song.title, song.artist).catch(() => null);
      if (llmFacts) {
        console.log(`  ✅ LLM 补全成功: 作曲=${llmFacts.composer}, 年份=${llmFacts.releaseYear}`);
        if (!finalUpdates.composer) finalUpdates.composer = llmFacts.composer;
        if (!finalUpdates.lyricist) finalUpdates.lyricist = llmFacts.lyricist;
        if (!finalUpdates.releaseYear) finalUpdates.releaseYear = llmFacts.releaseYear;
        if (!finalUpdates.genre) finalUpdates.genre = llmFacts.genre;
        if (!finalUpdates.trivia || finalUpdates.trivia.length === 0) finalUpdates.trivia = llmFacts.trivia;
        if (!finalUpdates.hotComments || finalUpdates.hotComments.length === 0) finalUpdates.hotComments = llmFacts.hotComments;
        foundSomething = true;
      }
    }

    if (foundSomething) {
      await updateSongWiki(song.id, finalUpdates);
    } else {
      console.warn(`  ⚠️  所有渠道均未找到 ${song.title} 的事实`);
      await updateSongWiki(song.id, { enrichmentStatus: 'failed' });
    }
}

populateWiki().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
