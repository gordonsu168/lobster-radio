/**
 * 音箱控制路由 - 管理小米音响播放
 */

import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  updateXiaomiConfig,
  getXiaomiConfig,
  getAudioBaseUrl,
  listDevices,
  getPlaybackStatus,
  getVolume,
  playUrl,
  playTTS,
  stopPlayback,
  setVolume,
  playNarrationThenMusic,
  playNarration,
  checkConnection,
  saveTempAudio,
  cleanTempAudio,
  estimateAudioDuration,
} from "../services/xiaomiSpeakerService.js";
import { getRuntimeSettings, saveRuntimeSettings } from "../services/storageService.js";
import type { RuntimeSettings } from "../types.js";

export const speakerRouter = Router();

// ---- 配置管理 ----

/** 获取小米音响配置（合并 env 和存储配置） */
speakerRouter.get("/xiaomi/config", async (_req, res) => {
  try {
    const settings = await getRuntimeSettings();
    const stored = (settings as any).xiaomiSpeaker || {};
    res.json({
      enabled: process.env.XIAOMI_SPEAKER_ENABLED === "true" || stored.enabled || false,
      apiUrl: process.env.XIAOMI_SPEAKER_API_URL || stored.apiUrl || "http://localhost:8090",
      deviceId: process.env.XIAOMI_SPEAKER_DEVICE_ID || stored.deviceId || "",
      lanHost: process.env.XIAOMI_SPEAKER_LAN_HOST || stored.lanHost || "",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 保存小米音响配置 */
speakerRouter.put("/xiaomi/config", async (req, res) => {
  try {
    const { enabled, apiUrl, deviceId, lanHost } = req.body;
    const settings = await getRuntimeSettings();
    const updated: RuntimeSettings = {
      ...settings,
      xiaomiSpeaker: {
        enabled: !!enabled,
        apiUrl: apiUrl || "http://localhost:8090",
        deviceId: deviceId || "",
        lanHost: lanHost || "",
      },
    } as any;
    await saveRuntimeSettings(updated);
    updateXiaomiConfig({ enabled: !!enabled, apiUrl, deviceId, lanHost });
    res.json({ success: true, config: { enabled: !!enabled, apiUrl, deviceId, lanHost } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 连接测试 ----

/** 测试 xiaomusic 连接 */
speakerRouter.get("/xiaomi/test", async (_req, res) => {
  try {
    const result = await checkConnection();
    res.json(result);
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

// ---- 设备管理 ----

/** 获取小米设备列表 */
speakerRouter.get("/xiaomi/devices", async (_req, res) => {
  try {
    const devices = await listDevices();
    res.json({ devices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 获取设备播放状态 */
speakerRouter.get("/xiaomi/status", async (req, res) => {
  try {
    const did = req.query.did as string | undefined;
    const status = await getPlaybackStatus(did);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 获取设备音量 */
speakerRouter.get("/xiaomi/volume", async (req, res) => {
  try {
    const did = req.query.did as string | undefined;
    const vol = await getVolume(did);
    res.json({ volume: vol });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 播放控制 ----

/** 在小米音响上播放 URL */
speakerRouter.post("/xiaomi/play-url", async (req, res) => {
  try {
    const { url, did } = req.body;
    if (!url) {
      res.status(400).json({ error: "缺少 url 参数" });
      return;
    }
    await playUrl(url, did);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** TTS 到小米音响（使用 xiaomusic 内置 Edge TTS） */
speakerRouter.post("/xiaomi/tts", async (req, res) => {
  try {
    const { text, did } = req.body;
    if (!text) {
      res.status(400).json({ error: "缺少 text 参数" });
      return;
    }
    await playTTS(text, did);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 停止播放 */
speakerRouter.post("/xiaomi/stop", async (req, res) => {
  try {
    const { did } = req.body;
    await stopPlayback(did);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 设置音量 */
speakerRouter.post("/xiaomi/volume", async (req, res) => {
  try {
    const { volume, did } = req.body;
    if (volume === undefined || volume < 0 || volume > 100) {
      res.status(400).json({ error: "音量需在 0-100 之间" });
      return;
    }
    await setVolume(volume, did);
    res.json({ success: true, volume });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 高级播放：旁白 + 音乐序列 ----

/**
 * 播放 "旁白 → 音乐" 序列
 * Body: {
 *   narrationBase64: string,   // TTS 旁白的 base64 MP3
 *   musicUrl: string,           // 音乐文件的可访问 URL
 *   did?: string,               // 设备 ID
 *   host?: string               // 本服务的可访问地址（用于生成旁白 URL）
 * }
 */
speakerRouter.post("/xiaomi/play-sequence", async (req, res) => {
  try {
    const { narrationBase64, musicUrl, did, host } = req.body;
    if (!narrationBase64 || !musicUrl) {
      res.status(400).json({ error: "缺少 narrationBase64 或 musicUrl 参数" });
      return;
    }

    // 保存旁白为临时文件
    const { fileName } = saveTempAudio(narrationBase64);

    // 生成本地可访问的旁白 URL（使用 LAN IP，小米音响需要在局域网内访问）
    const baseHost = host || getAudioBaseUrl();
    const narrationUrl = `${baseHost}/api/speaker/temp-audio/${fileName}`;

    // 播放序列
    await playNarrationThenMusic(narrationBase64, narrationUrl, musicUrl, did);

    res.json({
      success: true,
      narrationUrl,
      musicUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 仅播放旁白（返回时长供前端计算）
 */
speakerRouter.post("/xiaomi/play-narration", async (req, res) => {
  try {
    const { base64Audio, did, host } = req.body;
    if (!base64Audio) {
      res.status(400).json({ error: "缺少 base64Audio 参数" });
      return;
    }

    const { fileName } = saveTempAudio(base64Audio);
    const baseHost = host || getAudioBaseUrl();
    const audioUrl = `${baseHost}/api/speaker/temp-audio/${fileName}`;

    const duration = await playNarration(base64Audio, audioUrl, did);

    res.json({ success: true, audioUrl, duration });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 临时音频文件服务 ----

/**
 * 提供临时音频文件访问
 * GET /api/speaker/temp-audio/:fileName
 */
speakerRouter.get("/temp-audio/:fileName", (req, res) => {
  const { fileName } = req.params;
  // 安全检查：防止路径穿越
  if (fileName.includes("..") || fileName.includes("/")) {
    res.status(403).json({ error: "非法文件名" });
    return;
  }

  const tempDir = path.join(os.tmpdir(), "lobster-radio-xiaomi");
  const filePath = path.join(tempDir, fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "音频文件不存在或已过期" });
    return;
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-cache");
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  // 发送完成后清理旧文件
  cleanTempAudio(30 * 60 * 1000); // 清理 30 分钟前的文件
});

// ---- 清理 ----

/** 手动清理临时文件 */
speakerRouter.post("/xiaomi/clean-temp", (_req, res) => {
  const cleaned = cleanTempAudio(0); // 立即清理所有
  res.json({ success: true, cleaned });
});
