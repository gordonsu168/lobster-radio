import type { MoodOption, Preferences, Track } from "../types.js";

interface MusicCuratorInput {
  mood: MoodOption;
  contextSummary: string;
  candidateTracks: Track[];
  preferences: Preferences;
}

export class MusicCuratorAgent {
  async curate(input: MusicCuratorInput): Promise<Track[]> {
    // 去重 + 过滤乱码歌曲
    const filtered = input.candidateTracks.filter((track, index, all) => {
      const isDuplicate = all.findIndex((item) => item.id === track.id) === index;
      if (!isDuplicate) return false;
      
      // 过滤乱码标题（包含非中文/英文/数字/常用标点的）
      const hasGarbled = /[\uE000-\uF8FF\uFFF0-\uFFFF\u0000-\u001F]/.test(track.title);
      if (hasGarbled) return false;
      
      return true;
    });

    return filtered
      .sort((a, b) => {
        const aLiked = input.preferences.likes.includes(a.id) ? 1 : 0;
        const bLiked = input.preferences.likes.includes(b.id) ? 1 : 0;
        const aDisliked = input.preferences.dislikes.includes(a.id) ? 1 : 0;
        const bDisliked = input.preferences.dislikes.includes(b.id) ? 1 : 0;
        return bLiked - aLiked || aDisliked - bDisliked || b.energy - a.energy;
      })
      .slice(0, 20) // 🎵 增加到 20 首歌！
      .map((track) => ({
        ...track,
        explanation: `${track.explanation} Curated for ${input.mood.toLowerCase()} mode with context: ${input.contextSummary}`
      }));
  }
}
