import { Router } from "express";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { getAestheticDna, saveAestheticDna, getRuntimeSettings, updateFeedback } from "../services/storageService.js";
import { agentPlayer } from "../services/agentPlayerService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { getSongWiki } from "../services/wikiService.js";
import { getUserState, getCachedUserState } from "../services/userStateMonitor.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
export const lobsterCoreXRouter = Router();
async function getAgent() {
    const secrets = await resolveRuntimeSecrets();
    process.env.DEEPSEEK_API_KEY = secrets.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_API_KEY = secrets.openAiApiKey || process.env.OPENAI_API_KEY;
    const dna = await getAestheticDna();
    return new LobsterCoreXAgent(dna);
}
async function broadcastNarration(text) {
    const settings = await getRuntimeSettings();
    const secrets = await resolveRuntimeSecrets();
    const ttsResult = await synthesizeSpeech(text, settings.defaultVoice, {
        provider: settings.defaultTtsProvider,
        apiKey: settings.openAiApiKey || secrets.openAiApiKey,
        language: "zh-CN"
    });
    if (ttsResult.audioBase64) {
        const tmpFile = path.join(os.tmpdir(), `x_narration_${Date.now()}.mp3`);
        await fs.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
        agentPlayer.add(tmpFile, "🎙️ LOBSTER-VOICE");
    }
}
lobsterCoreXRouter.get("/status", (req, res) => {
    res.json(agentPlayer.getState());
});
lobsterCoreXRouter.get("/state", async (_req, res) => {
    try {
        const state = await getUserState();
        res.json(state);
    }
    catch (error) {
        // Return cached state on failure, or a fallback
        const cached = getCachedUserState();
        if (cached)
            return res.json(cached);
        res.status(500).json({ error: "Unable to detect user state" });
    }
});
lobsterCoreXRouter.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        const msg = message.trim().toLowerCase();
        // 1. 物理指令拦截 (最高优先级)
        if (msg.startsWith('/play ')) {
            const query = message.slice(6).trim();
            const { searchTracks } = await import("../services/musicLibraryService.js");
            const results = await searchTracks(query);
            if (results.length === 0) {
                return res.json({ logs: [{ id: 'p1', timestamp: Date.now(), type: 'action', content: `[SEARCH_FAIL] 没找到关于 "${query}" 的信号。` }], dna: (await getAgent()).getDna() });
            }
            const track = results[0];
            agentPlayer.clear();
            const previewUrl = track.previewUrl || "";
            const b64 = previewUrl.split("/stream/")[1];
            const finalPath = b64 ? Buffer.from(b64, "base64url").toString() : previewUrl;
            agentPlayer.add(finalPath, `${track.artist} - ${track.title}`, track.id);
            return res.json({ logs: [{ id: 'p2', timestamp: Date.now(), type: 'action', content: `[PLAYING] 锁定信号: ${track.artist} - ${track.title}` }], dna: (await getAgent()).getDna() });
        }
        if (msg === '/next') {
            agentPlayer.next();
            return res.json({ logs: [{ id: 'c1', timestamp: Date.now(), type: 'action', content: '[COMMAND] 下一首频率。' }], dna: (await getAgent()).getDna() });
        }
        if (msg === '/pause' || msg === '/stop') {
            agentPlayer.toggle();
            return res.json({ logs: [], dna: (await getAgent()).getDna() });
        }
        if (msg === '/clear') {
            agentPlayer.clear();
            return res.json({ logs: [{ id: 'c2', timestamp: Date.now(), type: 'action', content: '[COMMAND] 序列清空。' }], dna: (await getAgent()).getDna() });
        }
        if (msg === '/like') {
            const trackId = agentPlayer.getCurrentTrackId();
            if (trackId) {
                updateFeedback(trackId, "like");
            }
            return res.json({ logs: [{ id: 'l1', timestamp: Date.now(), type: 'action', content: trackId ? '[LIKE] 已标记喜欢。' : '[LIKE] 没有正在播放的歌曲。' }], dna: (await getAgent()).getDna() });
        }
        if (msg === '/dislike') {
            const trackId = agentPlayer.getCurrentTrackId();
            if (trackId) {
                updateFeedback(trackId, "dislike");
            }
            return res.json({ logs: [{ id: 'u1', timestamp: Date.now(), type: 'action', content: trackId ? '[DISLIKE] 已标记不喜欢。' : '[DISLIKE] 没有正在播放的歌曲。' }], dna: (await getAgent()).getDna() });
        }
        if (msg === '/now' || msg === '/status') {
            const state = agentPlayer.getState();
            if (!state.current) {
                return res.json({ logs: [{ id: 'n1', timestamp: Date.now(), type: 'action', content: '[NOW] 当前没有播放任何曲目。' }], dna: (await getAgent()).getDna() });
            }
            const cur = state.current;
            let details = `**▶ 正在播放**\n> ${cur.title}\n`;
            if (cur.trackId) {
                try {
                    const wiki = await getSongWiki(cur.trackId);
                    if (wiki) {
                        const meta = [];
                        if (wiki.artist)
                            meta.push(`**歌手:** ${wiki.artist}`);
                        if (wiki.album)
                            meta.push(`**专辑:** ${wiki.album}`);
                        if (wiki.releaseYear)
                            meta.push(`**年份:** ${wiki.releaseYear}`);
                        if (wiki.composer)
                            meta.push(`**作曲:** ${wiki.composer}`);
                        if (wiki.lyricist)
                            meta.push(`**作词:** ${wiki.lyricist}`);
                        if (meta.length > 0)
                            details += meta.join(' | ') + '\n';
                        if (wiki.hotComments?.length) {
                            details += `> 💬 *"${wiki.hotComments[0]}"*\n`;
                        }
                        if (wiki.trivia?.length) {
                            details += `> 📖 ${wiki.trivia[0]}\n`;
                        }
                    }
                }
                catch (e) { /* wiki lookup optional */ }
            }
            details += `\n队列中: ${state.queue.length} 首 | ${state.isPaused ? '⏸ 已暂停' : '▶ 播放中'}`;
            return res.json({ logs: [{ id: 'n1', timestamp: Date.now(), type: 'message', content: details }], dna: (await getAgent()).getDna() });
        }
        // 2. /stream 模式 (接入全局电台引擎)
        if (msg === '/stream') {
            const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
            agentPlayer.clear();
            const { track, dj_talk } = await fetchNextRadioSegment();
            return res.json({
                logs: [
                    { id: 's1', timestamp: Date.now(), type: 'action', content: `[RADIO_LOCKED] 成功连接至 http://localhost:5173/stream 的逻辑核心。` },
                    { id: 's2', timestamp: Date.now(), type: 'message', content: `\n> **DJ-X 旁白：** "${dj_talk}"\n\n> **正在注入：** ${track?.artist || "未知歌手"} - ${track?.title || "未知曲目"}` }
                ],
                dna: (await getAgent()).getDna()
            });
        }
        // 3. 普通对话
        const agent = await getAgent();
        const logs = await agent.chat(message);
        await saveAestheticDna(agent.getDna());
        res.json({ logs, dna: agent.getDna() });
    }
    catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "Brain fail" });
    }
});
lobsterCoreXRouter.post("/init", async (req, res) => {
    const agent = await getAgent();
    res.json({ dna: agent.getDna(), status: "READY" });
});
