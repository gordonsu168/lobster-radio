
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface NcmSongFacts {
  neteaseId: string;
  title: string;
  artist: string;
  album: string;
  releaseYear?: number;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  hotComments?: string[];
  lyric?: string;
}

/**
 * 执行 ncm-cli 命令并返回 JSON 结果
 */
async function runNcmCli(args: string[]): Promise<any> {
  const cmd = `ncm-cli ${args.join(" ")} --output json`;
  try {
    // 增加 15 秒超时，防止进程卡死
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    if (!stdout.trim()) return null;
    return JSON.parse(stdout);
  } catch (e) {
    if (e.killed) {
      console.error(`[ncm-cli] 命令超时 (15s): ${cmd}`);
    } else {
      console.error(`[ncm-cli] 命令执行失败: ${cmd}`, e.message);
    }
    return null;
  }
}

/**
 * 搜索歌曲并获取详细事实
 */
export async function fetchNcmFacts(title: string, artist: string): Promise<NcmSongFacts | null> {
  console.log(`[ncm-worker] 正在通过 ncm-cli 搜索: ${title} - ${artist}`);
  
  // 1. 搜索歌曲
  const searchResult = await runNcmCli([
    "search", "song", 
    "--keyword", `"${title} ${artist}"`, 
    "--limit", "5"
  ]);

  const records = searchResult?.data?.records || [];
  if (records.length === 0) {
    console.warn(`[ncm-worker] 未找到歌曲: ${title}`);
    return null;
  }

  // 尝试寻找最匹配的
  let song = records.find((r: any) => {
    const rName = r.name.toLowerCase().replace(/\s/g, '');
    const tName = title.toLowerCase().replace(/\s/g, '');
    const nameMatch = rName === tName || rName.includes(tName) || tName.includes(rName);
    
    const artistMatch = r.artists.some((a: any) => {
      const rArtist = a.name.toLowerCase().replace(/\s/g, '');
      const tArtist = artist.toLowerCase().replace(/\s/g, '');
      return rArtist.includes(tArtist) || tArtist.includes(rArtist);
    });
    
    return nameMatch && artistMatch;
  });

  // 如果没有完美匹配，尝试稍微宽松一点的艺术家匹配
  if (!song) {
    song = records.find((r: any) => 
      r.artists.some((a: any) => {
        const rArtist = a.name.toLowerCase().replace(/\s/g, '');
        const tArtist = artist.toLowerCase().replace(/\s/g, '');
        return rArtist.includes(tArtist) || tArtist.includes(rArtist);
      })
    );
  }

  // 如果还是没找到，默认取第一个
  if (!song) {
    console.warn(`  [ncm] 未能找到高置信度匹配，回退到首个搜索结果`);
    song = records[0];
  }

  const songId = song.id; 
  const facts: NcmSongFacts = {
    neteaseId: songId,
    title: song.name,
    artist: song.artists?.map((a: any) => a.name).join(", "),
    album: song.album?.name
  };

  // 2. 获取专辑详情以获取精准年份
  if (song.album?.id) {
    const albumResult = await runNcmCli([
      "album", "get",
      "--albumId", song.album.id
    ]);
    if (albumResult?.data?.publishTime) {
      facts.releaseYear = new Date(albumResult.data.publishTime).getFullYear();
      console.log(`  [ncm] 从专辑获取年份: ${facts.releaseYear}`);
    }
  }

  // 3. 获取热评
  const commentResult = await runNcmCli([
    "comment", "list-hot",
    "--type", "song",
    "--resourceId", songId,
    "--limit", "5",
    "--offset", "0"
  ]);

  if (commentResult?.data?.records) {
    facts.hotComments = commentResult.data.records.map((r: any) => r.content);
  }

  // 4. 获取歌词并解析
  const lyricResult = await runNcmCli([
    "song", "lyric",
    "--songId", songId
  ]);

  if (lyricResult?.data?.lyric) {
    const lrc = lyricResult.data.lyric;
    facts.lyric = lyricResult.data.txtLyric || lrc;

    // 更鲁棒的正则解析
    const composerMatch = lrc.match(/(作曲|Composer)\s*[:：]\s*([^\n\r\]]+)/i);
    const lyricistMatch = lrc.match(/(作词|Lyricist)\s*[:：]\s*([^\n\r\]]+)/i);
    const arrangerMatch = lrc.match(/(编曲|Arranger)\s*[:：]\s*([^\n\r\]]+)/i);

    if (composerMatch) facts.composer = composerMatch[2].trim();
    if (lyricistMatch) facts.lyricist = lyricistMatch[2].trim();
    if (arrangerMatch) facts.arranger = arrangerMatch[2].trim();
  }

  return facts;
}
