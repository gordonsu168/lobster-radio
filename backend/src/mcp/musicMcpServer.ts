import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import httpx from "axios"; // 使用 axios 方便请求

const API_BASE = "http://localhost:4000/api/agent/x";

const server = new Server({ name: "lobster-music-proxy", version: "1.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
    // 所有的工具调用都转发给真正的后端服务
    if (name === "narrate") {
        await httpx.post(`${API_BASE}/chat`, { message: args?.text });
        return { content: [{ type: "text", text: `[OK] 已转发语音播报请求。` }] };
    }

    if (name === "trigger_radio_broadcast") {
        await httpx.post(`${API_BASE}/chat`, { message: "/stream" });
        return { content: [{ type: "text", text: `[OK] 电台指令已下达给主内核。` }] };
    }

    if (name === "play_song") {
        await httpx.post(`${API_BASE}/chat`, { message: `/play ${args?.query}` });
        return { content: [{ type: "text", text: `[OK] 点播指令已转发。` }] };
    }

    if (name === "get_player_status") {
        const res = await httpx.get(`${API_BASE}/status`);
        const status = res.data;
        return { content: [{ type: "text", text: `[STATUS] ${status.currentMusic?.title || '空闲'}` }] };
    }

    if (name === "enter_chat_mode") {
        await httpx.post(`${API_BASE}/chat`, { message: "/chat" });
        return { content: [{ type: "text", text: `[OK] 闲聊模式请求已发送。` }] };
    }

    if (name === "stop_stream") {
        await httpx.post(`${API_BASE}/chat`, { message: "/clear" });
        return { content: [{ type: "text", text: "[OK] 信号已切断。" }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return { content: [{ type: "text", text: `Proxy Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();
