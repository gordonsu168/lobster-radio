import { exec, ChildProcess } from "node:child_process";
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

  add(path: string, title: string, trackId?: string) {
      if (!path) return;
      this.playlist.push({ path, title, trackId });
      console.error(`[PLAYER] ADDED: ${title} (Queue: ${this.playlist.length})`);
      this.lastActivity = `LOCKED: ${title.slice(0, 15)}`;
      if (!this.currentProcess && !this.downloadProcess) {
          this.play(this.currentIndex + 1);
      }
  }

  /**
   * 进入 BGM 模式：清空当前队列，播放指定文件并循环
   */
  playBGM(path: string, title: string) {
      this.clear();
      this.isLooping = true;
      this.add(path, title);
      console.error(`[PLAYER] BGM_MODE_START: ${title}`);
  }

  async play(index: number): Promise<void> {
      if (index < 0 || index >= this.playlist.length) {
          if (this.isLooping && this.playlist.length > 0) {
              return this.play(0);
          }
          this.stopCurrent();
          return;
      }

      this.currentIndex = index;
      this.isPaused = false;
      const item = this.playlist[index];

      console.error(`[PLAYER] PREPARING: ${item.title} | PATH: ${item.path}`);

      if (item.path.startsWith('http')) {
      const tempPath = path.join(os.tmpdir(), `dj_s_${Date.now()}.mp3`);
      this.lastActivity = `SYNCING: ${item.title.slice(0, 20)}`;
      
      // 使用 curl 下载，增加 -L (跟随重定向) 和 -A (伪装 User-Agent 防止被网易云封杀)
      const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      this.downloadProcess = exec(`curl -L -s -A "${userAgent}" --max-time 15 "${item.path}" -o "${tempPath}"`, (err) => {
          this.downloadProcess = null;
          if (err || !fs.existsSync(tempPath) || fs.statSync(tempPath).size < 1000) {
              this.lastActivity = `ERR: SIGNAL_LOST [${item.title.slice(0,10)}]`;
              setTimeout(() => this.next(), 1000);
          } else {
              this.executeAfplay(tempPath, item.title);
          }
      });
    } else {
      if (!fs.existsSync(item.path)) {
          console.error(`[PLAYER] ❌ File Not Found: ${item.path}`);
          this.lastActivity = `ERR: FILE_NOT_FOUND`;
          this.isLooping = false; // 关键：停止循环，防止死锁
          return;
      }
      this.executeAfplay(item.path, item.title);
    }  }

  private executeAfplay(source: string, title: string) {
    if (!fs.existsSync(source)) {
        console.error(`[PLAYER] ❌ ERROR: File not found at ${source}`);
        this.lastActivity = "ERR: FILE_MISSING";
        this.isLooping = false; 
        return;
    }
    this.lastActivity = `INJECTING: ${title.slice(0, 15)} | SRC: ${source}`;
    
    // 增加 100ms 延迟，给音频设备一点“呼吸时间”
    setTimeout(() => {
        this.currentProcess = exec(`afplay "${source}"`, (error, stdout, stderr) => {
            if (error && !this.isPaused) {
                console.error(`[PLAYER] afplay exit info: ${error.message}`);
            }
        });
        this.currentProcess.on("exit", () => {
          if (!this.isPaused) setTimeout(() => this.next(), 500);
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

  private stopCurrent() {
    if (this.currentProcess) {
      this.currentProcess.removeAllListeners("exit");
      this.currentProcess.kill();
      this.currentProcess = null;
    }
    if (this.downloadProcess) {
        this.downloadProcess.kill();
        this.downloadProcess = null;
    }
  }

  getCurrentTrackId(): string | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      return this.playlist[this.currentIndex].trackId || null;
    }
    return null;
  }

  clear() {
    this.stopCurrent();
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
