import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { scanMusicLibrary, searchTracks } from "../services/musicLibraryService.js";
import { getPlayHistory, getAestheticDna, saveAestheticDna, updateFeedback } from "../services/storageService.js";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { agentPlayer } from "../services/agentPlayerService.js";

// 强行禁音：后端严禁向终端屏幕打印任何字符 (stdout)，以免干扰 MCP 协议
// 我们将所有日志重定向到 stderr，这样 CLI wrapper 可以捕获并显示
console.log = (...args) => { console.error(...args); };
// console.error 保持可用，输出到 stderr

const server = new Server({ name: "lobster-music-core", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "sniff_user_dna", description: "重构 DNA 审美指纹", inputSchema: { type: "object", properties: {} } },
      { name: "trigger_radio_broadcast", description: "启动电台直播模式", inputSchema: { type: "object", properties: {} } },
      { name: "control_player", description: "控制播放器 (next/prev/toggle/clear)", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
      { name: "stop_stream", description: "停止电台直播并清空播放队列", inputSchema: { type: "object", properties: {} } },
      { name: "play_song", description: "点歌并播放。输入歌曲名或歌手名。", inputSchema: { type: "object", properties: { query: { type: "string", description: "歌曲名或歌手名" } }, required: ["query"] } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const dna = await getAestheticDna();
    const agent = new LobsterCoreXAgent(dna);

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

        const b64 = track.previewUrl.split("/stream/")[1];
        const finalPath = b64 ? Buffer.from(b64, "base64url").toString() : track.previewUrl;
        
        agentPlayer.add(finalPath, `${track.artist} - ${track.title}`, track.id);
        
        const info = `[PLAYING] 已锁定信号: ${track.artist} - ${track.title}${wiki?.releaseYear ? ` (${wiki.releaseYear})` : ""}`;
        return { content: [{ type: "text", text: info }] };
    }

    if (name === "trigger_radio_broadcast") {
        try {
            const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
            agentPlayer.clear();

            // 注册自动补充回调，实现持续播放
            agentPlayer.setReplenishCallback(async () => { await fetchNextRadioSegment(); });

            // 立即获取当前这一段的信息
            const { track, dj_talk } = await fetchNextRadioSegment();

            const report = `
### [DJ_SYNC] 📡 信号塔已对齐

> **DJ-X 旁白：** "${dj_talk}"
> **正在注入：** ${track.artist} - ${track.title}
            `.trim();

            return { content: [{ type: "text", text: report }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `[ERROR] 信号连接失败: ${e.message}` }], isError: true };
        }
    }

    if (name === "stop_stream") {
        agentPlayer.clear();
        agentPlayer.setReplenishCallback(async () => {});
        return { content: [{ type: "text", text: "[STREAM_STOPPED] 电台直播已停止，播放队列已清空" }] };
    }

    if (name === "control_player") {
        const act = args?.action as string;
        if (act === "next") agentPlayer.next();
        if (act === "prev") agentPlayer.prev();
        if (act === "toggle") agentPlayer.toggle();
        if (act === "clear") agentPlayer.clear();
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
    return { content: [{ type: "text", text: `Error` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();
