import { exec } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
class AgentPlayerService {
    playlist = [];
    currentIndex = -1;
    currentProcess = null;
    isPaused = false;
    onQueueLow = null;
    isReplenishing = false;
    lastActivity = "DJ_READY";
    downloadProcess = null;
    setReplenishCallback(cb) {
        this.onQueueLow = cb;
    }
    add(path, title = "Unknown Signal") {
        if (!path)
            return;
        this.playlist.push({ path, title });
        this.lastActivity = `LOCKED: ${title.slice(0, 15)}`;
        if (!this.currentProcess && !this.downloadProcess) {
            this.play(this.currentIndex + 1);
        }
    }
    async play(index) {
        if (index < 0 || index >= this.playlist.length) {
            this.currentProcess = null;
            if (this.onQueueLow && !this.isReplenishing) {
                this.isReplenishing = true;
                this.lastActivity = "FETCHING_NEXT...";
                this.onQueueLow().finally(() => {
                    setTimeout(() => { this.isReplenishing = false; }, 3000);
                });
            }
            return;
        }
        this.stopCurrent();
        this.currentIndex = index;
        this.isPaused = false;
        const item = this.playlist[index];
        if (item.path.startsWith('http')) {
            const tempPath = path.join(os.tmpdir(), `dj_s_${Date.now()}.mp3`);
            this.lastActivity = `SYNCING: ${item.title.slice(0, 20)}`;
            // 使用 curl 下载，增加 -L (跟随重定向) 和 -A (伪装 User-Agent 防止被网易云封杀)
            const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
            this.downloadProcess = exec(`curl -L -s -A "${userAgent}" --max-time 15 "${item.path}" -o "${tempPath}"`, (err) => {
                this.downloadProcess = null;
                if (err || !fs.existsSync(tempPath) || fs.statSync(tempPath).size < 1000) {
                    this.lastActivity = `ERR: SIGNAL_LOST [${item.title.slice(0, 10)}]`;
                    setTimeout(() => this.next(), 1000);
                }
                else {
                    this.executeAfplay(tempPath, item.title);
                }
            });
        }
        else {
            if (!fs.existsSync(item.path)) {
                this.lastActivity = `ERR: FILE_NOT_FOUND`;
                setTimeout(() => this.next(), 1000);
                return;
            }
            this.executeAfplay(item.path, item.title);
        }
    }
    executeAfplay(source, title) {
        this.lastActivity = `INJECTING: ${title.slice(0, 15)} | SRC: ${source}`;
        this.currentProcess = exec(`afplay "${source}"`);
        this.currentProcess.on("exit", () => {
            if (!this.isPaused)
                this.next();
        });
    }
    next() { this.play(this.currentIndex + 1); }
    prev() { if (this.currentIndex > 0)
        this.play(this.currentIndex - 1); }
    toggle() {
        if (!this.currentProcess)
            return;
        if (this.isPaused) {
            this.currentProcess.kill("SIGCONT");
            this.isPaused = false;
        }
        else {
            this.currentProcess.kill("SIGSTOP");
            this.isPaused = true;
        }
    }
    stopCurrent() {
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
    clear() {
        this.stopCurrent();
        this.playlist = [];
        this.currentIndex = -1;
        this.isPaused = false;
        this.lastActivity = "SIGNAL_CLEARED";
    }
    getState() {
        return {
            current: (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) ? this.playlist[this.currentIndex] : null,
            queue: this.playlist.slice(this.currentIndex + 1),
            isPaused: this.isPaused,
            lastActivity: this.lastActivity
        };
    }
}
export const agentPlayer = new AgentPlayerService();
