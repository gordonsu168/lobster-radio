import { execSync } from "node:child_process";
import { getRuntimeSettings } from "./storageService.js";

export type UserActivityState =
  | "working"   // 工作中 - 在工作时间使用电脑
  | "coding"    // 写代码 - 活跃于编辑器/终端
  | "idling"    // 发呆 - 电脑空闲中
  | "watching"  // 看电影/视频
  | "browsing"  // 摸鱼 - 刷网页/社交媒体
  | "gaming"    // 打游戏
  | "away"      // 离开 - 长时间空闲
  | "commuting" // 通勤
  | "sleeping"  // 睡觉
  | "relaxing"  // 休息/周末
  | "evening";  // 晚间

export interface UserSchedule {
  workStart: string;   // "09:00"
  workEnd: string;     // "18:00"
  workDays: number[];  // [1,2,3,4,5] Mon-Fri
  sleepTime: string;   // "23:00"
  wakeTime: string;    // "07:00"
}

export interface UserState {
  activity: UserActivityState;
  activeApp: string | null;
  idleSeconds: number;
  timeOfDay: string;
  dayOfWeek: string;
  isWeekend: boolean;
  schedule: UserSchedule | null;
  label: string; // Human-readable state label in Chinese
}

const defaultSchedule: UserSchedule = {
  workStart: "09:00",
  workEnd: "18:00",
  workDays: [1, 2, 3, 4, 5],
  sleepTime: "23:00",
  wakeTime: "07:00",
};

// Known app classifications
const codingApps = new Set([
  "Code", "Visual Studio Code", "Cursor", "Windsurf", "Terminal", "iTerm2",
  "Xcode", "IntelliJ IDEA", "WebStorm", "PyCharm", "Sublime Text", "Neovide",
]);

const videoDomains = new Set([
  "youtube.com", "bilibili.com", "netflix.com", "iqiyi.com", "v.qq.com",
  "youku.com", "douyin.com", "tiktok.com", "primevideo.com", "disneyplus.com",
]);

const socialDomains = new Set([
  "twitter.com", "x.com", "weibo.com", "reddit.com", "douban.com",
  "zhihu.com", "tieba.baidu.com", "instagram.com", "facebook.com",
]);

const gamingApps = new Set([
  "Steam", "Epic Games", "Battle.net", "Minecraft", "League of Legends",
]);

let cachedState: UserState | null = null;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getTimeBasedState(schedule: UserSchedule): { activity: UserActivityState; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const mins = now.getHours() * 60 + now.getMinutes();
  const isWorkDay = schedule.workDays.includes(day);

  if (mins >= timeToMinutes(schedule.sleepTime) || mins < timeToMinutes(schedule.wakeTime)) {
    return { activity: "sleeping", label: "睡觉中 😴" };
  }

  if (!isWorkDay) {
    if (mins < timeToMinutes("10:00")) return { activity: "relaxing", label: "周末早晨 🌅" };
    return { activity: "relaxing", label: "周末休息 🛋️" };
  }

  if (mins >= timeToMinutes(schedule.workStart) && mins < timeToMinutes(schedule.workEnd)) {
    return { activity: "working", label: "工作中 💼" };
  }

  if (mins < timeToMinutes(schedule.workStart)) {
    return { activity: "commuting", label: "通勤中 🚇" };
  }

  // After work
  if (mins < timeToMinutes("21:00")) return { activity: "evening", label: "晚间时光 🌆" };
  return { activity: "relaxing", label: "夜晚放松 🌙" };
}

function getDayOfWeek(): string {
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[new Date().getDay()];
}

function detectActivity(): { idleSeconds: number; activeApp: string | null } {
  let idleSeconds = 0;
  let activeApp: string | null = null;

  try {
    const raw = execSync(
      "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000)}'",
      { timeout: 3000, encoding: "utf8" }
    );
    idleSeconds = parseInt(raw.trim(), 10) || 0;
  } catch {
    // Non-macOS platform
  }

  try {
    activeApp = execSync(
      "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'",
      { timeout: 3000, encoding: "utf8" }
    ).trim();
  } catch {
    // Non-macOS platform
  }

  return { idleSeconds, activeApp };
}

function classifyActivity(
  idleSeconds: number,
  activeApp: string | null,
  schedule: UserSchedule
): UserState {
  const timeState = getTimeBasedState(schedule);
  const dayOfWeek = getDayOfWeek();
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  // Idle-based states
  if (idleSeconds > 600) {
    return {
      activity: "away",
      activeApp,
      idleSeconds,
      timeOfDay: `${new Date().getHours()}时`,
      dayOfWeek,
      isWeekend,
      schedule,
      label: "已离开 💤",
    };
  }

  if (idleSeconds > 120) {
    return {
      activity: "idling",
      activeApp,
      idleSeconds,
      timeOfDay: `${new Date().getHours()}时`,
      dayOfWeek,
      isWeekend,
      schedule,
      label: "发呆中 😶‍🌫️",
    };
  }

  // Active app-based states
  if (activeApp) {
    if (codingApps.has(activeApp)) {
      return {
        activity: "coding",
        activeApp,
        idleSeconds,
        timeOfDay: `${new Date().getHours()}时`,
        dayOfWeek,
        isWeekend,
        schedule,
        label: `写代码中 💻 (${activeApp})`,
      };
    }

    if (gamingApps.has(activeApp)) {
      return {
        activity: "gaming",
        activeApp,
        idleSeconds,
        timeOfDay: `${new Date().getHours()}时`,
        dayOfWeek,
        isWeekend,
        schedule,
        label: `游戏中 🎮 (${activeApp})`,
      };
    }

    // Browser-based detection
    if (activeApp.includes("Chrome") || activeApp.includes("Safari") || activeApp.includes("Firefox") || activeApp.includes("Edge")) {
      // Try to detect browser URL for more specific classification
      const browserContext = detectBrowserContext(activeApp);
      if (browserContext === "video") {
        return {
          activity: "watching",
          activeApp,
          idleSeconds,
          timeOfDay: `${new Date().getHours()}时`,
          dayOfWeek,
          isWeekend,
          schedule,
          label: "看视频中 🎬",
        };
      }
      if (browserContext === "social") {
        return {
          activity: "browsing",
          activeApp,
          idleSeconds,
          timeOfDay: `${new Date().getHours()}时`,
          dayOfWeek,
          isWeekend,
          schedule,
          label: "摸鱼中 🐟",
        };
      }
      return {
        activity: "browsing",
        activeApp,
        idleSeconds,
        timeOfDay: `${new Date().getHours()}时`,
        dayOfWeek,
        isWeekend,
        schedule,
        label: "浏览网页 🌐",
      };
    }
  }

  // Fall back to time-based state
  return {
    activity: timeState.activity,
    activeApp,
    idleSeconds,
    timeOfDay: `${new Date().getHours()}时`,
    dayOfWeek,
    isWeekend,
    schedule,
    label: timeState.label,
  };
}

function detectBrowserContext(appName: string): "video" | "social" | "browsing" | null {
  // Try Chrome tabs first
  try {
    const chromeTabs = execSync(
      `osascript -e 'tell application "Google Chrome" to get URL of active tab of front window' 2>/dev/null || echo ""`,
      { timeout: 3000, encoding: "utf8" }
    ).trim();

    if (chromeTabs) {
      const url = chromeTabs.toLowerCase();
      for (const domain of videoDomains) {
        if (url.includes(domain)) return "video";
      }
      for (const domain of socialDomains) {
        if (url.includes(domain)) return "social";
      }
    }
  } catch {
    // Chrome not running or no permission
  }

  // Try Safari
  try {
    const safariUrl = execSync(
      `osascript -e 'tell application "Safari" to get URL of current tab of front window' 2>/dev/null || echo ""`,
      { timeout: 3000, encoding: "utf8" }
    ).trim();

    if (safariUrl) {
      const url = safariUrl.toLowerCase();
      for (const domain of videoDomains) {
        if (url.includes(domain)) return "video";
      }
      for (const domain of socialDomains) {
        if (url.includes(domain)) return "social";
      }
    }
  } catch {
    // Safari not running or no permission
  }

  return null;
}

export async function getUserState(): Promise<UserState> {
  const settings = await getRuntimeSettings();
  const schedule = settings.userSchedule || defaultSchedule;

  const { idleSeconds, activeApp } = detectActivity();
  const state = classifyActivity(idleSeconds, activeApp, schedule);
  cachedState = state;
  return state;
}

export function getCachedUserState(): UserState | null {
  return cachedState;
}

// Start background polling
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startUserStateMonitor(intervalMs = 15000): void {
  if (pollTimer) return;

  // Initial poll
  getUserState().catch(() => {});

  pollTimer = setInterval(() => {
    getUserState().catch(() => {});
  }, intervalMs);
}

export function stopUserStateMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
