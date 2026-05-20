
import fetch from "node-fetch";
import { searchSongInfo } from "../services/wikipediaService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";

async function testWikipedia() {
  console.log("\n🌐 --- 测试 Wikipedia API ---");
  const testSongs = ["海阔天空", "好久不见"];
  
  for (const title of testSongs) {
    console.log(`🔍 正在搜索 Wikipedia: ${title}...`);
    try {
      const info = await searchSongInfo(title, "");
      if (info) {
        console.log(`✅ 成功!`);
        console.log(`   - 标题: ${title}`);
        console.log(`   - 作曲: ${info.composer || '未知'}`);
        console.log(`   - 年份: ${info.releaseYear || '未知'}`);
        console.log(`   - 趣闻: ${info.trivia?.[0]?.substring(0, 50)}...`);
      } else {
        console.log(`❌ 未能在 Wikipedia 找到相关信息`);
      }
    } catch (e) {
      console.error(`❌ Wikipedia 测试出错:`, e);
    }
  }
}

async function testNetease() {
  const secrets = await resolveRuntimeSecrets();
  console.log("\n🎵 --- 测试网易云 API ---");
  console.log(`📡 API 地址: ${secrets.neteaseApiUrl || '未配置'}`);
  
  if (!secrets.neteaseApiUrl) {
    console.log("⚠️ 跳过测试：请先在 .env 中配置 NETEASE_API_URL (例如 http://localhost:3000)");
    return;
  }

  const testQuery = "陈奕迅 好久不见";
  console.log(`🔍 正在通过网易云搜索: ${testQuery}...`);

  try {
    const searchUrl = `${secrets.neteaseApiUrl}/search?keywords=${encodeURIComponent(testQuery)}&limit=1`;
    const res = await fetch(searchUrl);
    const data: any = await res.json();
    
    if (data.result?.songs?.[0]) {
      const song = data.result.songs[0];
      console.log(`✅ 搜索成功!`);
      console.log(`   - 歌名: ${song.name}`);
      console.log(`   - 歌手: ${song.ar?.map((a: any) => a.name).join("/")}`);
      
      // 测试热评
      console.log(`🔍 正在尝试获取热评...`);
      const commentUrl = `${secrets.neteaseApiUrl}/comment/hot?id=${song.id}&type=0&limit=1`;
      const cRes = await fetch(commentUrl);
      const cData: any = await cRes.json();
      if (cData.hotComments?.length > 0) {
        console.log(`✅ 热评获取成功: "${cData.hotComments[0].content.substring(0, 50)}..."`);
      }
    } else {
      console.log(`❌ 网易云搜索无结果，请检查 API 是否正常运行`);
    }
  } catch (e) {
    console.error(`❌ 网易云 API 连接失败:`, e.message);
  }
}

async function runTests() {
  await testWikipedia();
  await testNetease();
  console.log("\n✨ 测试结束");
}

runTests().catch(console.error);
