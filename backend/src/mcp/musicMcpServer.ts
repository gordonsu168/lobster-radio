import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { scanMusicLibrary } from "../services/musicLibraryService.js";
import { getPlayHistory, getAestheticDna, saveAestheticDna } from "../services/storageService.js";
import { LobsterCoreXAgent } from "lobster-radio-agents";
import { agentPlayer } from "../services/agentPlayerService.js";

console.log = (...args) => console.error(...args);

const server = new Server({ name: "lobster-music-core", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: "sniff_user_dna", description: "重构 DNA 审美指纹", inputSchema: { type: "object", properties: {} } },
      { name: "trigger_radio_broadcast", description: "启动电台直播模式：接入核心逻辑并实时注入信号", inputSchema: { type: "object", properties: {} } },
      { name: "control_player", description: "控制播放器", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const dna = await getAestheticDna();
    const agent = new LobsterCoreXAgent(dna);

    if (name === "trigger_radio_broadcast") {
        // 关键修复：立即响应，后台执行
        (async () => {
          try {
            process.stderr.write("[MCP] 📡 启动后台频率同步任务...\n");
            const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
            agentPlayer.clear();
            await fetchNextRadioSegment();
            process.stderr.write("[MCP] ✅ 信号注入链已就绪。\n");
          } catch (e: any) {
            process.stderr.write(`[MCP_ERR] 后台任务失败: ${e.message}\n`);
          }
        })();

        return { content: [{ type: "text", text: "[OK] 正在建立远端频率连接，旁白将在解密后立即注入。" }] };
    }

    if (name === "control_player") {
        const act = args?.action as string;
        if (act === "next") agentPlayer.next();
        if (act === "prev") agentPlayer.prev();
        if (act === "toggle") agentPlayer.toggle();
        if (act === "clear") agentPlayer.clear();
        return { content: [{ type: "text", text: `[SYSTEM] 指令 ${act} 执行中。` }] };
    }

    if (name === "sniff_user_dna") {
      await agent.stealthSniff(await scanMusicLibrary(), getPlayHistory(50));
      await saveAestheticDna(agent.getDna());
      return { content: [{ type: "text", text: JSON.stringify({ status: "SUCCESS" }) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Lobster Music MCP Server Online\n");

  // 关键：注册播放器补货回调，实现无限电台流
  const { fetchNextRadioSegment } = await import("../services/radioEngineService.js");
  agentPlayer.setReplenishCallback(async () => {
    process.stderr.write("[PLAYER_CALLBACK] 📡 正在预取下一段电台频率...\n");
    await fetchNextRadioSegment();
  });
}
main();
