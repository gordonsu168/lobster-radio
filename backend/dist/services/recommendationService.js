import { LearningAgent, MusicCuratorAgent, RadioDJAgent, } from "lobster-radio-agents";
import { generateNarration } from "./narrationGenerator.js";
import { generateAINarration } from "./AINarrationService.js";
import { fallbackCatalog } from "../data/fallbackCatalog.js";
import { getPreferences, savePreferences, addPlayHistory, updateFeedback, getRuntimeSettings } from "./storageService.js";
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
function scoreTracks(tracks, preferences, mood, preferredSource) {
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
        }
        else if (preferredSource === "netease" && track.source === "netease") {
            score += 40;
        }
        else if (preferredSource === "spotify" && track.source === "spotify") {
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
export async function buildRecommendations(mood, style = "classic", language) {
    const preferences = await getPreferences();
    const secrets = await resolveRuntimeSecrets();
    const musicCurator = new MusicCuratorAgent();
    // 使用传入的语言参数，如果没有则使用设置中的语言
    const djLanguage = (language || secrets.djLanguage);
    console.log(`🌐 buildRecommendations - 传入语言: ${language}, 设置语言: ${secrets.djLanguage}, 最终语言: ${djLanguage}`);
    // 多源音乐搜索：本地音乐优先
    const localTracks = await getLocalTracksByMood(mood);
    const neteaseTracks = await searchNetEase(mood);
    const spotifyTracks = await searchSpotify(mood);
    const backup = fallbackCatalog.filter((track) => track.moodTags.includes(mood));
    let sourceTracks;
    if (secrets.preferredMusicSource === "local") {
        sourceTracks = [...localTracks, ...neteaseTracks, ...spotifyTracks];
    }
    else if (secrets.preferredMusicSource === "netease") {
        sourceTracks = [...neteaseTracks, ...localTracks, ...spotifyTracks];
    }
    else if (secrets.preferredMusicSource === "spotify") {
        sourceTracks = [...spotifyTracks, ...localTracks, ...neteaseTracks];
    }
    else {
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
    // Check if AI narration is enabled
    const settings = await getRuntimeSettings();
    const aiEnabled = process.env.DISABLE_AI_NARRATION !== "true" && (settings.enableAiNarration ?? true);
    // Use AI for persona-based narration (more natural radio DJ style)
    // Fallback to template-based generation if AI fails
    let narration;
    const hasMemoryInsight = !!preferences.memoryInsight;
    let updatedPreferences = { ...preferences };
    if (aiEnabled) {
        try {
            // Try RadioDJAgent first (more context-aware with memory)
            const radioDJ = new RadioDJAgent();
            narration = await radioDJ.generateIntro(selectedTrack, mood, style, djLanguage, "Lobster Radio recommendation", preferences.memoryInsight);
            console.log(`🎙️ 使用 RadioDJAgent 生成的旁白: ${narration}`);
            // Clear memoryInsight after use so it doesn't get reused
            updatedPreferences.memoryInsight = undefined;
        }
        catch (error) {
            console.warn("❌ RadioDJAgent failed, falling back to AINarrationService:", error);
            try {
                narration = await generateAINarration(selectedTrack, style, djLanguage);
                console.log(`🎙️ 使用 AINarrationService 生成的旁白: ${narration}`);
            }
            catch (aiError) {
                console.error("❌ AINarrationService also failed, falling back to template:", aiError);
                narration = generateNarration(selectedTrack, style, djLanguage);
                console.log(`🎙️ 回退使用模板生成的旁白: ${narration}`);
            }
        }
    }
    else {
        // AI disabled, use template directly
        narration = generateNarration(selectedTrack, style, djLanguage);
        console.log(`🎙️ AI 已禁用，使用模板生成的旁白: ${narration}`);
    }
    const historyEntry = {
        ...selectedTrack,
        playedAt: new Date().toISOString()
    };
    addPlayHistory(historyEntry);
    await savePreferences(updatedPreferences);
    return {
        mood,
        contextSummary: "Lobster Radio recommendation",
        narration,
        tracks: curated,
        selectedTrack: selectedTrack
    };
}
export async function captureFeedback(trackId, feedback, mood) {
    const preferences = await getPreferences();
    const learningAgent = new LearningAgent();
    const updated = await learningAgent.learn({
        trackId,
        feedback,
        mood,
        preferences
    });
    updateFeedback(trackId, feedback);
    return savePreferences(updated);
}
