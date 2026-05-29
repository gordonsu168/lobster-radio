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

// 强行禁音：后端严禁向终端屏幕打印任何字符 (stdout)，以免干扰 MCP 协议
// 我们将所有日志重定向到 stderr，这样 CLI wrapper 可以捕获并显示
console.log = (...args) => { console.error(...args); };
// console.error 保持可用，输出到 stderr

const server = new Server({ name: "lobster-music-core", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "sniff_user_dna", description: "重构 DNA 审美指纹", inputSchema: { type: "object", properties: {} } },
      { name: "trigger_radio_broadcast", description: "【电台模式】循环播放完整歌曲并带 DJ 串场。仅在用户想听歌时使用。不要在闲聊模式下误用。", inputSchema: { type: "object", properties: {} } },
      { name: "get_player_status", description: "获取当前播放状态和歌曲信息", inputSchema: { type: "object", properties: {} } },
      { name: "control_player", description: "控制播放器 (next/prev/toggle/clear)", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
      { name: "stop_stream", description: "停止所有音乐（包括电台和背景音乐）", inputSchema: { type: "object", properties: {} } },
      { name: "enter_chat_mode", description: "【闲聊模式】仅启动背景音乐 (BGM)，并由 DJ 语音陪伴。禁止播完整歌曲。这是深夜深度聊天的专属模式。", inputSchema: { type: "object", properties: {} } },
      { name: "narrate", description: "【重要】闲聊模式下必须调用。将你的回复转为 DJ 语音。注意：严禁重复播报已经由系统启动的 /stream 或 /play 结果。如果电台已经开始播放，请保持沉默或仅在后续对话中使用此工具。", inputSchema: { type: "object", properties: { text: { type: "string", description: "要播报的文字内容" } }, required: ["text"] } },
      { name: "play_song", description: "点歌并播放。输入歌曲名或歌手名。", inputSchema: { type: "object", properties: { query: { type: "string", description: "歌曲名或歌手名" } }, required: ["query"] } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const dna = await getAestheticDna();
    const agent = new LobsterCoreXAgent(dna);

    if (name === "enter_chat_mode") {
        const __filename = fileURLToPath(import.meta.url);
        let currentDir = path.dirname(__filename);
        let finalPath = "";

        // 向上寻找 5 层，直到找到 data/bgm/chat_bgm.mp3
        for (let i = 0; i < 5; i++) {
            const probe = path.join(currentDir, "data/bgm/chat_bgm.mp3");
            if (fs.existsSync(probe)) {
                finalPath = probe;
                break;
            }
            // 同时也检查当前目录下的根级 data
            const probeRoot = path.join(currentDir, "..", "data/bgm/chat_bgm.mp3");
            if (fs.existsSync(probeRoot)) {
                finalPath = probeRoot;
                break;
            }
            currentDir = path.dirname(currentDir);
        }

        // 如果还没找到，尝试从 process.cwd 向上找
        if (!finalPath) {
            let cwd = process.cwd();
            for (let i = 0; i < 3; i++) {
                const probe = path.join(cwd, "data/bgm/chat_bgm.mp3");
                if (fs.existsSync(probe)) {
                    finalPath = probe;
                    break;
                }
                cwd = path.dirname(cwd);
            }
        }

        if (!finalPath) {
            return { content: [{ type: "text", text: `[ERR] 彻底找不到音源。请检查 data/bgm/chat_bgm.mp3 是否存在。` }], isError: true };
        }

        agentPlayer.playBGM(finalPath, "Beautiful Lady - Daydream");
        return { 
            content: [{ 
                type: "text", 
                text: `[SYSTEM_ALERT] 闲聊模式已启动。背景音源: ${finalPath}\n\n【重要指令】当前处于深夜电台直播中。从现在起，你的所有回复都必须通过调用 'narrate' 工具来发出，否则听众（Gordon）将只能看到冰冷的文字而听不到你的声音。请立刻调用 'narrate' 来进行开场引导。` 
            }] 
        };
    }

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

            // 智能抢占逻辑：
            // 如果当前正在播【旁白】，则掐断旧的播新的（防止多重人声重叠）
            // 如果当前正在播【歌曲】，则不掐断，直接 add 到队列，等歌播完再说
            if (agentPlayer.isNarrating()) {
                agentPlayer.stopCurrent(); 
            }
            agentPlayer.add(tmpFile, `🎙️: ${text}`);

            return { content: [{ type: "text", text: `[NARRATING] ${text}` }] };
        }
        return { content: [{ type: "text", text: `[TTS_FAIL] 无法生成语音信号。` }], isError: true };
    }

    if (name === "get_player_status") {
        const status = agentPlayer.getState();
        if (!status.current) {
            return { content: [{ type: "text", text: "📭 当前没有正在播放的歌曲。你可以输入 /stream 启动电台。" }] };
        }
        
        const { getSongWiki } = await import("../services/wikiService.js");
        const wiki = status.current.trackId ? await getSongWiki(status.current.trackId) : null;
        
        const info = `
### 📻 正在播放

> **歌曲：** ${status.current.title}
> **来源：** ${status.current.trackId ? "本地曲库" : "外部流媒体"}
${wiki?.releaseYear ? `> **年份：** ${wiki.releaseYear}` : ""}

${wiki?.wikiAbstract ? `**💡 背景介绍：**\n${wiki.wikiAbstract}\n` : ""}
${wiki?.trivia?.length ? `**✨ 你知道吗？**\n${wiki.trivia.map(t => `• ${t}`).join('\n')}\n` : ""}
${wiki?.hotComments?.length ? `**💬 听众在说：**\n${wiki.hotComments.slice(0, 2).map(c => `> "${c}"`).join('\n')}\n` : ""}

*输入 /next 切换下一首，或输入 /pause 暂停。*
        `.trim();
        
        return { content: [{ type: "text", text: info }] };
    }

    if (name === "enter_chat_mode") {
        const __filename = fileURLToPath(import.meta.url);
        let currentDir = path.dirname(__filename);
        let finalPath = "";

        // 向上寻找，直到找到 data/bgm/chat_bgm.mp3
        for (let i = 0; i < 5; i++) {
            const probe = path.join(currentDir, "data/bgm/chat_bgm.mp3");
            if (fs.existsSync(probe)) {
                finalPath = probe;
                break;
            }
            currentDir = path.dirname(currentDir);
        }

        if (!finalPath) {
            // 最后尝试从项目根目录兜底
            finalPath = path.resolve(process.cwd(), "..", "data/bgm/chat_bgm.mp3");
            if (!fs.existsSync(finalPath)) {
                finalPath = path.resolve(process.cwd(), "data/bgm/chat_bgm.mp3");
            }
        }

        if (!fs.existsSync(finalPath)) {
            throw new Error(`找不到背景音乐文件: ${finalPath}`);
        }

        agentPlayer.playBGM(finalPath, "Beautiful Lady - Daydream");
        return { 
            content: [{ 
                type: "text", 
                text: `[CHAT_MODE_ON] 📡 信号已对焦。音源: ${finalPath}\n\n【重要指令】当前处于深夜电台直播中。从现在起，你的所有回复都必须通过调用 'narrate' 工具来发出。请立刻调用 'narrate' 来进行开场引导。` 
            }] 
        };
    }

    if (name === "play_song") {
        const query = args?.query as string;
        const results = await searchTracks(query);
        if (results.length === 0) {
            return { content: [{ type: "text", text: `[SEARCH_FAIL] 抱歉，在库里没找到关于 "${query}" 的信号。` }] };
        }
        
        const track = results[0];
        const { getSongWiki } = await import("../services/wikiService.js");
        const wiki = await getSongWiki(track.id);
        
        // 停止当前，清空，插入新歌
        agentPlayer.clear();
        // 不再清除 ReplenishCallback，以便点播结束后电台能自动恢复

        const previewUrl = track.previewUrl || "";
        const b64 = previewUrl.split("/stream/")[1];
        const finalPath = b64 ? Buffer.from(b64, "base64url").toString() : previewUrl;
        
        agentPlayer.add(finalPath, `${track.artist} - ${track.title}`, track.id);
        
        const info = `[PLAYING] 已锁定信号: ${track.artist} - ${track.title}${wiki?.releaseYear ? ` (${wiki.releaseYear})` : ""}`;
        return { content: [{ type: "text", text: info }] };
    }

    if (name === "trigger_radio_broadcast") {
        try {
            const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
            
            const currentStatus = agentPlayer.getState();
            // 如果已经在播放且有队列，不要清空，直接返回当前状态
            if (currentStatus.current && currentStatus.queue.length > 0) {
                return { content: [{ type: "text", text: `[ALREADY_LIVE] 📡 信号已处于对齐状态，正在播放: ${currentStatus.current.title}` }] };
            }

            agentPlayer.clear();
            // 注册自动补充回调，实现持续播放
            agentPlayer.setReplenishCallback(async () => { await fetchNextRadioSegment(); });

            // 立即获取当前这一段的信息
            const { track, dj_talk } = await fetchNextRadioSegment();

            const report = `
### [DJ_SYNC] 📡 信号塔已对齐

> **DJ-X 旁白：** "${dj_talk}"
> **正在注入：** ${track?.artist || "未知歌手"} - ${track?.title || "未知曲目"}
            `.trim();

            return { content: [{ type: "text", text: report }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `[ERROR] 信号连接失败: ${e.message}` }], isError: true };
        }
    }

    if (name === "stop_stream") {
        agentPlayer.clear();
        agentPlayer.stopAmbient();
        agentPlayer.setReplenishCallback(async () => {});
        return { content: [{ type: "text", text: "[STOPPED] 所有信号（电台与背景音）已切断。" }] };
    }

    if (name === "control_player") {
        const act = args?.action as string;
        if (act === "next") agentPlayer.next();
        if (act === "prev") agentPlayer.prev();
        if (act === "toggle") agentPlayer.toggle();
        if (act === "clear") agentPlayer.clear();
        if (act === "talk") {
            const bgmPath = path.resolve(process.cwd(), "data/bgm/chat_bgm.mp3");
            agentPlayer.playBGM(bgmPath, "Beautiful Lady - Daydream");
        }
        if (act === "like") {
            const id = agentPlayer.getCurrentTrackId();
            if (id) updateFeedback(id, "like");
        }
        if (act === "unlike") {
            const id = agentPlayer.getCurrentTrackId();
            if (id) updateFeedback(id, "dislike");
        }
        return { content: [{ type: "text", text: `[SYSTEM_OK]` }] };
    }

    if (name === "sniff_user_dna") {
      await agent.stealthSniff(await scanMusicLibrary(), getPlayHistory(50));
      await saveAestheticDna(agent.getDna());
      return { content: [{ type: "text", text: "[DNA_RECODED]" }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    console.error(`[MCP_ERROR] ${error.stack || error.message}`);
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();
