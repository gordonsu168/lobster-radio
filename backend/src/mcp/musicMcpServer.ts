import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { scanMusicLibrary, searchTracks } from "../services/musicLibraryService.js";
import { getPlayHistory, getAestheticDna, saveAestheticDna, updateFeedback, getRuntimeSettings } from "../services/storageService.js";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { agentPlayer } from "../services/agentPlayerService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { resolveRuntimeSecrets } from "../services/settingsResolver.js";
import os from "node:os";
import fsp from "node:fs/promises";

console.log = (...args) => { console.error(...args); };

const server = new Server({ name: "lobster-music-core", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "sniff_user_dna", description: "重构 DNA 审美指纹", inputSchema: { type: "object", properties: {} } },
      { name: "trigger_radio_broadcast", description: "【电台模式】循环播放完整歌曲。如果已有歌在播，新歌排在后面，不中断当前。", inputSchema: { type: "object", properties: {} } },
      { name: "get_player_status", description: "获取当前播放状态", inputSchema: { type: "object", properties: {} } },
      { name: "control_player", description: "控制播放器 (next/toggle/clear)", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
      { name: "stop_stream", description: "停止所有播放", inputSchema: { type: "object", properties: {} } },
      { name: "enter_chat_mode", description: "【闲聊模式】仅启动背景音乐 BGM。", inputSchema: { type: "object", properties: {} } },
      { name: "narrate", description: "【说话】将文字转为 DJ 语音并播放。", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
      { name: "play_song", description: "点播歌曲。", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const dna = await getAestheticDna();
    const agent = new LobsterCoreXAgent(dna);

    if (name === "narrate") {
        const text = args?.text as string;
        const settings = await getRuntimeSettings();
        const secrets = await resolveRuntimeSecrets();
        const ttsResult: any = await synthesizeSpeech(text, settings.defaultVoice, {
            provider: settings.defaultTtsProvider,
            apiKey: settings.openAiApiKey || secrets.openAiApiKey,
            language: "zh-CN"
        });

        if (ttsResult.audioBase64) {
            const tmpFile = path.join(os.tmpdir(), `dj_narrate_${Date.now()}.mp3`);
            await fsp.writeFile(tmpFile, Buffer.from(ttsResult.audioBase64, 'base64'));
            agentPlayer.addVoice(tmpFile, text);
            return { content: [{ type: "text", text: `[OK] 已语音播报。` }] };
        }
        return { content: [{ type: "text", text: `[TTS_FAIL]` }], isError: true };
    }

    if (name === "trigger_radio_broadcast") {
        const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
        agentPlayer.setReplenishCallback(async () => { await fetchNextRadioSegment(); });
        await fetchNextRadioSegment();
        return { content: [{ type: "text", text: `[OK] 电台已就绪。` }] };
    }

    if (name === "play_song") {
        const query = args?.query as string;
        const results = await searchTracks(query);
        if (results.length === 0) return { content: [{ type: "text", text: `[NOT_FOUND]` }] };
        
        const track = results[0];
        const previewUrl = track.previewUrl || "";
        const b64 = previewUrl.split("/stream/")[1];
        const finalPath = b64 ? Buffer.from(b64, "base64url").toString() : previewUrl;
        
        agentPlayer.addMusic(finalPath, `${track.artist} - ${track.title}`, track.id);
        return { content: [{ type: "text", text: `[OK] 正在准备播放: ${track.title}` }] };
    }

    if (name === "get_player_status") {
        const status = agentPlayer.getState();
        return { content: [{ type: "text", text: `[STATUS] ${status.currentMusic?.title || '空闲'}` }] };
    }

    if (name === "enter_chat_mode") {
        const __filename = fileURLToPath(import.meta.url);
        let root = path.dirname(__filename);
        let bgmPath = "";
        for (let i = 0; i < 5; i++) {
            const probe = path.join(root, "data/bgm/chat_bgm.mp3");
            if (fs.existsSync(probe)) { bgmPath = probe; break; }
            root = path.dirname(root);
        }
        agentPlayer.playBGM(bgmPath, "Beautiful Lady - Daydream");
        return { content: [{ type: "text", text: `[OK] 闲聊模式已启动。` }] };
    }

    if (name === "stop_stream") {
        agentPlayer.clear();
        return { content: [{ type: "text", text: "[OK] 已切断信号。" }] };
    }

    if (name === "control_player") {
        const act = args?.action as string;
        if (act === "next") agentPlayer.next();
        if (act === "toggle") agentPlayer.toggle();
        if (act === "clear") agentPlayer.clear();
        return { content: [{ type: "text", text: `[OK]` }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    console.error(`[MCP_ERROR] ${error.message}`);
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();
