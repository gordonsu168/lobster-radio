/**
 * 语音指令路由
 * 接收从小米音响转发的语音指令
 */

import { Router } from "express";
import { handleVoiceCommand, voiceEvents, type VoiceEvent } from "../services/voiceCommandService.js";
import { getXiaomiConfig } from "../services/xiaomiSpeakerService.js";

export const voiceRouter = Router();

/**
 * 语音指令入口
 * GET /api/voice/command?action=search_play&query=晴天&did=xxx
 * GET /api/voice/command?action=skip
 * GET /api/voice/command?action=stop
 */
voiceRouter.get("/command", async (req, res) => {
  try {
    const action = (req.query.action as string) || "unknown";
    const query = req.query.query as string | undefined;
    const did = req.query.did as string | undefined;

    const result = await handleVoiceCommand(action, query, did);
    res.json(result);
  } catch (err: any) {
    console.error("[VOICE] ❌ 指令处理失败:", err);
    res.status(500).json({
      action: "error",
      message: err.message || "指令处理失败",
    });
  }
});

/**
 * 语音事件流 (SSE)
 * 当语音指令改变播放状态时，实时推送到前端 Radio 页面
 *
 * GET /api/voice/events
 */
voiceRouter.get("/events", (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx 禁用缓冲

  // 发送初始连接确认
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

  // 事件处理函数
  const onEvent = (event: VoiceEvent) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // 客户端已断开
      cleanup();
    }
  };

  // 心跳：每 30 秒发送 keepalive，防止代理超时断开
  const heartbeat = setInterval(() => {
    try {
      res.write(`:keepalive\n\n`);
    } catch {
      cleanup();
    }
  }, 30000);

  function cleanup() {
    clearInterval(heartbeat);
    voiceEvents.off("event", onEvent);
    try { res.end(); } catch {}
  }

  // 订阅事件
  voiceEvents.on("event", onEvent);

  // 客户端断开时清理
  req.on("close", cleanup);
});

/**
 * 语音服务状态
 * GET /api/voice/status
 */
voiceRouter.get("/status", (_req, res) => {
  try {
    const config = getXiaomiConfig();
    res.json({
      ok: true,
      xiaomiEnabled: config.enabled,
      deviceId: config.deviceId || null,
      apiUrl: config.apiUrl,
    });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});
