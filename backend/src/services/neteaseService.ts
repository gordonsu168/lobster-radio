import type { MoodOption, Track } from "../types.js";
import { neteaseCatalog } from "../data/neteaseCatalog.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";

const moodKeywords: Record<MoodOption, string> = {
  Working: "工作 专注 学习 轻音乐 纯音乐",
  Relaxing: "放松 治愈 安静 民谣 爵士",
  Exercising: "运动 健身 跑步 电音 动感",
  Party: "派对 蹦迪 热闹 流行 抖音",
  Sleepy: "睡眠 睡前 催眠 安静 轻音乐"
};

async function searchWithCustomApi(apiBase: string, keyword: string, mood: MoodOption): Promise<Track[]> {
  try {
    const url = `${apiBase}/search?keywords=${encodeURIComponent(keyword)}&limit=8`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return [];
    const data = await response.json();
    const songs = data.result?.songs || [];

    return await Promise.all(
      songs.map(async (item: any, index: number): Promise<Track> => {
        let previewUrl: string | null = null;
        try {
          const urlResp = await fetch(`${apiBase}/song/url?id=${item.id}`, { signal: AbortSignal.timeout(5000) });
          const urlData = await urlResp.json();
          previewUrl = urlData.data?.[0]?.url || null;
        } catch {}

        return {
          id: `netease-${item.id}`,
          title: item.name || "Unknown Title",
          artist: item.ar?.map((a: any) => a.name).join(", ") || "Unknown Artist",
          album: item.al?.name || "Unknown Album",
          previewUrl,
          artwork: item.al?.picUrl || neteaseCatalog[index % neteaseCatalog.length].artwork,
          moodTags: ["netease", moodKeywords[mood].split(" ")[0]],
          energy: Math.max(20, 90 - index * 7),
          explanation: `来自网易云音乐的推荐，为你精选适合当前${mood}氛围的中文歌曲。`,
          source: "netease"
        };
      })
    );
  } catch {
    return [];
  }
}

export async function searchTracksByMood(mood: MoodOption): Promise<Track[]> {
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
  return neteaseCatalog.filter((track: Track) => track.moodTags.includes(mood));
}
