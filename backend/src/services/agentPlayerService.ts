import { exec, ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";

export interface PlayerState {
  current: { title: string; path: string } | null;
  queue: { title: string; path: string }[];
  history: { title: string; path: string }[];
  isPaused: boolean;
}

type QueueLowCallback = () => Promise<void>;

class AgentPlayerService {
  private playlist: { path: string; title: string }[] = [];
  private currentIndex: number = -1;
  private currentProcess: ChildProcess | null = null;
  private isPaused: boolean = false;
  private onQueueLow: QueueLowCallback | null = null;
  private isReplenishing: boolean = false;

  // 注册补货回调
  setReplenishCallback(cb: QueueLowCallback) {
    this.onQueueLow = cb;
  }

  add(path: string, title: string = "Unknown Signal") {
    this.playlist.push({ path, title });
    process.stderr.write(`[PLAYER_QUEUE] 信号入列: ${title}\n`);
    
    if (!this.currentProcess) {
      this.play(this.currentIndex + 1);
    }
  }

  async play(index: number) {
    if (index < 0 || index >= this.playlist.length) {
      this.currentProcess = null;
      process.stderr.write("[PLAYER] 序列暂时终结。等待新信号...\n");
      return;
    }
    
    // --- 自动补货逻辑 ---
    // 如果快播完了(剩下一首)，且有回调，且没在补货中，则触发补货
    if (this.onQueueLow && index === this.playlist.length - 1 && !this.isReplenishing) {
      this.isReplenishing = true;
      process.stderr.write("[PLAYER_SMART] 监测到低水位频率，触发自动补货...\n");
      this.onQueueLow().finally(() => { this.isReplenishing = false; });
    }

    this.stopCurrent();
    this.currentIndex = index;
    this.isPaused = false;
    
    const item = this.playlist[index];
    let sourcePath = item.path;

    if (item.path.startsWith('http')) {
      const tempPath = path.join(os.tmpdir(), `lobster_buffer_${Date.now()}.mp3`);
      process.stderr.write(`[PLAYER_SYNC] 同步远端频率: ${item.title}...\n`);
      try {
        const { execSync } = await import("node:child_process");
        execSync(`curl -L -s "${item.path}" -o "${tempPath}"`);
        sourcePath = tempPath;
      } catch (e) {
        process.stderr.write(`[PLAYER_ERR] 同步失败，跳过。\n`);
        this.next(); return;
      }
    }

    process.stderr.write(`[PLAYER_ACT] 正在注入 [${index+1}/${this.playlist.length}]: ${item.title}\n`);
    this.currentProcess = exec(`afplay "${sourcePath}"`);
    
    this.currentProcess.on("exit", (code) => {
      if (code === 0 && !this.isPaused) {
        this.next();
      } else {
        this.currentProcess = null;
      }
    });
  }

  next() { this.play(this.currentIndex + 1); }
  prev() { if (this.currentIndex > 0) this.play(this.currentIndex - 1); }
  
  toggle() {
    if (!this.currentProcess) {
        if (this.currentIndex >= 0) this.play(this.currentIndex);
        return;
    }
    if (this.isPaused) { this.currentProcess.kill("SIGCONT"); this.isPaused = false; } 
    else { this.currentProcess.kill("SIGSTOP"); this.isPaused = true; }
  }

  private stopCurrent() {
    if (this.currentProcess) {
      this.currentProcess.removeAllListeners("exit");
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  clear() {
    this.stopCurrent();
    this.playlist = [];
    this.currentIndex = -1;
    this.isPaused = false;
    process.stderr.write("[PLAYER] 序列已清空。\n");
  }

  getState(): PlayerState {
    return {
      current: (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) ? this.playlist[this.currentIndex] : null,
      queue: this.playlist.slice(this.currentIndex + 1),
      history: this.playlist.slice(0, this.currentIndex),
      isPaused: this.isPaused
    };
  }
}

export const agentPlayer = new AgentPlayerService();
