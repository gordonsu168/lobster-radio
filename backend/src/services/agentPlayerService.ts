import { spawn, ChildProcess, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

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

class AgentPlayerService {
  // --- 双队列设计 ---
  private musicQueue: AudioItem[] = [];
  private voiceQueue: AudioItem[] = [];
  
  private musicProcess: ChildProcess | null = null;
  private voiceProcess: ChildProcess | null = null;
  
  private activeMusic: AudioItem | null = null;
  private activeVoice: AudioItem | null = null;
  
  private isBgmMode: boolean = false;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;
  private lastActivity: string = "STANDBY";
  private lastVoiceTitle: string = "";

  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  // --- 旁白轨道控制 ---

  /**
   * 注入一段旁白。如果是闲聊模式，立即播放；如果是电台模式，通常由音乐轨道调度。
   */
  addVoice(path: string, title: string) {
    // 简单的去重逻辑，防止 5 秒内重复添加相同的语音
    if (title === this.lastVoiceTitle) {
      console.error(`[PLAYER] ⚠️ SKIP_DUPLICATE_VOICE: ${title}`);
      return;
    }
    this.lastVoiceTitle = title;
    setTimeout(() => { if(this.lastVoiceTitle === title) this.lastVoiceTitle = ""; }, 5000);

    this.voiceQueue.push({ path, title });
    console.error(`[PLAYER] 🎙️ VOICE_ADDED: ${title}`);
    
    // 如果是闲聊模式且旁白没在播，立即启动
    if (this.isBgmMode && !this.voiceProcess) {
        this.playNextVoice();
    }
  }

  private playNextVoice() {
    if (this.voiceQueue.length === 0) return;
    const item = this.voiceQueue.shift()!;
    this.executeVoice(item);
  }

  private executeVoice(item: AudioItem) {
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
        // 旁白结束后的连锁反应
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
      // 避免重复添加
      if (this.activeMusic?.path === path && !this.isBgmMode) return;

      this.musicQueue.push({ path, title, trackId });
      console.error(`[PLAYER] 🎵 MUSIC_ADDED: ${title}`);
      if (!this.musicProcess && !this.activeVoice) {
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

  private executeMusic(item: AudioItem) {
    if (this.musicProcess) {
        this.musicProcess.removeAllListeners("exit");
        this.musicProcess.kill("SIGKILL");
    }

    // 逻辑：如果是电台模式且有待播旁白，先播旁白再播歌
    if (!this.isBgmMode && this.voiceQueue.length > 0) {
        this.activeMusic = { ...item, title: `[READY] ${item.title}` };
        this.playNextVoice();
        // 暂时保存这首歌，等旁白播完再回来
        this.musicQueue.unshift(item);
        return;
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
            // 如果是 BGM模式且队列空了，循环
            if (this.isBgmMode && this.musicQueue.length === 0) {
                this.addMusic(item.path, item.title);
            }
            setTimeout(() => this.playNextMusic(), 500);
        }
    });
  }

  private resumeMusicAfterVoice() {
      if (!this.musicProcess) {
          this.playNextMusic();
      }
  }

  // --- 接口 ---

  next() {
      if (this.musicProcess) this.musicProcess.kill("SIGKILL");
      if (this.voiceProcess) this.voiceProcess.kill("SIGKILL");
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
      return null; // 暂不实现
  }
}

export const agentPlayer = new AgentPlayerService();
