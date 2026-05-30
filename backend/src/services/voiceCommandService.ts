/**
 * 语音指令服务
 * 处理从小米音响转发的语音指令，执行播放控制
 */

import { EventEmitter } from "node:events";
import { searchTracks, scanMusicLibrary } from "./musicLibraryService.js";
import {
  playUrl,
  stopPlayback,
  playNarrationThenMusic,
  saveTempAudio,
  getAudioBaseUrl,
  getXiaomiConfig,
} from "./xiaomiSpeakerService.js";
import { synthesizeSpeech } from "./ttsService.js";
import type { Track } from "../types.js";

export interface VoiceResponse {
  action: string;
  message: string;
  tts?: string;
  track?: {
    title: string;
    artist: string;
  };
}

// ---- Voice Event Bus (for SSE sync to frontend) ----

export interface VoiceEvent {
  type: "track_changed" | "playback_stopped" | "skip_requested" | "search_result";
  track?: {
    id: string;
    title: string;
    artist: string;
    album?: string;
    previewUrl?: string;
  };
  message?: string;
  timestamp: number;
}

export const voiceEvents = new EventEmitter();

function emit(event: VoiceEvent) {
  voiceEvents.emit("event", event);
}

/** 是否有前端 Radio 页面通过 SSE 连接 */
function hasSSEClients(): boolean {
  return voiceEvents.listenerCount("event") > 0;
}

/**
 * 处理语音指令
 */
export async function handleVoiceCommand(
  action: string,
  query?: string,
  did?: string
): Promise<VoiceResponse> {
  const config = getXiaomiConfig();

  switch (action) {
    case "search_play":
      return handleSearchPlay(query, did, config);

    case "skip":
      return handleSkip(did, config);

    case "stop":
      return handleStop(did, config);

    case "status":
      return { action: "status", message: "ok" };

    default:
      return { action: "unknown", message: `未知指令: ${action}` };
  }
}

async function handleSearchPlay(
  query: string | undefined,
  did: string | undefined,
  config: ReturnType<typeof getXiaomiConfig>
): Promise<VoiceResponse> {
  if (!query || !query.trim()) {
    return { action: "error", message: "未提供搜索关键词" };
  }

  if (!config.enabled) {
    return {
      action: "error",
      message: "小米音响未启用",
      tts: "小米音响未启用，请先在设置中开启",
    };
  }

  const trimmed = query.trim();
  console.log(`[VOICE] 🔍 语音搜索: "${trimmed}"`);

  const results = await searchTracks(trimmed);

  if (results.length === 0) {
    return {
      action: "not_found",
      message: `未找到歌曲: ${trimmed}`,
      tts: `唔好意思，我揾唔到${trimmed}呢首歌`,
    };
  }

  const track = results[0];
  console.log(`[VOICE] ✅ 找到: ${track.title} - ${track.artist}`);

  const musicPath = getLocalPath(track);
  if (!musicPath) {
    return {
      action: "error",
      message: "无法获取音乐文件路径",
      tts: "唔好意思，无法播放呢首歌",
    };
  }

  const ttsText = `好，为你播放${track.artist}嘅${track.title}`;
  let narrationBase64 = "";
  try {
    const ttsResult = await synthesizeSpeech(ttsText, undefined, {
      language: "zh-HK",
    });
    if (ttsResult.audioBase64) {
      narrationBase64 = ttsResult.audioBase64;
    }
  } catch (err) {
    console.warn("[VOICE] ⚠️ TTS 生成失败，直接播放音乐", err);
  }

  const baseUrl = getAudioBaseUrl();
  const encodedPath = Buffer.from(musicPath).toString("base64url");
  const musicUrl = `${baseUrl}/api/library/stream/${encodedPath}`;

  if (narrationBase64) {
    // fire-and-forget：避免死锁（xiaomusic httpget 同步阻塞时不能回调其 API）
    const { fileName } = saveTempAudio(narrationBase64);
    const narrationUrl = `${baseUrl}/api/speaker/temp-audio/${fileName}`;
    setTimeout(() => {
      playNarrationThenMusic(narrationBase64, narrationUrl, musicUrl, did)
        .catch((err) => {
          console.error("[VOICE] ❌ 播放序列失败:", err);
          // 回退：直接播音乐
          playUrl(musicUrl, did).catch(() => {});
        });
    }, 100);

    const voiceTrack = makeVoiceTrack(track);
    emit({
      type: "track_changed",
      track: voiceTrack,
      message: `语音点播: ${track.title}`,
      timestamp: Date.now(),
    });

    return {
      action: "playing",
      message: `正在播放: ${track.title} - ${track.artist}`,
      tts: ttsText,
      track: { title: track.title, artist: track.artist },
    };
  }

  // 无 TTS：fire-and-forget 直接播放
  setTimeout(() => {
    playUrl(musicUrl, did).catch((err) =>
      console.error("[VOICE] ❌ 播放失败:", err)
    );
  }, 100);

  {
    const voiceTrack = makeVoiceTrack(track);
    emit({
      type: "track_changed",
      track: voiceTrack,
      message: `语音点播: ${track.title}`,
      timestamp: Date.now(),
    });
  }

  return {
    action: "playing",
    message: `正在播放: ${track.title} - ${track.artist}`,
    track: { title: track.title, artist: track.artist },
  };
}

async function handleSkip(
  did: string | undefined,
  config: ReturnType<typeof getXiaomiConfig>
): Promise<VoiceResponse> {
  if (!config.enabled) {
    return { action: "error", message: "小米音响未启用" };
  }

  console.log("[VOICE] ⏭️ 语音切歌");

  // 从库中随机选一首（不 await 任何 xiaomusic API，避免死锁）
  const library = await scanMusicLibrary();
  if (library.length > 0) {
    const randomTrack = library[Math.floor(Math.random() * library.length)];
    const musicPath = getLocalPath(randomTrack);
    if (musicPath) {
      const baseUrl = getAudioBaseUrl();
      const encodedPath = Buffer.from(musicPath).toString("base64url");
      const musicUrl = `${baseUrl}/api/library/stream/${encodedPath}`;

      // fire-and-forget：所有 xiaomusic API 调用都在 setTimeout 中执行
      // 因为当前请求来自 xiaomusic 的同步 httpget，如果 await stopPlayback/playUrl
      // 会导致死锁（xiaomusic 事件循环被阻塞，无法处理自身的 API 请求）
      setTimeout(async () => {
        try {
          await stopPlayback(did);
          // 短暂延迟让停止生效
          await new Promise(r => setTimeout(r, 200));
          await playUrl(musicUrl, did);
        } catch (err) {
          console.error("[VOICE] ❌ 切歌播放失败:", err);
        }
      }, 100);

      // 立即发送 SSE 事件通知前端更新 UI
      emit({
        type: "track_changed",
        track: makeVoiceTrack(randomTrack),
        message: "语音指令: 下一首",
        timestamp: Date.now(),
      });

      return {
        action: "skipped",
        message: `切换到: ${randomTrack.title}`,
        track: { title: randomTrack.title, artist: randomTrack.artist },
      };
    }
  }

  emit({
    type: "playback_stopped",
    message: "语音指令: 停止",
    timestamp: Date.now(),
  });

  return { action: "stopped", message: "已停止，无可用曲目" };
}

async function handleStop(
  did: string | undefined,
  config: ReturnType<typeof getXiaomiConfig>
): Promise<VoiceResponse> {
  if (!config.enabled) {
    return { action: "error", message: "小米音响未启用" };
  }

  console.log("[VOICE] ⏹️ 语音停止");

  // fire-and-forget：避免死锁
  setTimeout(() => {
    stopPlayback(did).catch((err) =>
      console.error("[VOICE] ❌ 停止失败:", err)
    );
  }, 100);

  emit({
    type: "playback_stopped",
    message: "语音指令: 停止",
    timestamp: Date.now(),
  });

  return { action: "stopped", message: "播放已停止" };
}

function makeVoiceTrack(track: Track): VoiceEvent["track"] {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album ?? undefined,
    previewUrl: track.previewUrl ?? undefined,
  };
}

function getLocalPath(track: Track): string | null {
  if (!track.previewUrl) return null;
  try {
    if (track.previewUrl.startsWith("/api/library/stream/")) {
      const b64 = track.previewUrl.split("/stream/")[1];
      return Buffer.from(b64, "base64url").toString();
    }
    return track.previewUrl;
  } catch {
    return null;
  }
}
