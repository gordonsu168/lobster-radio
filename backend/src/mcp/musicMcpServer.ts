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
      { name: "enter_chat_mode", description: "【闲聊模式】启动BGM并开启语音对话。此模式下你对用户说的每一句话都必须通过 narrate 工具播报出来。每次/chat都必须调用。", inputSchema: { type: "object", properties: {} } },
      { name: "trigger_radio_broadcast", description: "【电台模式】循环播放完整歌曲。用户每次输入 /stream 时都必须调用此工具，不论当前状态。", inputSchema: { type: "object", properties: {} } },
      { name: "stop_stream", description: "停止所有播放", inputSchema: { type: "object", properties: {} } },
      { name: "get_player_status", description: "获取当前播放状态", inputSchema: { type: "object", properties: {} } },
      { name: "control_player", description: "控制播放器 (next/toggle/clear)", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
      { name: "narrate", description: "【说话】将你的回复转为 DJ 语音通过小米音响播放。闲聊模式下，你的每一条回复都必须先调用此工具播报，再显示文字。这是 DJ-X 的声音灵魂。", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
      { name: "play_file", description: "播放本地音频文件。接受文件路径，可用于播放 ncm-cli 下载到 /tmp 的歌曲。", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
      { name: "play_song", description: "点播歌曲。", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
      { name: "switch_speaker", description: "切换音响输出。action: 'xiaomi' 切到小米音响, 'local' 切回电脑, 不传则查看当前状态。", inputSchema: { type: "object", properties: { action: { type: "string" } } } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    // 所有的工具调用都转发给真正的后端服务
    if (name === "narrate") {
        await httpx.post(`${API_BASE}/chat`, { message: `/narrate ${args?.text}` });
        return { content: [{ type: "text", text: `[OK] 已转发语音播报请求。` }] };
    }

    if (name === "trigger_radio_broadcast") {
        await httpx.post(`${API_BASE}/chat`, { message: "/stream" });
        return { content: [{ type: "text", text: `[OK] 电台指令已下达给主内核。` }] };
    }

    if (name === "play_file") {
        await httpx.post(`${API_BASE}/chat`, { message: `/playfile ${args?.path}` });
        return { content: [{ type: "text", text: `[OK] 文件播放指令已转发。` }] };
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

    if (name === "switch_speaker") {
        const action = args?.action || "";
        if (action === "xiaomi") {
            await httpx.post(`${API_BASE}/chat`, { message: "/speaker xiaomi" });
            return { content: [{ type: "text", text: "[OK] 已切换到小米音响。" }] };
        } else if (action === "local") {
            await httpx.post(`${API_BASE}/chat`, { message: "/speaker local" });
            return { content: [{ type: "text", text: "[OK] 已切换到电脑音响。" }] };
        } else {
            // 查询当前状态
            const res = await httpx.get(`${API_BASE}/status`);
            return { content: [{ type: "text", text: `[STATUS] ${res.data.currentMusic?.title || '空闲'}` }] };
        }
    }

    if (name === "control_player") {
        const action = args?.action || "next";
        if (action === "next") {
            await httpx.post(`${API_BASE}/chat`, { message: "/next" });
        } else if (action === "toggle") {
            await httpx.post(`${API_BASE}/chat`, { message: "/pause" });
        } else if (action === "clear") {
            await httpx.post(`${API_BASE}/chat`, { message: "/clear" });
        }
        return { content: [{ type: "text", text: `[OK] 控制指令已转发。` }] };
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
