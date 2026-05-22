import { exec, ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export interface PlayerState {
  current: { title: string; path: string } | null;
  queue: { title: string; path: string }[];
  isPaused: boolean;
  lastActivity: string;
}

type QueueLowCallback = () => Promise<void>;

class AgentPlayerService {
  private playlist: { path: string; title: string }[] = [];
  private currentIndex: number = -1;
  private currentProcess: ChildProcess | null = null;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;
  private lastActivity: string = "PULSE_IDLE";
  private currentDownloadProcess: ChildProcess | null = null;

  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  add(path: string | null | undefined, title: string = "Unknown Signal") {
    if (!path) return;
    this.playlist.push({ path, title });
    if (!this.currentProcess && !this.currentDownloadProcess) {
      this.play(this.currentIndex + 1);
    }
  }

  async play(index: number) {
    if (index < 0 || index >= this.playlist.length) {
      this.currentProcess = null;
      if (this.onQueueLow && !this.isReplenishing) {
        this.isReplenishing = true;
        this.lastActivity = "AUTO_FETCH...";
        this.onQueueLow().finally(() => {
          setTimeout(() => { this.isReplenishing = false; }, 5000);
        });
      }
      return;
    }
    
    this.stopCurrent();
    this.currentIndex = index;
    this.isPaused = false;
    const item = this.playlist[index];

    if (item.path.startsWith('http')) {
      const tempPath = path.join(os.tmpdir(), `p_${Date.now()}.mp3`);
      this.lastActivity = `SYNCING: ${item.title.slice(0, 20)}`;
      
      this.currentDownloadProcess = exec(`curl -L -s --max-time 15 "${item.path}" -o "${tempPath}"`, (err) => {
          this.currentDownloadProcess = null;
          if (err || !fs.existsSync(tempPath) || fs.statSync(tempPath).size < 1000) {
              this.next();
          } else {
              this.executeAfplay(tempPath, item.title);
          }
      });
    } else {
      this.executeAfplay(item.path, item.title);
    }
  }

  private executeAfplay(source: string, title: string) {
    this.lastActivity = `PLAYING: ${title.slice(0, 25)}`;
    this.currentProcess = exec(`afplay "${source}"`);
    this.currentProcess.on("exit", () => {
      if (!this.isPaused) this.next();
    });
  }

  next() { this.play(this.currentIndex + 1); }
  prev() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }
  
  toggle() {
    if (!this.currentProcess) return;
    if (this.isPaused) { this.currentProcess.kill("SIGCONT"); this.isPaused = false; } 
    else { this.currentProcess.kill("SIGSTOP"); this.isPaused = true; }
  }

  private stopCurrent() {
    if (this.currentProcess) { this.currentProcess.removeAllListeners("exit"); this.currentProcess.kill(); this.currentProcess = null; }
    if (this.currentDownloadProcess) { this.currentDownloadProcess.kill(); this.currentDownloadProcess = null; }
  }

  clear() {
    this.stopCurrent();
    this.playlist = [];
    this.currentIndex = -1;
    this.isPaused = false;
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
