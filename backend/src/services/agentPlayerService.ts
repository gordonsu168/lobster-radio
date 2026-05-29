import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export interface PlayerState {
  current: { title: string; path: string; trackId?: string } | null;
  queue: { title: string; path: string; trackId?: string }[];
  isPaused: boolean;
  lastActivity: string;
}

type QueueLowCallback = () => Promise<void>;

class AgentPlayerService {
  private playlist: { path: string; title: string; trackId?: string }[] = [];
  private currentIndex: number = -1;
  private currentProcess: ChildProcess | null = null;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;
  private lastActivity: string = "DJ_READY";
  private downloadProcess: ChildProcess | null = null;

  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  private isLooping = false;
  private ambientProcess: ChildProcess | null = null;
  private ambientPath: string | null = null;

  playAmbient(path: string, volume: number = 0.15) {
      if (this.ambientProcess) {
          this.stopAmbient();
      }
      this.ambientPath = path;
      this.startAmbientLoop(volume);
  }

  private startAmbientLoop(volume: number) {
      if (!this.ambientPath) return;
      console.error(`[PLAYER] 🎧 MIXER_START: ${this.ambientPath} (Vol: ${volume})`);
      
      // 使用 spawn 直接传递参数，不经过 shell，完美支持乱码文件名
      this.ambientProcess = spawn("afplay", ["-v", volume.toString(), this.ambientPath]);
      
      this.ambientProcess.on("exit", () => {
          if (this.ambientPath) {
              setTimeout(() => this.startAmbientLoop(volume), 500);
          }
      });
  }

  stopAmbient() {
      this.ambientPath = null;
      if (this.ambientProcess) {
          this.ambientProcess.removeAllListeners("exit");
          this.ambientProcess.kill("SIGKILL");
          this.ambientProcess = null;
      }
  }

  add(path: string, title: string, trackId?: string) {
      if (!path) return;
      this.playlist.push({ path, title, trackId });
      console.error(`[PLAYER] ADDED: ${title} (Queue: ${this.playlist.length})`);
      this.lastActivity = `LOCKED: ${title.slice(0, 15)}`;
      if (!this.currentProcess && !this.downloadProcess) {
          this.play(this.currentIndex + 1);
      }
  }

  playBGM(path: string, title: string) {
      this.stopCurrent();
      this.playAmbient(path, 0.15);
      console.error(`[PLAYER] BGM_MIX_MODE_START: ${title}`);
  }

  private isPlaying = false;
  private lastPlayStartTime = 0;

  async play(index: number): Promise<void> {
      // 防止重入
      const now = Date.now();
      if (this.isPlaying && (now - this.lastPlayStartTime < 1000)) {
          console.error(`[PLAYER] 🛡️ Play request ignored (Too frequent)`);
          return;
      }

      if (index < 0 || index >= this.playlist.length) {
          this.isPlaying = false;
          if (this.isLooping && this.playlist.length > 0) {
              return this.play(0);
          }
          this.stopCurrent();
          
          if (this.onQueueLow && !this.isReplenishing) {
              console.error(`[PLAYER] 📭 Queue Empty, triggering replenish...`);
              this.isReplenishing = true;
              this.onQueueLow().finally(() => {
                  setTimeout(() => { this.isReplenishing = false; }, 3000);
              });
          }
          return;
      }

      this.currentIndex = index;
      this.isPaused = false;
      this.isPlaying = true;
      this.lastPlayStartTime = Date.now();
      const item = this.playlist[index];

      console.error(`[PLAYER] ⏯ PREPARING: ${item.title}`);

      // 只有在当前播放接近尾声（或者当前就是最后一首）时才补货
      const remaining = this.playlist.length - (this.currentIndex + 1);
      if (remaining === 0 && this.onQueueLow && !this.isReplenishing) {
          this.isReplenishing = true;
          console.error(`[PLAYER] 🚚 Last track, pre-fetching next segment...`);
          // 延迟一点补货，给当前曲目留出启动时间
          setTimeout(() => {
              this.onQueueLow?.().finally(() => {
                  setTimeout(() => { this.isReplenishing = false; }, 5000);
              });
          }, 2000);
      }

      if (item.path.startsWith('http')) {
          // ... 原有的 http 下载逻辑保持不变 (使用 spawn)
          const tempPath = path.join(os.tmpdir(), `dj_s_${Date.now()}.mp3`);
          const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
          this.downloadProcess = spawn("curl", ["-L", "-s", "-A", userAgent, "--max-time", "15", item.path, "-o", tempPath]);
          this.downloadProcess.on("exit", (code) => {
              this.downloadProcess = null;
              if (code === 0 && fs.existsSync(tempPath)) {
                  this.executeAfplay(tempPath, item.title);
              } else {
                  this.next();
              }
          });
      } else {
          this.executeAfplay(item.path, item.title);
      }
  }

  private executeAfplay(source: string, title: string) {
    if (!fs.existsSync(source)) {
        console.error(`[PLAYER] ❌ File not found: ${source}`);
        this.lastActivity = "ERR: FILE_NOT_FOUND";
        // 如果文件不存在，立即跳过到下一首，防止卡死
        setTimeout(() => this.next(), 500);
        return;
    }
    
    this.lastActivity = `INJECTING: ${title.slice(0, 15)}`;
    
    setTimeout(() => {
        // 使用 spawn 避开 Shell 的编码解析问题
        this.currentProcess = spawn("afplay", ["-v", "1.0", source]);
        
        this.currentProcess.on("error", (err) => {
            console.error(`[PLAYER] 💥 afplay spawn error: ${err.message}`);
            setTimeout(() => this.next(), 1000);
        });

        this.currentProcess.on("exit", (code) => {
          if (!this.isPaused) {
              if (code !== 0 && code !== null) {
                  console.error(`[PLAYER] ⚠️ afplay terminated with code ${code}`);
              }
              setTimeout(() => this.next(), 500);
          }
        });
    }, 100);
  }

  next() { this.play(this.currentIndex + 1); }
  prev() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }
  
  toggle() {
    if (!this.currentProcess) return;
    if (this.isPaused) { this.currentProcess.kill("SIGCONT"); this.isPaused = false; } 
    else { this.currentProcess.kill("SIGSTOP"); this.isPaused = true; }
  }

  stopCurrent() {
    if (this.currentProcess) {
      this.currentProcess.removeAllListeners("exit");
      this.currentProcess.kill("SIGKILL");
      this.currentProcess = null;
    }
    if (this.downloadProcess) {
        this.downloadProcess.removeAllListeners("exit");
        this.downloadProcess.kill("SIGKILL");
        this.downloadProcess = null;
    }
  }

  isNarrating(): boolean {
      return this.playlist[this.currentIndex]?.title.startsWith("🎙️") || false;
  }

  getCurrentTrackId(): string | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      return this.playlist[this.currentIndex].trackId || null;
    }
    return null;
  }

  clear() {
    this.stopCurrent();
    this.stopAmbient();
    this.playlist = [];
    this.currentIndex = -1;
    this.isPaused = false;
    this.isLooping = false;
    this.lastActivity = "SIGNAL_CLEARED";
  }

  getState(): PlayerState {
    return {
      current: (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) ? this.playlist[this.currentIndex] : null,
      queue: this.playlist.slice(this.currentIndex + 1),
      isPaused: this.isPaused,
      lastActivity: this.lastActivity
    };
  }
}

export const agentPlayer = new AgentPlayerService();
