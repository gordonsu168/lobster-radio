import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKI_PATH = path.join(__dirname, "../../src/data/songs-wiki.json"); // Assuming compiled output is in dist, so using original
async function dedupe() {
    try {
        const data = await fs.readFile(WIKI_PATH, "utf-8");
        const wiki = JSON.parse(data);
        const uniqueSongs = {};
        const seen = new Set();
        let removedCount = 0;
        for (const [id, song] of Object.entries(wiki.songs)) {
            const key = `${song.title} - ${song.artist}`.toLowerCase();
            if (!seen.has(key)) {
                uniqueSongs[id] = song;
                seen.add(key);
            }
            else {
                removedCount++;
                console.log(`Removed duplicate: ${key} (id: ${id})`);
            }
        }
        wiki.songs = uniqueSongs;
        wiki._meta.totalSongs = Object.keys(uniqueSongs).length;
        wiki._meta.lastUpdated = new Date().toISOString().split("T")[0];
        await fs.writeFile(WIKI_PATH, JSON.stringify(wiki, null, 2), "utf-8");
        console.log(`Removed ${removedCount} duplicates.`);
    }
    catch (err) {
        console.error(err);
    }
}
dedupe();
