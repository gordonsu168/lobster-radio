import express from "express";
import cors from "cors";
import { recommendationRouter } from "./routes/recommendationRoutes.js";
import { preferencesRouter } from "./routes/preferencesRoutes.js";
import { settingsRouter } from "./routes/settingsRoutes.js";
import { ttsRouter } from "./routes/ttsRoutes.js";
import { libraryRouter } from "./routes/libraryRoutes.js";
import { wikiRouter } from "./routes/wikiRoutes.js";
import { wikipediaRouter } from "./routes/wikipediaRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import { streamRouter } from "./routes/streamRoutes.js";
import { lobsterCoreXRouter } from "./routes/agentRoutes.js";
import { speakerRouter } from "./routes/speakerRoutes.js";
import { voiceRouter } from "./routes/voiceRoutes.js";
import { resolveRuntimeSecrets } from "./services/settingsResolver.js";
import { updateXiaomiConfig } from "./services/xiaomiSpeakerService.js";
import { scanMusicLibrary } from "./services/musicLibraryService.js";
import { importSongsFromTracks } from "./services/wikiService.js";
import { startUserStateMonitor } from "./services/userStateMonitor.js";

/**
 * 自动配置 xiaomusic 语音指令关键词
 * 通过 xiaomusic REST API 将语音指令映射到 lobster-radio
 *
 * 重要：必须操作 user_key_word_dict（会在 init() 时被保留），
 * 不能操作 key_word_dict（会在 init() 时被重置为默认值）。
 */
async function autoConfigureXiaomusicVoice(xiaomiCfg: any) {
  const apiUrl = xiaomiCfg.apiUrl || "http://localhost:8090";
  const deviceId = xiaomiCfg.deviceId;

  try {
    // 1. 获取当前 xiaomusic 配置
    const getResp = await fetch(`${apiUrl}/getsetting`);
    if (!getResp.ok) {
      console.log("[VOICE] ⚠️ 无法获取 xiaomusic 配置，跳过语音指令自动配置");
      return;
    }
    const xmConfig = await getResp.json();

    // 2. 检查是否已配置（检查 user_key_word_dict 而不是 key_word_dict）
    const userKw = xmConfig.user_key_word_dict || {};
    const alreadyConfigured = userKw["切歌"]?.includes("voice/command");

    if (alreadyConfigured) {
      console.log("[VOICE] ✅ xiaomusic 语音指令已配置，跳过");
      return;
    }

    // 3. 解析 lobster-radio 地址
    const lobsterHost =
      process.env.XIAOMI_SPEAKER_LAN_HOST ||
      xmConfig.hostname?.replace(/:\d+$/, "").replace("http://", "") ||
      "127.0.0.1";
    const lobsterUrl = `http://${lobsterHost}:4000`;

    // 4. 设置 user_key_word_dict（持久化的关键词）
    xmConfig.user_key_word_dict = {
      ...userKw,
      // 切歌（推荐使用，小爱不认识，不会冲突）
      "切歌": `exec#httpget("${lobsterUrl}/api/voice/command?action=skip")`,
      "换歌": `exec#httpget("${lobsterUrl}/api/voice/command?action=skip")`,
      "跳过": `exec#httpget("${lobsterUrl}/api/voice/command?action=skip")`,
      // 备用（可能与小爱内置指令冲突）
      "下一首": `exec#httpget("${lobsterUrl}/api/voice/command?action=skip")`,
      "上一首": `exec#httpget("${lobsterUrl}/api/voice/command?action=skip")`,
      // 停止
      "关机": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "暂停": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "停止": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "停止播放": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "关闭": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "退出": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      "关掉音乐": `exec#httpget("${lobsterUrl}/api/voice/command?action=stop")`,
      // 点歌（需 xiaomusic 重启后加载 lobster_radio.py 插件）
      "来首": "play",
      "点歌": "play",
      "我想听": "play",
      // 插件初始化触发器
      "_init_lobster": "exec#lobster_init()",
    };

    // 将语音指令关键词加入 active_cmd
    // 关键：xiaomusic 的 is_playing 在代理播放时为 False
    // 如果关键词不在 active_cmd 中，非播放中的语音指令会被跳过
    const voiceKeywords = [
      "切歌", "换歌", "跳过", "下一首", "上一首",
      "关机", "暂停", "停止", "停止播放", "关闭", "退出", "关掉音乐",
      "来首", "点歌", "我想听", "exec"
    ];
    const activeCmdList = (xmConfig.active_cmd || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const kw of voiceKeywords) {
      if (!activeCmdList.includes(kw)) {
        activeCmdList.push(kw);
      }
    }
    xmConfig.active_cmd = activeCmdList.join(",");

    // 5. 保存配置
    const saveResp = await fetch(`${apiUrl}/savesetting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(xmConfig),
    });

    if (!saveResp.ok) {
      console.log("[VOICE] ⚠️ 保存 xiaomusic 配置失败");
      return;
    }

    console.log("[VOICE] ✅ 已更新 xiaomusic user_key_word_dict");

    // 6. 尝试触发插件初始化
    if (deviceId) {
      const cmdResp = await fetch(`${apiUrl}/cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: deviceId, cmd: "_init_lobster" }),
      });

      const cmdResult = await cmdResp.json().catch(() => ({}));
      if (cmdResp.ok && cmdResult.ret === "OK") {
        console.log("[VOICE] 🎤 lobster-radio 语音指令已激活");
      } else {
        console.log(
          `[VOICE] 💡 插件初始化需要 xiaomusic 重启后加载 lobster_radio.py\n` +
          `[VOICE]    简单指令（下一首/停止）无需插件，立即生效\n` +
          `[VOICE]    点歌指令（来首/点歌）需重启 xiaomusic`
        );
      }
    }
  } catch (err: any) {
    console.log("[VOICE] ⚠️ xiaomusic 语音配置失败:", err.message);
    console.log("[VOICE]    请确保 xiaomusic 正在运行 (http://localhost:8090)");
  }
}

const app = express();

async function start() {
  const secrets = await resolveRuntimeSecrets();
  const port = Number(process.env.PORT || 4000);

  // 音频流需要更宽松的 CORS 配置
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "lobster-radio-backend" });
  });

  app.use("/api/recommendations", recommendationRouter);
  app.use("/api/preferences", preferencesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/tts", ttsRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/wiki", wikiRouter);
  app.use("/api/wikipedia", wikipediaRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/stream", streamRouter);
  app.use("/api/agent/x", lobsterCoreXRouter);
  app.use("/api/speaker", speakerRouter);
  app.use("/api/voice", voiceRouter);

  // 初始化小米音响配置
  const xiaomiCfg = (secrets as any).xiaomiSpeaker;
  if (xiaomiCfg?.enabled) {
    updateXiaomiConfig(xiaomiCfg);
    console.log(`🔊 小米音响已启用: ${xiaomiCfg.apiUrl} → 设备: ${xiaomiCfg.deviceId || "(未选择)"}`);

    // 自动配置 xiaomusic 语音指令关键词
    autoConfigureXiaomusicVoice(xiaomiCfg);
  }

  // 启动时自动导入歌曲到 Wiki
  (async () => {
    try {
      const allTracks = await scanMusicLibrary(true);
      await importSongsFromTracks(allTracks);
      console.log(`Auto-imported ${allTracks.length} tracks to Wiki`);
    } catch (e) {
      console.warn("Wiki import failed, but server still works:", e);
    }
  })();

  app.listen(port, () => {
    console.log(`Lobster Radio backend listening on http://localhost:${port}`);
    startUserStateMonitor();
    console.log("User state monitor started");
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
