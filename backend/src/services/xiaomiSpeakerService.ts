/**
 * 小米音响服务 - 通过 Songloft MIoT 插件控制小米智能音箱
 *
 * 前置条件：Songloft 需要在局域网内运行，并安装 MIoT JS 插件
 *   git clone https://github.com/songloft-org/songloft.git
 *   cd songloft && make build-lite
 *   ./songloft -port 58091
 *   然后通过 Web UI 或 API 安装 MIoT 插件，配置小米账号
 *
 * Songloft MIoT 插件 API:
 *   POST /api/v1/jsplugin/miot/accounts              - 创建小米账号
 *   GET  /api/v1/jsplugin/miot/mina/devices          - 获取设备列表
 *   POST /api/v1/jsplugin/miot/mina/play-url         - 播放 URL
 *   POST /api/v1/jsplugin/miot/mina/volume           - 设置音量
 *   GET  /api/v1/jsplugin/miot/player/status         - 播放状态
 *   POST /api/v1/jsplugin/miot/player/stop           - 停止播放
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { networkInterfaces } from "node:os";
import { execSync } from "node:child_process";

// ---- Types ----

export interface XiaomiSpeakerConfig {
  enabled: boolean;
  /** Songloft HTTP API 地址（默认 58091） */
  apiUrl: string;
  /** 小米音响设备 DID */
  deviceId: string;
  /** 小米账号 ID (MIoT 插件内创建账号后获得) */
  accountId?: string;
  /** Songloft JWT Token (登录 /api/v1/auth/login 获取) */
  jwtToken?: string;
  /** 本机局域网地址 */
  lanHost: string;
}

export interface XiaomiDevice {
  name: string;
  did: string;
  hardware: string;
  miotDID?: string;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  volume: number;
  currentTitle?: string;
}

// ---- Config ----

let config: XiaomiSpeakerConfig = {
  enabled: false,
  apiUrl: "http://localhost:58091",
  deviceId: "",
  accountId: "",
  jwtToken: "",
  lanHost: "",
};

/** 自动检测本机局域网 IP */
function detectLanIp(): string {
  try {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // 跳过内部/回环，只取 IPv4
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
}

export function updateXiaomiConfig(partial: Partial<XiaomiSpeakerConfig>) {
  config = { ...config, ...partial };
  // 自动检测 LAN IP（如果未指定）
  if (!config.lanHost) {
    config.lanHost = detectLanIp();
  }
}

export function getXiaomiConfig(): XiaomiSpeakerConfig {
  return { ...config };
}

/** 获取本机音频服务的可访问 base URL（优先 LAN IP） */
export function getAudioBaseUrl(port?: number): string {
  const p = port || parseInt(process.env.PORT || "4000", 10);
  const host = config.lanHost || detectLanIp();
  return `http://${host}:${p}`;
}

// ---- HTTP helpers ----

const PLUGIN_PREFIX = "/api/v1/jsplugin/miot";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.jwtToken) {
    headers["Authorization"] = `Bearer ${config.jwtToken}`;
  }
  return headers;
}

async function miotGet<T = any>(endpoint: string): Promise<T> {
  const url = `${config.apiUrl}${PLUGIN_PREFIX}${endpoint}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MIoT GET ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function miotPost<T = any>(endpoint: string, body?: any): Promise<T> {
  const url = `${config.apiUrl}${PLUGIN_PREFIX}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MIoT POST ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Device API ----

/** MIoT API 响应包装 */
interface MiotResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 获取小米账户下的所有设备列表
 */
export async function listDevices(): Promise<XiaomiDevice[]> {
  if (!config.enabled) throw new Error("小米音响未启用");

  const data = await miotGet<MiotResponse<Array<{
    account_id: string;
    account_name?: string;
    devices: Array<{
      name?: string;
      alias?: string;
      device_id?: string;
      miotDID?: string;
      hardware?: string;
      model?: string;
      presence?: string;
    }>;
  }>>>("/mina/devices");

  if (!data.success) {
    throw new Error(data.error || "获取设备列表失败");
  }

  const accounts = data.data || [];
  const allDevices: XiaomiDevice[] = [];
  for (const acct of accounts) {
    for (const d of acct.devices || []) {
      allDevices.push({
        name: d.alias || d.name || "未知设备",
        did: d.device_id || d.miotDID || "",
        hardware: d.hardware || d.model || "",
        miotDID: d.miotDID || d.device_id || "",
      });
    }
  }
  return allDevices;
}

/**
 * 获取设备播放状态
 */
export async function getPlaybackStatus(did?: string): Promise<PlaybackStatus> {
  const deviceId = did || config.deviceId;
  const accountId = config.accountId;
  if (!deviceId || !accountId) throw new Error("未指定小米设备或账号");

  try {
    const data = await miotGet<MiotResponse<{
      playing?: boolean;
      volume?: number;
      title?: string;
      current_title?: string;
    }>>(`/player/status?account_id=${accountId}&device_id=${encodeURIComponent(deviceId)}`);

    if (!data.success) {
      throw new Error(data.error || "获取播放状态失败");
    }

    const status = data.data || {};
    return {
      isPlaying: status.playing ?? false,
      volume: status.volume ?? 50,
      currentTitle: status.title || status.current_title,
    };
  } catch {
    return { isPlaying: false, volume: 50 };
  }
}

/**
 * 获取设备音量
 */
export async function getVolume(did?: string): Promise<number> {
  const status = await getPlaybackStatus(did);
  return status.volume;
}

// ---- Playback Control ----

/**
 * 在小米音响上播放一个音频 URL
 * Songloft 在局域网内可直接访问音频 URL，无需代理包装
 */
export async function playUrl(url: string, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  const accountId = config.accountId;
  if (!deviceId || !accountId) throw new Error("未指定小米设备或账号");
  if (!config.enabled) throw new Error("小米音响未启用");

  console.log(`[XIAOMI] ▶️ 播放: ${url.slice(0, 80)}... → 设备: ${deviceId}`);
  const data = await miotPost<MiotResponse<{ message: string }>>("/mina/play-url", {
    account_id: accountId,
    device_id: deviceId,
    url,
  });

  if (!data.success) {
    throw new Error(data.error || "播放失败");
  }
}

/**
 * 在小米音响上播放 TTS 文本
 */
export async function playTTS(text: string, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  const accountId = config.accountId;
  if (!deviceId || !accountId) throw new Error("未指定小米设备或账号");
  if (!config.enabled) throw new Error("小米音响未启用");

  console.log(`[XIAOMI] 🎙️ TTS: ${text.slice(0, 50)}... → 设备: ${deviceId}`);

  // MIoT 插件通过 play-url 点播 TTS 音频 URL
  // 这里走 lobster-radio 自身的 TTS → 音频 URL 流程，由上层调用 playUrl
  throw new Error("MIoT 插件不支持直接 play-tts，请使用 lobster-radio 内置 TTS 生成音频 URL 后调用 playUrl");
}

/**
 * 停止播放
 */
export async function stopPlayback(did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  const accountId = config.accountId;
  if (!deviceId || !accountId) throw new Error("未指定小米设备或账号");

  const data = await miotPost<MiotResponse<any>>("/player/stop", {
    account_id: accountId,
    device_id: deviceId,
  });

  if (!data.success) {
    throw new Error(data.error || "停止播放失败");
  }
  console.log(`[XIAOMI] ⏹️ 停止: ${deviceId}`);
}

/**
 * 设置音量
 */
export async function setVolume(volume: number, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  const accountId = config.accountId;
  if (!deviceId || !accountId) throw new Error("未指定小米设备或账号");

  const data = await miotPost<MiotResponse<any>>("/mina/volume", {
    account_id: accountId,
    device_id: deviceId,
    volume,
  });

  if (!data.success) {
    throw new Error(data.error || "设置音量失败");
  }
  console.log(`[XIAOMI] 🔊 音量: ${volume}%`);
}

// ---- Audio Temp File Management ----

/** 固定临时目录，不受 TMPDIR 环境变量影响 */
const TEMP_AUDIO_DIR = "/tmp/lobster-radio-xiaomi";

/** 确保临时目录存在 */
function ensureTempDir(): string {
  if (!fs.existsSync(TEMP_AUDIO_DIR)) {
    fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
  }
  return TEMP_AUDIO_DIR;
}

/**
 * 将 base64 MP3 保存为临时文件并返回文件路径
 * 自动转换为小米音响兼容的音频格式（44100Hz, 128kbps 立体声）
 * @returns { filePath, fileName }
 */
export function saveTempAudio(base64Data: string): { filePath: string; fileName: string } {
  ensureTempDir();
  const rawFileName = `dj_raw_${Date.now()}.mp3`;
  const rawPath = path.join(TEMP_AUDIO_DIR, rawFileName);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(rawPath, buffer);

  // 转换为小米音响兼容格式
  const finalFileName = `dj_narration_${Date.now()}.mp3`;
  const finalPath = path.join(TEMP_AUDIO_DIR, finalFileName);
  try {
    execSync(
      `ffmpeg -y -i "${rawPath}" -ar 44100 -b:a 128k -ac 2 "${finalPath}" 2>/dev/null`,
      { timeout: 10000 }
    );
    // 删除原始文件
    try { fs.unlinkSync(rawPath); } catch {}
    console.log(`[XIAOMI] 💾 临时音频（已转换）: ${finalPath}`);
  } catch {
    // ffmpeg 不可用时，直接使用原始文件
    console.warn("[XIAOMI] ⚠️ ffmpeg 不可用，使用原始音频格式");
    try { fs.unlinkSync(finalPath); } catch {}
    fs.renameSync(rawPath, finalPath);
    console.log(`[XIAOMI] 💾 临时音频（原始）: ${finalPath} (${buffer.length} bytes)`);
  }

  return { filePath: finalPath, fileName: finalFileName };
}

/**
 * 清理超过 maxAgeMs 的临时音频文件
 */
export function cleanTempAudio(maxAgeMs = 30 * 60 * 1000): number {
  if (!fs.existsSync(TEMP_AUDIO_DIR)) return 0;
  const now = Date.now();
  let cleaned = 0;
  const files = fs.readdirSync(TEMP_AUDIO_DIR);
  for (const file of files) {
    const filePath = path.join(TEMP_AUDIO_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // 忽略删除失败
    }
  }
  if (cleaned > 0) {
    console.log(`[XIAOMI] 🧹 清理了 ${cleaned} 个临时音频文件`);
  }
  return cleaned;
}

/**
 * 估算 MP3 文件的播放时长（秒）
 */
export function estimateAudioDuration(filePath: string): number {
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf8", timeout: 5000 }
    );
    const duration = parseFloat(output.trim());
    if (!isNaN(duration) && duration > 0) return duration;
  } catch {
    // ffprobe 不可用，按 MP3 比特率估算
  }
  // 按 128kbps 估算
  try {
    const stat = fs.statSync(filePath);
    return (stat.size * 8) / (128 * 1000);
  } catch {
    return 5; // 默认 5 秒
  }
}

// ---- High-level API: 旁白 + 音乐播放序列 ----

/**
 * 估算音乐 URL 对应的本地文件时长（秒）
 */
export function estimateMusicDuration(url: string): number {
  try {
    const match = url.match(/\/api\/library\/stream\/(.+?)(?:\?|$)/);
    if (match) {
      const localPath = Buffer.from(match[1], "base64url").toString();
      return estimateAudioDuration(localPath);
    }
  } catch {
    // fall through
  }
  return 210; // 默认 3.5 分钟
}

/**
 * 播放完整的"旁白 → 音乐"序列
 */
export async function playNarrationThenMusic(
  narrationBase64: string,
  narrationAudioUrl: string,
  musicUrl: string,
  did?: string
): Promise<{ narrationDuration: number; musicDuration: number }> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  if (!config.enabled) throw new Error("小米音响未启用");

  const { filePath } = saveTempAudio(narrationBase64);
  const narrationDuration = estimateAudioDuration(filePath);
  const musicDuration = estimateMusicDuration(musicUrl);

  console.log(
    `[XIAOMI] 🎬 播放序列: 旁白(${narrationDuration.toFixed(1)}s) → 音乐(${musicDuration.toFixed(1)}s)`
  );

  // 播放旁白
  await playUrl(narrationAudioUrl, deviceId);

  // 等待旁白播完后播放音乐
  const waitMs = Math.max(1000, (narrationDuration + 0.5) * 1000);
  setTimeout(() => {
    playUrl(musicUrl, deviceId).catch((err) =>
      console.error("[XIAOMI] ❌ 音乐播放失败:", err)
    );
  }, waitMs);

  return { narrationDuration, musicDuration };
}

/**
 * 仅播放旁白到小米音响，返回旁白时长（秒）
 */
export async function playNarration(
  base64Audio: string,
  audioUrl: string,
  did?: string
): Promise<number> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  if (!config.enabled) throw new Error("小米音响未启用");

  const { filePath } = saveTempAudio(base64Audio);
  const duration = estimateAudioDuration(filePath);

  await playUrl(audioUrl, deviceId);
  console.log(`[XIAOMI] 🎙️ 旁白播放中（约 ${duration.toFixed(1)}s）`);
  return duration;
}

// ---- Connectivity Check ----

/**
 * 测试与 Songloft 服务的连接
 */
export async function checkConnection(): Promise<{ ok: boolean; error?: string; version?: string }> {
  if (!config.enabled) {
    return { ok: false, error: "小米音响未启用" };
  }
  try {
    const headers: Record<string, string> = {};
    if (config.jwtToken) {
      headers["Authorization"] = `Bearer ${config.jwtToken}`;
    }
    const res = await fetch(`${config.apiUrl}/api/v1/version`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, version: data?.version || "unknown" };
  } catch (err: any) {
    return { ok: false, error: err.message || "无法连接到 Songloft" };
  }
}
