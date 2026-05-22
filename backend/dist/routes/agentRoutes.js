import { Router } from "express";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { getPlayHistory, getAestheticDna, saveAestheticDna } from "../services/storageService.js";
import { scanMusicLibrary } from "../services/musicLibraryService.js";
export const lobsterCoreXRouter = Router();
// Initialize the agent with stored DNA
async function getAgent() {
    const dna = await getAestheticDna();
    return new LobsterCoreXAgent(dna);
}
lobsterCoreXRouter.post("/init", async (req, res) => {
    try {
        const agent = await getAgent();
        const dna = agent.getDna();
        res.json({ dna, status: "READY" });
    }
    catch (error) {
        console.error("Error in Lobster-Core-X init:", error);
        res.status(500).json({ error: "Failed to initialize Lobster-Core-X" });
    }
});
lobsterCoreXRouter.post("/sniff", async (req, res) => {
    try {
        const agent = await getAgent();
        const localTracks = await scanMusicLibrary();
        const ncmHistory = getPlayHistory(50);
        const logs = await agent.stealthSniff(localTracks, ncmHistory);
        const updatedDna = agent.getDna();
        await saveAestheticDna(updatedDna);
        res.json({ logs, dna: updatedDna });
    }
    catch (error) {
        console.error("Error in Lobster-Core-X sniff:", error);
        res.status(500).json({ error: "Failed to perform stealth sniff" });
    }
});
lobsterCoreXRouter.post("/evolve", async (req, res) => {
    try {
        const { trackId, completionRate } = req.body;
        const agent = await getAgent();
        const updatedDna = await agent.reflectAndEvolve(trackId, completionRate);
        await saveAestheticDna(updatedDna);
        res.json({ dna: updatedDna, logs: agent.getLogs() });
    }
    catch (error) {
        console.error("Error in Lobster-Core-X evolve:", error);
        res.status(500).json({ error: "Failed to evolve Lobster-Core-X" });
    }
});
lobsterCoreXRouter.post("/dig", async (req, res) => {
    try {
        const { seedTrack } = req.body;
        const agent = await getAgent();
        const tracks = await agent.ghostDig(seedTrack || "Unknown Seed");
        res.json({ tracks, logs: agent.getLogs(), dna: agent.getDna() });
    }
    catch (error) {
        console.error("Error in Lobster-Core-X dig:", error);
        res.status(500).json({ error: "Failed to perform ghost dig" });
    }
});
