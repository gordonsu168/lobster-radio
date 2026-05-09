import { LearningAgent, MoodAnalyzerAgent, MusicCuratorAgent, NarratorAgent } from "lobster-radio-agents";
import { fallbackCatalog } from "../data/fallbackCatalog.js";
import { getPreferences, savePreferences } from "./storageService.js";
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
export async function buildRecommendations(mood) {
    const preferences = await getPreferences();
    const secrets = await resolveRuntimeSecrets();
    const moodAnalyzer = new MoodAnalyzerAgent();
    const musicCurator = new MusicCuratorAgent();
    const narrator = new NarratorAgent();
    const context = await moodAnalyzer.analyze({
        selectedMood: mood,
        timeOfDay: getTimeSegment(),
        weatherApiKey: secrets.weatherApiKey
    });
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
        contextSummary: context.summary,
        candidateTracks: ranked,
        preferences
    });
    const selectedTrack = curated[0] || backup[0];
    const narration = await narrator.generate({
        mood,
        contextSummary: context.summary,
        track: selectedTrack,
        history: preferences.history.slice(0, 5)
    });
    const historyEntry = {
        ...selectedTrack,
        playedAt: new Date().toISOString()
    };
    const dedupedHistory = [historyEntry, ...preferences.history].slice(0, 20);
    await savePreferences({
        ...preferences,
        history: dedupedHistory
    });
    return {
        mood,
        contextSummary: context.summary,
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
    return savePreferences(updated);
}
