import { spawn, ChildProcess, spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  getXiaomiConfig,
  getAudioBaseUrl,
  playUrl as xiaomiPlayUrl,
  playNarrationThenMusic,
  estimateAudioDuration,
  saveTempAudio,
} from "./xiaomiSpeakerService.js";

export interface AudioItem {
    title: string;
    path: string;
    trackId?: string;
}

export interface PlayerState {
  currentMusic: AudioItem | null;
  currentVoice: AudioItem | null;
  musicQueueCount: number;
  isPaused: boolean;
  lastActivity: string;
}

type QueueLowCallback = () => Promise<void>;

/** 小米音响模式下，音乐播放完毕后自动调度下一首 */
const XIAOMI_MUSIC_TIMEOUT_MS = 60_000;

class AgentPlayerService {
  // --- 双队列设计 ---
  private musicQueue: AudioItem[] = [];
  private voiceQueue: AudioItem[] = [];

  private musicProcess: ChildProcess | null = null;
  private voiceProcess: ChildProcess | null = null;
  private xiaomiMusicTimer: ReturnType<typeof setTimeout> | null = null;

  private activeMusic: AudioItem | null = null;
  private activeVoice: AudioItem | null = null;

  private isBgmMode: boolean = false;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;
  private lastActivity: string = "STANDBY";
  private lastVoiceTitle: string = "";

  /** 是否将音频推送到小米音响（而非本机 afplay） */
  private get useXiaomi(): boolean {
    try {
      const cfg = getXiaomiConfig();
      return !!(cfg.enabled && cfg.deviceId && cfg.accountId && cfg.jwtToken);
    } catch {
      return false;
    }
  }

  /** 将本地文件路径转为小米音响可访问的 HTTP URL */
  private fileToUrl(filePath: string): string {
    const baseUrl = getAudioBaseUrl();
    const encoded = Buffer.from(filePath).toString("base64url");
    return `${baseUrl}/api/library/stream/${encoded}`;
  }

  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  // --- 旁白轨道控制 ---

  addVoice(filePath: string, title: string) {
    if (title === this.lastVoiceTitle) {
      console.error(`[PLAYER] ⚠️ SKIP_DUPLICATE_VOICE: ${title}`);
      return;
    }
    this.lastVoiceTitle = title;
    setTimeout(() => { if(this.lastVoiceTitle === title) this.lastVoiceTitle = ""; }, 5000);

    this.voiceQueue.push({ path: filePath, title });
    console.error(`[PLAYER] 🎙️ VOICE_ADDED: ${title}`);

    // 如果是闲聊模式且旁白没在播，立即启动
    if (this.isBgmMode && !this.voiceProcess && !this.useXiaomi) {
        this.playNextVoice();
    }
    // 小米模式下也触发
    if (this.isBgmMode && this.useXiaomi) {
        this.playNextVoice();
    }
  }

  private playNextVoice() {
    if (this.voiceQueue.length === 0) return;
    const item = this.voiceQueue.shift()!;
    this.executeVoice(item);
  }

  /** 不受 TMPDIR 环境变量影响的固定临时目录 */
  private static TEMP_DIR = "/tmp/lobster-radio-xiaomi";

  /** 将任意本地文件转为小米音响可访问的 HTTP URL。
   *  音乐库内的文件走 library stream，否则复制到 temp-audio 目录。 */
  private localFileToUrl(filePath: string): string {
    const baseUrl = getAudioBaseUrl();
    if (!fs.existsSync(AgentPlayerService.TEMP_DIR)) {
      fs.mkdirSync(AgentPlayerService.TEMP_DIR, { recursive: true });
    }
    const ext = path.extname(filePath) || ".mp3";
    const destName = `audio_${Date.now()}${ext}`;
    const destPath = path.join(AgentPlayerService.TEMP_DIR, destName);
    fs.copyFileSync(filePath, destPath);
    return `${baseUrl}/api/speaker/temp-audio/${destName}`;
  }

  /** 将旁白文件复制到 temp 目录，返回可访问的 HTTP URL */
  private voiceFileToUrl(filePath: string): string {
    const baseUrl = getAudioBaseUrl();
    if (!fs.existsSync(AgentPlayerService.TEMP_DIR)) {
      fs.mkdirSync(AgentPlayerService.TEMP_DIR, { recursive: true });
    }
    const ext = path.extname(filePath) || ".mp3";
    const destName = `voice_${Date.now()}${ext}`;
    const destPath = path.join(AgentPlayerService.TEMP_DIR, destName);
    fs.copyFileSync(filePath, destPath);
    return `${baseUrl}/api/speaker/temp-audio/${destName}`;
  }

  private async executeVoice(item: AudioItem) {
    if (this.useXiaomi) {
      // --- 小米音响模式 ---
      try {
        const voiceUrl = this.voiceFileToUrl(item.path);
        const duration = estimateAudioDuration(item.path);
        console.error(`[PLAYER] 🎙️ XIAOMI_NARRATING: ${item.title} (${duration.toFixed(1)}s)`);
        this.activeVoice = item;
        await xiaomiPlayUrl(voiceUrl);
        // 等待旁白播完
        setTimeout(() => {
          this.activeVoice = null;
          if (this.isBgmMode) {
            this.playNextVoice();
          } else {
            this.resumeMusicAfterVoice();
          }
        }, Math.max(2000, (duration + 0.5) * 1000));
      } catch (err) {
        console.error("[PLAYER] ❌ Xiaomi 旁白失败:", err);
        this.activeVoice = null;
        // 回退到本地播放
        this.executeVoiceLocal(item);
      }
      return;
    }

    this.executeVoiceLocal(item);
  }

  private executeVoiceLocal(item: AudioItem) {
    if (this.voiceProcess) {
        this.voiceProcess.removeAllListeners("exit");
        this.voiceProcess.kill("SIGKILL");
    }

    this.activeVoice = item;
    console.error(`[PLAYER] 🎙️ NARRATING: ${item.title}`);
    const proc = spawn("afplay", ["-v", "1.2", item.path]);
    this.voiceProcess = proc;

    proc.on("exit", () => {
        if (this.voiceProcess !== proc) return;
        this.voiceProcess = null;
        this.activeVoice = null;
        if (this.isBgmMode) {
            this.playNextVoice();
        } else {
            this.resumeMusicAfterVoice();
        }
    });
  }

  // --- 音乐轨道控制 ---

  playBGM(path: string, title: string) {
      this.clear();
      this.isBgmMode = true;
      this.addMusic(path, title);
  }

  addMusic(path: string, title: string, trackId?: string) {
      if (this.activeMusic?.path === path && !this.isBgmMode) return;

      this.musicQueue.push({ path, title, trackId });
      console.error(`[PLAYER] 🎵 MUSIC_ADDED: ${title}`);
      if (!this.musicProcess && !this.activeVoice && !this.xiaomiMusicTimer) {
          this.playNextMusic();
      }
  }

  private playNextMusic() {
      if (this.musicQueue.length === 0) {
          if (this.onQueueLow && !this.isReplenishing) {
              this.isReplenishing = true;
              console.error("[PLAYER] 🪹 QUEUE_LOW: Triggering replenish...");
              this.onQueueLow().finally(() => {
                  setTimeout(() => { this.isReplenishing = false; }, 5000);
              });
          }
          return;
      }

      const item = this.musicQueue.shift()!;
      this.executeMusic(item);
  }

  private async executeMusic(item: AudioItem) {
    // 逻辑：如果是电台模式且有待播旁白，先播旁白再播歌
    if (!this.isBgmMode && this.voiceQueue.length > 0) {
        this.activeMusic = { ...item, title: `[READY] ${item.title}` };
        this.musicQueue.unshift(item);
        this.playNextVoice();
        return;
    }

    if (this.useXiaomi) {
      // --- 小米音响模式 ---
      try {
        const musicUrl = this.localFileToUrl(item.path);
        // 估算歌曲时长，到时间自动切下一首
        const duration = estimateAudioDuration(item.path);
        console.error(`[PLAYER] ▶️ XIAOMI_MUSIC: ${item.title} (${duration.toFixed(1)}s)`);
        this.activeMusic = item;
        await xiaomiPlayUrl(musicUrl);

        // 小米音响是 fire-and-forget 模式，按估算时长设定时器
        const timeoutMs = duration > 0 ? Math.max(5000, (duration + 1) * 1000) : 210_000;
        this.xiaomiMusicTimer = setTimeout(() => {
          this.xiaomiMusicTimer = null;
          if (this.activeMusic === item) {
            this.activeMusic = null;
          }
          if (!this.isPaused) {
            if (this.isBgmMode && this.musicQueue.length === 0) {
              this.addMusic(item.path, item.title);
            }
            setTimeout(() => this.playNextMusic(), 500);
          }
        }, timeoutMs);
      } catch (err) {
        console.error("[PLAYER] ❌ Xiaomi 播放失败，回退到本地:", err);
        this.executeMusicLocal(item);
      }
      return;
    }

    this.executeMusicLocal(item);
  }

  private executeMusicLocal(item: AudioItem) {
    if (this.musicProcess) {
        this.musicProcess.removeAllListeners("exit");
        this.musicProcess.kill("SIGKILL");
    }

    this.activeMusic = item;
    console.error(`[PLAYER] ▶️ PLAYING_MUSIC: ${item.title}`);
    const vol = this.isBgmMode ? "0.15" : "1.0";
    const proc = spawn("afplay", ["-v", vol, item.path]);
    this.musicProcess = proc;

    proc.on("exit", () => {
        if (this.musicProcess !== proc) return;
        this.musicProcess = null;
        this.activeMusic = null;
        if (!this.isPaused) {
            if (this.isBgmMode && this.musicQueue.length === 0) {
                this.addMusic(item.path, item.title);
            }
            setTimeout(() => this.playNextMusic(), 500);
        }
    });
  }

  private resumeMusicAfterVoice() {
      if (!this.musicProcess && !this.xiaomiMusicTimer) {
          this.playNextMusic();
      }
  }

  // --- 接口 ---

  next() {
      if (this.musicProcess) {
          this.musicProcess.removeAllListeners("exit");
          this.musicProcess.kill("SIGKILL");
          this.musicProcess = null;
      }
      if (this.voiceProcess) {
          this.voiceProcess.removeAllListeners("exit");
          this.voiceProcess.kill("SIGKILL");
          this.voiceProcess = null;
      }
      if (this.xiaomiMusicTimer) {
          clearTimeout(this.xiaomiMusicTimer);
          this.xiaomiMusicTimer = null;
      }

      try {
          spawnSync("pkill", ["-9", "afplay"]);
      } catch (e) {}

      this.activeMusic = null;
      this.activeVoice = null;

      this.playNextMusic();
  }

  toggle() {
    if (!this.musicProcess) return;
    if (this.isPaused) {
        this.musicProcess.kill("SIGCONT");
        this.isPaused = false;
    } else {
        this.musicProcess.kill("SIGSTOP");
        this.isPaused = true;
    }
  }

  clear() {
    this.isBgmMode = false;
    this.musicQueue = [];
    this.voiceQueue = [];
    this.lastVoiceTitle = "";
    this.isReplenishing = false;

    if (this.xiaomiMusicTimer) {
        clearTimeout(this.xiaomiMusicTimer);
        this.xiaomiMusicTimer = null;
    }

    try {
        spawnSync("pkill", ["-9", "afplay"]);
    } catch (e) {}

    if (this.musicProcess) {
        this.musicProcess.removeAllListeners("exit");
        this.musicProcess.kill("SIGKILL");
    }
    if (this.voiceProcess) {
        this.voiceProcess.removeAllListeners("exit");
        this.voiceProcess.kill("SIGKILL");
    }
    this.musicProcess = null;
    this.voiceProcess = null;
    this.activeMusic = null;
    this.activeVoice = null;
    this.lastActivity = "SIGNAL_CLEARED";
  }

  stopCurrent() { this.clear(); }

  getState(): PlayerState {
      return {
          currentMusic: this.activeMusic,
          currentVoice: this.activeVoice,
          musicQueueCount: this.musicQueue.length,
          isPaused: this.isPaused,
          lastActivity: this.lastActivity
      };
  }

  getCurrentTrackId(): string | null {
      return null;
  }
}

export const agentPlayer = new AgentPlayerService();
