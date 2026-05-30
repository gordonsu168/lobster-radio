/**
 * 小米音响服务 - 通过 xiaomusic API 控制小米智能音箱
 *
 * 前置条件：需要 xiaomusic 在局域网内运行（默认端口 8090）
 *   docker run -d --name xiaomusic \
 *     -e MI_USER=your_xiaomi_account \
 *     -e MI_PASS=your_password \
 *     -p 8090:8090 \
 *     -v /path/to/music:/app/music \
 *     hanxi/xiaomusic
 *
 * 或本地运行：cd xiaomusic && pdm run xiaomusic.py
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { networkInterfaces } from "node:os";
import { execSync } from "node:child_process";

// ---- Types ----

export interface XiaomiSpeakerConfig {
  enabled: boolean;
  /** xiaomusic HTTP API 地址，例如 http://192.168.1.5:8090 */
  apiUrl: string;
  /** 小米音响设备 DID（miotDID，纯数字格式） */
  deviceId: string;
  /** 本机局域网地址（用于生成音响可访问的音频 URL） */
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
  apiUrl: "http://localhost:8090",
  deviceId: "",
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

async function xiaomiGet<T = any>(endpoint: string): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xiaomusic GET ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function xiaomiPost<T = any>(endpoint: string, body?: any): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xiaomusic POST ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Device API ----

/** 获取小米账户下的所有设备列表 */
export async function listDevices(): Promise<XiaomiDevice[]> {
  if (!config.enabled) throw new Error("小米音响未启用");
  const data = await xiaomiGet<any>("/device_list");
  // xiaomusic returns { data: [...] }
  const raw = Array.isArray(data) ? data : data?.devices ?? data?.data ?? [];
  return raw.map((d: any) => ({
    name: d.name || d.alias || d.deviceName || "未知设备",
    did: d.miotDID || d.did || d.deviceID || "",
    hardware: d.hardware || d.model || "",
    miotDID: d.miotDID || d.did || "",
  }));
}

/** 获取设备播放状态 */
export async function getPlaybackStatus(did?: string): Promise<PlaybackStatus> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  try {
    const data = await xiaomiGet<any>(`/getplayerstatus?did=${encodeURIComponent(deviceId)}`);
    return {
      isPlaying: data?.playing ?? data?.is_playing ?? false,
      volume: data?.volume ?? 50,
      currentTitle: data?.title ?? data?.current_title,
    };
  } catch {
    return { isPlaying: false, volume: 50 };
  }
}

/** 获取设备音量 */
export async function getVolume(did?: string): Promise<number> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  const data = await xiaomiGet<any>(`/getvolume?did=${encodeURIComponent(deviceId)}`);
  return data?.volume ?? data?.data?.volume ?? 50;
}

// ---- URL Proxy ----

/**
 * 将 URL 包装为 xiaomusic 代理 URL
 * 小米音响只能直接访问 xiaomusic 的端口，无法访问 lobster-radio 的端口
 * 通过 xiaomusic 的 /proxy/ 端点中转音频流
 *
 * 关键：代理 URL 必须使用局域网 IP，因为小米音响无法解析 localhost
 */
function wrapProxyUrl(originalUrl: string): string {
  const urlB64 = Buffer.from(originalUrl).toString("base64");

  // 从 apiUrl 中提取端口，但 host 替换为局域网 IP
  let proxyHost = config.apiUrl;
  try {
    const apiUrlObj = new URL(config.apiUrl);
    const lanIp = config.lanHost || detectLanIp();
    if (apiUrlObj.hostname === "localhost" || apiUrlObj.hostname === "127.0.0.1") {
      proxyHost = `${apiUrlObj.protocol}//${lanIp}:${apiUrlObj.port}`;
    }
  } catch {
    // 如果 URL 解析失败，回退到原始值
  }

  return `${proxyHost}/proxy/music?urlb64=${encodeURIComponent(urlB64)}`;
}

// ---- Playback Control ----

/**
 * 在小米音响上播放一个音频 URL
 * 自动通过 xiaomusic 代理，确保音响可以访问
 * @param url 音频文件 URL
 * @param did 设备 ID，不传则用配置的默认设备
 */
export async function playUrl(url: string, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  if (!config.enabled) throw new Error("小米音响未启用");

  // 通过 xiaomusic 代理，小米音响只能访问 xiaomusic 的端口
  const proxyUrl = wrapProxyUrl(url);
  console.log(`[XIAOMI] ▶️ 播放: ${url.slice(0, 80)}... → 代理 → 设备: ${deviceId}`);
  await xiaomiGet(`/playurl?did=${encodeURIComponent(deviceId)}&url=${encodeURIComponent(proxyUrl)}`);
}

/**
 * 在小米音响上播放 TTS 文本
 * 直接使用 xiaomusic 内置的 Edge TTS
 */
export async function playTTS(text: string, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  if (!config.enabled) throw new Error("小米音响未启用");

  console.log(`[XIAOMI] 🎙️ TTS: ${text.slice(0, 50)}... → 设备: ${deviceId}`);
  await xiaomiGet(`/playtts?did=${encodeURIComponent(deviceId)}&text=${encodeURIComponent(text)}`);
}

/**
 * 停止播放
 */
export async function stopPlayback(did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  await xiaomiPost("/device/stop", { did: deviceId });
  console.log(`[XIAOMI] ⏹️ 停止: ${deviceId}`);
}

/**
 * 设置音量
 * @param volume 0-100
 */
export async function setVolume(volume: number, did?: string): Promise<void> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  await xiaomiPost("/setvolume", { did: deviceId, volume });
  console.log(`[XIAOMI] 🔊 音量: ${volume}%`);
}

// ---- Audio Temp File Management ----

const tempDir = path.join(os.tmpdir(), "lobster-radio-xiaomi");

/** 确保临时目录存在 */
function ensureTempDir(): string {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * 将 base64 MP3 保存为临时文件并返回文件路径
 * 自动转换为小米音响兼容的音频格式（44100Hz, 128kbps 立体声）
 * @returns { filePath, fileName }
 */
export function saveTempAudio(base64Data: string): { filePath: string; fileName: string } {
  ensureTempDir();
  const rawFileName = `dj_raw_${Date.now()}.mp3`;
  const rawPath = path.join(tempDir, rawFileName);
  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(rawPath, buffer);

  // 转换为小米音响兼容格式
  const finalFileName = `dj_narration_${Date.now()}.mp3`;
  const finalPath = path.join(tempDir, finalFileName);
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
  if (!fs.existsSync(tempDir)) return 0;
  const now = Date.now();
  let cleaned = 0;
  const files = fs.readdirSync(tempDir);
  for (const file of files) {
    const filePath = path.join(tempDir, file);
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
 * 优先使用 ffprobe，失败则按文件大小估算
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
 * 播放完整的"旁白 → 音乐"序列
 *
 * 1. 将 base64 TTS 音频保存为临时文件
 * 2. 通过 xiaomusic 在小米音响上播放旁白 URL
 * 3. 等待旁白播完后，自动播放音乐 URL
 *
 * @param narrationBase64 TTS 旁白 base64 MP3
 * @param musicUrl 音乐文件的可访问 URL
 * @param narrationAudioUrl 旁白音频的 HTTP 访问 URL（由调用方提供，如 http://host:4000/api/speaker/temp-audio/fileName）
 * @param did 设备 ID
 */
export async function playNarrationThenMusic(
  narrationBase64: string,
  narrationAudioUrl: string,
  musicUrl: string,
  did?: string
): Promise<void> {
  const deviceId = did || config.deviceId;
  if (!deviceId) throw new Error("未指定小米设备");
  if (!config.enabled) throw new Error("小米音响未启用");

  // 保存旁白为临时文件并估算时长
  const { filePath } = saveTempAudio(narrationBase64);
  const duration = estimateAudioDuration(filePath);

  console.log(
    `[XIAOMI] 🎬 播放序列: 旁白(${duration.toFixed(1)}s) → 音乐`
  );

  // 播放旁白
  await playUrl(narrationAudioUrl, deviceId);

  // 等待旁白播完后播放音乐
  // 额外加 0.5 秒缓冲
  const waitMs = Math.max(1000, (duration + 0.5) * 1000);
  setTimeout(() => {
    playUrl(musicUrl, deviceId).catch((err) =>
      console.error("[XIAOMI] ❌ 音乐播放失败:", err)
    );
  }, waitMs);
}

/**
 * 仅播放旁白（base64 MP3）到小米音响
 * 返回旁白时长（秒），调用方可自行处理后续逻辑
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
 * 测试与 xiaomusic 服务的连接
 */
export async function checkConnection(): Promise<{ ok: boolean; error?: string; version?: string }> {
  if (!config.enabled) {
    return { ok: false, error: "小米音响未启用" };
  }
  try {
    const data = await xiaomiGet<any>("/getversion");
    return { ok: true, version: data?.version ?? data?.data?.version ?? "unknown" };
  } catch (err: any) {
    return { ok: false, error: err.message || "无法连接到 xiaomusic" };
  }
}
