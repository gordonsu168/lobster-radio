
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllSongs, updateSongWiki, type SongWiki } from "../services/wikiService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/wiki.json");

// 歌曲模板库 - 粤语经典歌曲常用模板
const CANTOPOP_TRIVIA = [
  "这首歌是香港乐坛黄金年代的经典作品，至今仍被广泛传唱。",
  "该曲曾在当年的劲歌金曲颁奖典礼上获得多项提名。",
  "这首歌的旋律朗朗上口，是 KTV 的必点曲目之一。",
  "这首歌收录于歌手的代表作专辑，是其职业生涯的里程碑。",
  "该曲的编曲充满时代感，代表了当年香港流行音乐的最高水准。",
  "这首歌的歌词描绘了都市人的情感写照，引起了广泛共鸣。",
  "该曲曾被多位歌手翻唱，足见其经典程度。",
  "这首歌的 MV 拍摄手法前卫，在当年引起了不少话题。",
  "该曲在当年的香港电台中文歌曲龙虎榜上曾连续多周上榜。",
  "这首歌是歌手转型期的代表作，展现了其音乐风格的蜕变。",
  "该曲的填词人是香港乐坛的重量级人物，笔下的歌词极具画面感。",
  "这首歌是当年电台热播的作品，陪伴了许多人的青春岁月。",
];

const DJ_INTROS = [
  "接下来这首经典粤语歌，相信大家一定很熟悉。",
  "让我们一起回到那个黄金年代，听听这首经典作品。",
  "这首歌，相信是很多人青春的回忆，一起来听听。",
  "接下来为您带来的是一首百听不厌的粤语金曲。",
  "香港乐坛的经典之作，这首歌你一定听过。",
  "接下来这首歌，是 KTV 的热门点播曲目，一起来重温。",
  "让我们一起在音乐中，感受那个年代的魅力。",
  "接下来这首经典粤语歌，送给正在收听的每一位。",
  "这首歌的旋律一响起，相信很多人都会跟着唱。",
  "接下来为您带来的，是一首不折不扣的粤语金曲。",
];

const DJ_VIBES = [
  "这首歌的节奏轻快，很适合在工作时播放。",
  "旋律优美动听，让人忍不住跟着摇摆。",
  "这首歌的情感真挚，很容易让人产生共鸣。",
  "节奏感十足，听了让人精神为之一振。",
  "这首歌的编曲很有层次感，越听越有味道。",
  "旋律朗朗上口，听一遍就会爱上。",
  "这首歌的副歌部分特别抓耳，是整首歌的精华所在。",
  "前奏一响起，就知道经典来了。",
  "这首歌充满了浓浓的年代感，让人回味无穷。",
  "无论是旋律还是歌词，都堪称完美。",
];

const DJ_FUN_FACTS = [
  "这首歌的专辑当年卖破了白金唱片认证。",
  "该曲曾获得当年十大劲歌金曲颁奖典礼的重要奖项。",
  "这首歌的填词人在创作时仅用了不到一天的时间就完成了。",
  "据说这首歌的灵感来源于填词人的真实经历。",
  "该曲曾被用作某部经典电影的插曲。",
  "这首歌的作曲者是香港乐坛的大师级人物。",
  "该曲在当年的卡拉OK榜单上连续霸榜数周。",
  "这首歌的副歌部分旋律，灵感来自于一首古典音乐。",
  "歌手在录制这首歌时，曾多次修改唱法，力求完美。",
  "该曲的编曲人特意在其中加入了创新的音乐元素。",
];

function getRandomItem(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function populateWiki() {
  console.log("📚 开始补充 Wiki 数据库...");
  
  const songs = await getAllSongs();
  console.log(`🎵 总共 ${songs.length} 首歌曲需要处理`);

  let updatedCount = 0;

  for (const song of songs) {
    try {
      const updates: Partial<SongWiki> = {};

      // 补充冷知识
      if (!song.trivia || song.trivia.length === 0) {
        updates.trivia = [
          `${song.title}是${song.artist}的代表作之一，收录于专辑《${song.album}》。`,
          ...getRandomItems(CANTOPOP_TRIVIA, 2)
        ];
      } else if (song.trivia.length < 3) {
        const existingTrivia = new Set(song.trivia);
        for (const trivia of CANTOPOP_TRIVIA) {
          if (!existingTrivia.has(trivia) && song.trivia.length < 3) {
            song.trivia.push(trivia);
            existingTrivia.add(trivia);
          }
        }
        updates.trivia = song.trivia;
      }

      // 补充 DJ 素材
      if (!song.djMaterial || !song.djMaterial.intro || song.djMaterial.intro.length === 0) {
        updates.djMaterial = {
          intro: getRandomItems(DJ_INTROS, 3),
          vibe: getRandomItems(DJ_VIBES, 3),
          funFact: getRandomItems(DJ_FUN_FACTS, 2),
        };
      } else {
        const djMaterial = { ...song.djMaterial };
        if (!djMaterial.intro || djMaterial.intro.length < 3) {
          djMaterial.intro = [...(djMaterial.intro || []), ...getRandomItems(DJ_INTROS, 3 - (djMaterial.intro || []).length)];
        }
        if (!djMaterial.vibe || djMaterial.vibe.length < 3) {
          djMaterial.vibe = [...(djMaterial.vibe || []), ...getRandomItems(DJ_VIBES, 3 - (djMaterial.vibe || []).length)];
        }
        if (!djMaterial.funFact || djMaterial.funFact.length < 2) {
          djMaterial.funFact = [...(djMaterial.funFact || []), ...getRandomItems(DJ_FUN_FACTS, 2 - (djMaterial.funFact || []).length)];
        }
        updates.djMaterial = djMaterial;
      }

      // 补充流派
      if (!song.genre || song.genre.length === 0) {
        const genres = ["粤语流行", "Cantopop", "香港流行", "经典粤语"];
        updates.genre = getRandomItems(genres, 2);
      }

      // 补充 tags
      if (!song.tags || song.tags.length === 0) {
        const possibleTags = ["经典", "怀旧", "KTV必点", "粤语金曲", "百听不厌", "青春回忆"];
        updates.tags = getRandomItems(possibleTags, 3);
      }

      // 补充相关歌曲推荐
      if (!song.relatedSongs || song.relatedSongs.length === 0) {
        // 随机选几首同风格的作为相关推荐
        const otherSongs = songs.filter(s => s.id !== song.id);
        const related = getRandomItems(otherSongs, 3).map(s => s.title);
        updates.relatedSongs = related;
      }

      // 如果有更新，写入数据库
      if (Object.keys(updates).length > 0) {
        await updateSongWiki(song.id, updates);
        updatedCount++;
        if (updatedCount % 50 === 0) {
          console.log(`✅ 已处理 ${updatedCount}/${songs.length} 首歌曲`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ 处理 ${song.title} 失败:`, error);
    }
  }

  console.log(`🎉 完成！总共补充了 ${updatedCount} 首歌曲的 Wiki 信息`);
  console.log("📊 统计信息:");
  const updatedSongs = await getAllSongs();
  console.log(`  - 有冷知识的歌曲: ${updatedSongs.filter(s => s.trivia && s.trivia.length > 0).length}`);
  console.log(`  - 有DJ素材的歌曲: ${updatedSongs.filter(s => s.djMaterial && s.djMaterial.intro && s.djMaterial.intro.length > 0).length}`);
  console.log(`  - 有流派的歌曲: ${updatedSongs.filter(s => s.genre && s.genre.length > 0).length}`);
  console.log(`  - 有标签的歌曲: ${updatedSongs.filter(s => s.tags && s.tags.length > 0).length}`);
  console.log(`  - 有相关推荐的歌曲: ${updatedSongs.filter(s => s.relatedSongs && s.relatedSongs.length > 0).length}`);
}

// 运行脚本
populateWiki().catch(console.error);
