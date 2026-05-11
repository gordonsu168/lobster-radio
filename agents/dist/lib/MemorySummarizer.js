export function getShortTermMemory(prefs, now = Date.now()) {
    if (!prefs.history || prefs.history.length === 0)
        return "";
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
    const recentHistory = prefs.history.filter(item => new Date(item.playedAt).getTime() > twelveHoursAgo);
    if (recentHistory.length === 0)
        return "";
    const totalPlayed = recentHistory.length;
    const skips = recentHistory.filter(item => item.feedback === "dislike").length;
    return `User listened to ${totalPlayed} songs in the last 12 hours and skipped ${skips}.`;
}
export function getTopArtists(prefs, count = 2) {
    const artistCounts = {};
    if (prefs.history) {
        for (const item of prefs.history) {
            if (item.artist) {
                artistCounts[item.artist] = (artistCounts[item.artist] || 0) + 1;
            }
        }
    }
    if (prefs.likes) {
        for (const artistName of prefs.likes) {
            artistCounts[artistName] = (artistCounts[artistName] || 0) + 1;
        }
    }
    return Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, count);
}
export function getTopMood(prefs) {
    let topMood = "none";
    let maxMoodValue = -Infinity;
    if (prefs.moodAffinity) {
        for (const [mood, value] of Object.entries(prefs.moodAffinity)) {
            if (value > maxMoodValue) {
                maxMoodValue = value;
                topMood = mood;
            }
        }
    }
    return topMood;
}
export function getLongTermMemory(prefs) {
    const topArtists = getTopArtists(prefs);
    const topMood = getTopMood(prefs);
    const artistText = topArtists.length > 0 ? `Their favorite artists include ${topArtists.join(" and ")}.` : "";
    const moodText = topMood !== "none" ? `Their primary mood affinity is ${topMood}.` : "";
    return `${artistText} ${moodText}`.trim();
}
