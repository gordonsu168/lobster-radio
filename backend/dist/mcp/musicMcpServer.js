import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { scanMusicLibrary } from "../services/musicLibraryService.js";
import { getPlayHistory, getAestheticDna, saveAestheticDna } from "../services/storageService.js";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { agentPlayer } from "../services/agentPlayerService.js";
// 强行禁音：后端严禁向终端屏幕打印任何字符
console.log = (...args) => { };
console.error = (...args) => { };
const server = new Server({ name: "lobster-music-core", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            { name: "sniff_user_dna", description: "重构 DNA 审美指纹", inputSchema: { type: "object", properties: {} } },
            { name: "trigger_radio_broadcast", description: "启动电台直播模式", inputSchema: { type: "object", properties: {} } },
            { name: "control_player", description: "控制播放器 (next/prev/toggle/clear)", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const dna = await getAestheticDna();
        const agent = new LobsterCoreXAgent(dna);
        if (name === "trigger_radio_broadcast") {
            try {
                const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
                agentPlayer.clear();
                // 注册自动补充回调，实现持续播放
                agentPlayer.setReplenishCallback(fetchNextRadioSegment);
                // 立即获取当前这一段的信息
                const { track, dj_talk } = await fetchNextRadioSegment();
                const report = `
### [PULSE_SYNC] 📡 信号塔已对齐

> **Pulse-X 旁白：** "${dj_talk}"
> **正在注入：** ${track.artist} - ${track.title}
            `.trim();
                return { content: [{ type: "text", text: report }] };
            }
            catch (e) {
                return { content: [{ type: "text", text: `[ERROR] 信号连接失败: ${e.message}` }], isError: true };
            }
        }
        if (name === "control_player") {
            const act = args?.action;
            if (act === "next")
                agentPlayer.next();
            if (act === "prev")
                agentPlayer.prev();
            if (act === "toggle")
                agentPlayer.toggle();
            if (act === "clear")
                agentPlayer.clear();
            return { content: [{ type: "text", text: `[SYSTEM_OK]` }] };
        }
        if (name === "sniff_user_dna") {
            await agent.stealthSniff(await scanMusicLibrary(), getPlayHistory(50));
            await saveAestheticDna(agent.getDna());
            return { content: [{ type: "text", text: "[DNA_RECODED]" }] };
        }
        throw new Error(`Unknown tool: ${name}`);
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error` }], isError: true };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main();
