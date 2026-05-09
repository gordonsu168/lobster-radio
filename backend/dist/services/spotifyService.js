import { fallbackCatalog } from "../data/fallbackCatalog.js";
import { resolveRuntimeSecrets } from "./settingsResolver.js";
const moodQueries = {
    Working: "focus electronic indie chill",
    Relaxing: "ambient downtempo chill",
    Exercising: "workout cardio hits",
    Party: "party dance pop",
    Sleepy: "sleep acoustic calm"
};
async function getSpotifyToken(clientId, clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });
    if (!response.ok) {
        throw new Error("Spotify token request failed");
    }
    const payload = (await response.json());
    return payload.access_token;
}
export async function searchTracksByMood(mood) {
    const secrets = await resolveRuntimeSecrets();
    if (!secrets.spotifyClientId || !secrets.spotifyClientSecret) {
        return fallbackCatalog.filter((track) => track.moodTags.includes(mood));
    }
    try {
        const token = await getSpotifyToken(secrets.spotifyClientId, secrets.spotifyClientSecret);
        const query = encodeURIComponent(moodQueries[mood]);
        const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=8`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error("Spotify search failed");
        }
        const payload = (await response.json());
        const enriched = payload.tracks.items.map((item, index) => ({
            id: item.id,
            title: item.name,
            artist: item.artists.map((artist) => artist.name).join(", "),
            album: item.album.name,
            previewUrl: item.preview_url,
            artwork: item.album.images[0]?.url ?? fallbackCatalog[index % fallbackCatalog.length].artwork,
            moodTags: [mood, "spotify", moodQueries[mood].split(" ")[0]],
            energy: Math.max(25, 90 - index * 6),
            explanation: `Picked from Spotify for a ${mood.toLowerCase()} session, balancing relevance and rotation freshness.`,
            source: "spotify"
        }));
        return enriched.length > 0 ? enriched : fallbackCatalog.filter((track) => track.moodTags.includes(mood));
    }
    catch {
        return fallbackCatalog.filter((track) => track.moodTags.includes(mood));
    }
}
