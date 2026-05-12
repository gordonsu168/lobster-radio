import {
  LearningAgent,
  MoodAnalyzerAgent,
  MusicCuratorAgent,
  NarratorAgent,
  RadioDJAgent,
} from "lobster-radio-agents";
import { generateNarration, type DJStyle } from "./narrationGenerator.js";
import type { MoodOption, Preferences, RecommendationResponse, Track } from "../types.js";
import { fallbackCatalog } from "../data/fallbackCatalog.js";
import { getPreferences, savePreferences, addPlayHistory, updateFeedback } from "./storageService.js";
import { searchTracksByMood as searchSpotify } from "./spotifyService.js";
import { searchTracksByMood as searchNetEase } from "./neteaseService.js";
import { getLocalTracksByMood } from "./musicLibraryService.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";

function getTimeSegment(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) {
    return "late night";
  }
  if (hour < 12) {
    return "morning";
  }
  if (hour < 18) {
    return "afternoon";
  }
  return "evening";
}

function scoreTracks(tracks: Track[], preferences: Preferences, mood: MoodOption, preferredSource: string) {
  // 优先保留能播放的歌曲，至少保留 5 首，不够就放宽条件
  let filtered = tracks.filter((track) => track.previewUrl);
  if (filtered.length < 5) {
    filtered = tracks;
  }
  
  return filtered
    .map((track) => {
      let score = track.energy;
      
      // 偏好来源优先 +40 分
      if (preferredSource === "local" && track.source === "local") {
        score += 40;
      } else if (preferredSource === "netease" && track.source === "netease") {
        score += 40;
      } else if (preferredSource === "spotify" && track.source === "spotify") {
        score += 40;
      }
      
      if (preferences.likes.includes(track.id)) {
        score += 25;
      }
      if (preferences.dislikes.includes(track.id)) {
        score -= 40;
      }
      score += preferences.moodAffinity[mood] ?? 0;
      if (track.moodTags.includes(mood)) {
        score += 15;
      }
      return { track, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track);
}

export async function buildRecommendations(mood: MoodOption, style: DJStyle = "classic", language?: string): Promise<RecommendationResponse> {
  const preferences = await getPreferences();
  const secrets = await resolveRuntimeSecrets();
  const musicCurator = new MusicCuratorAgent();
  
  // 使用传入的语言参数，如果没有则使用设置中的语言
  const djLanguage = (language || secrets.djLanguage) as "zh-CN" | "zh-HK" | "en-US";
  
  console.log(`🌐 buildRecommendations - 传入语言: ${language}, 设置语言: ${secrets.djLanguage}, 最终语言: ${djLanguage}`);

  // 多源音乐搜索：本地音乐优先
  const localTracks = await getLocalTracksByMood(mood);
  const neteaseTracks = await searchNetEase(mood);
  const spotifyTracks = await searchSpotify(mood);
  const backup = fallbackCatalog.filter((track) => track.moodTags.includes(mood));

  let sourceTracks: Track[];
  if (secrets.preferredMusicSource === "local") {
    sourceTracks = [...localTracks, ...neteaseTracks, ...spotifyTracks];
  } else if (secrets.preferredMusicSource === "netease") {
    sourceTracks = [...neteaseTracks, ...localTracks, ...spotifyTracks];
  } else if (secrets.preferredMusicSource === "spotify") {
    sourceTracks = [...spotifyTracks, ...localTracks, ...neteaseTracks];
  } else {
    // auto：本地音乐 > 网易云 > Spotify
    sourceTracks = [...localTracks, ...neteaseTracks, ...spotifyTracks];
  }

  const ranked = scoreTracks([...sourceTracks, ...backup], preferences, mood, secrets.preferredMusicSource);
  const curated = await musicCurator.curate({
    mood,
    contextSummary: "Music recommendation based on mood",
    candidateTracks: ranked,
    preferences
  });

  const selectedTrack = curated[0] || backup[0];
  console.log(`🎵 生成旁白 - 歌曲: ${selectedTrack.title}, 风格: ${style}, 语言: ${djLanguage}`);

  // Use RadioDJAgent for persona-based narration (new: more natural radio DJ style)
  // Fallback to template-based generation if RadioDJ fails
  let narration: string;
  const hasMemoryInsight = !!preferences.memoryInsight;
  let updatedPreferences = { ...preferences };

  try {
    const radioDJ = new RadioDJAgent();
    narration = await radioDJ.generateIntro(selectedTrack, mood, style, djLanguage, "Lobster Radio recommendation", preferences.memoryInsight);
    console.log(`🎙️ 使用 RadioDJAgent 生成的旁白: ${narration}`);

    // Clear memoryInsight after use so it doesn't get reused
    updatedPreferences.memoryInsight = undefined;
  } catch (error) {
    console.error("❌ RadioDJAgent failed, falling back to template:", error);
    narration = generateNarration(selectedTrack, style, djLanguage);
    console.log(`🎙️ 回退使用模板生成的旁白: ${narration}`);
  }

  const historyEntry = {
    ...selectedTrack,
    playedAt: new Date().toISOString()
  };
  addPlayHistory(historyEntry as any);
  await savePreferences(updatedPreferences);

  return {
    mood,
    contextSummary: "Lobster Radio recommendation",
    narration,
    tracks: curated as any,
    selectedTrack: selectedTrack as any
  };
}

export async function captureFeedback(trackId: string, feedback: "like" | "dislike", mood: MoodOption) {
  const preferences = await getPreferences();
  const learningAgent = new LearningAgent();
  const updated = await learningAgent.learn({
    trackId,
    feedback,
    mood,
    preferences
  });
  updateFeedback(trackId, feedback);
  return savePreferences(updated as any);
}
