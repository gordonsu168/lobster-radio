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

    const scoredTracks = filtered.map((track) => {
      let score = 0;

      if (input.preferences.likes.includes(track.id)) score += 100;
      if (input.preferences.dislikes.includes(track.id)) score -= 100;

      score += track.energy;

      const inHistory = input.preferences.history?.some((h) => h.id === track.id) ?? false;
      if (inHistory) score -= 50;

      score += Math.random() * 10;

      return { track, score };
    });

    return scoredTracks
      .sort((a, b) => b.score - a.score)
      .map((item) => item.track)
      .slice(0, 20)
      .map((track) => ({
        ...track,
        explanation: `${track.explanation} Curated for ${input.mood.toLowerCase()} mode with context: ${input.contextSummary}`
      }));
  }
}
