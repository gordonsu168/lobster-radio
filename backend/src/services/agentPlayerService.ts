import { spawn, ChildProcess } from "node:child_process";
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
  
  private isBgmMode: boolean = false;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;
  private lastActivity: string = "STANDBY";

  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  // --- 旁白轨道控制 ---

  /**
   * 注入一段旁白。如果是闲聊模式，立即播放；如果是电台模式，通常由音乐轨道调度。
   */
  addVoice(path: string, title: string) {
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
        this.voiceProcess.kill("SIGKILL");
    }
    
    console.error(`[PLAYER] 🎙️ NARRATING: ${item.title}`);
    this.voiceProcess = spawn("afplay", ["-v", "1.2", item.path]);
    this.voiceProcess.on("exit", () => {
        this.voiceProcess = null;
        // 旁白结束后的连锁反应
        if (this.isBgmMode) {
            this.playNextVoice(); // 闲聊模式继续播下一句
        } else {
            // 电台模式：如果音乐正在等待旁白结束，这里可以触发
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
      this.musicQueue.push({ path, title, trackId });
      console.error(`[PLAYER] 🎵 MUSIC_ADDED: ${title}`);
      if (!this.musicProcess) {
          this.playNextMusic();
      }
  }

  private playNextMusic() {
      if (this.musicQueue.length === 0) {
          if (this.onQueueLow && !this.isReplenishing) {
              this.isReplenishing = true;
              this.onQueueLow().finally(() => { 
                  setTimeout(() => { this.isReplenishing = false; }, 3000); 
              });
          }
          return;
      }
      
      const item = this.musicQueue.shift()!;
      this.executeMusic(item);
  }

  private executeMusic(item: AudioItem) {
    if (this.musicProcess) this.musicProcess.kill("SIGKILL");

    // 逻辑：如果是电台模式且有待播旁白，先播旁白再播歌
    if (!this.isBgmMode && this.voiceQueue.length > 0) {
        this.playNextVoice();
        // 暂时保存这首歌，等旁白播完再回来
        this.musicQueue.unshift(item);
        return;
    }

    console.error(`[PLAYER] ▶️ PLAYING_MUSIC: ${item.title}`);
    const vol = this.isBgmMode ? "0.15" : "1.0";
    this.musicProcess = spawn("afplay", ["-v", vol, item.path]);
    
    this.musicProcess.on("exit", () => {
        this.musicProcess = null;
        if (!this.isPaused) {
            // 如果是 BGM 模式且队列空了，循环
            if (this.isBgmMode && this.musicQueue.length === 0) {
                this.addMusic(item.path, item.title);
            }
            setTimeout(() => this.playNextMusic(), 500);
        }
    });
  }

  private resumeMusicAfterVoice() {
      // 只有当音乐轨道空闲时才启动下一首（通常是刚才 unshift 回去的歌曲）
      if (!this.musicProcess) {
          this.playNextMusic();
      }
  }

  // --- 接口 ---

  next() {
      if (this.musicProcess) this.musicProcess.kill("SIGKILL");
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
      if (this.musicProcess) this.musicProcess.kill("SIGKILL");
      if (this.voiceProcess) this.voiceProcess.kill("SIGKILL");
      this.musicProcess = null;
      this.voiceProcess = null;
      this.lastActivity = "SIGNAL_CLEARED";
  }

  stopCurrent() { this.clear(); }

  getState(): PlayerState {
      return {
          currentMusic: this.musicQueue[0] || null, // 简化的 state
          currentVoice: this.voiceProcess ? { title: "DJ正在说话", path: "" } : null,
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
