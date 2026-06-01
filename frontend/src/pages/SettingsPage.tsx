import { useEffect, useState, type FormEvent } from "react";
import {
  getSettings, saveSettings, getVoices, API_BASE,
  getDJIdentity, saveDJIdentity, getDJPersona, saveDJPersona,
  type DJIdentity,
  testXiaomiConnection,
  getXiaomiDevices,
  saveXiaomiConfig,
  type XiaomiDevice,
} from "../lib/api";
import type { RuntimeSettings } from "../types";
import type { VoiceInfo } from "../lib/api";

const initialSettings: RuntimeSettings = {
  spotifyClientId: "",
  spotifyClientSecret: "",
  neteaseApiEnabled: true,
  neteaseApiUrl: "",
  openAiApiKey: "",
  elevenLabsApiKey: "",
  defaultVoice: "alloy",
  defaultTtsProvider: "openai",
  djStyle: "classic",
  enableAiNarration: true,
  preferredMusicSource: "auto",
  localMusicPath: "",
  userSchedule: {
    workStart: "09:00",
    workEnd: "18:00",
    workDays: [1, 2, 3, 4, 5],
    sleepTime: "23:00",
    wakeTime: "07:00",
  },
  xiaomiSpeaker: {
    enabled: false,
    apiUrl: "http://localhost:8090",
    deviceId: "",
  },
};

const initialIdentity: DJIdentity = {
  name: "",
  englishName: "",
  programName: "",
  englishProgramName: "",
  persona: "",
  englishPersona: ""
};

export function SettingsPage() {
  const [settings, setSettings] = useState<RuntimeSettings>(initialSettings);
  const [identity, setIdentity] = useState<DJIdentity>(initialIdentity);
  const [persona, setPersona] = useState<string>("");
  
  const [status, setStatus] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // 小米音响
  const [xiaomiDevices, setXiaomiDevices] = useState<XiaomiDevice[]>([]);
  const [xiaomiLoading, setXiaomiLoading] = useState(false);
  const [xiaomiTestResult, setXiaomiTestResult] = useState<string>("");

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => setStatus("Unable to load saved settings."));
      
    void getDJIdentity()
      .then(setIdentity)
      .catch(() => console.error("Unable to load DJ identity."));

    void getDJPersona()
      .then((res) => setPersona(res.persona))
      .catch(() => console.error("Unable to load DJ persona."));
  }, []);

  useEffect(() => {
    getVoices(settings.defaultTtsProvider)
      .then((res) => {
        setAvailableVoices(res.voices);
        const voices = res.voices;
        if (voices.length > 0 && !voices.find((v) => v.id === settings.defaultVoice)) {
          const match = voices.find((v) => v.lang === settings.djLanguage) || voices[0];
          setSettings((current) => ({ ...current, defaultVoice: match.id }));
        }
      })
      .catch(() => setAvailableVoices([]));
  }, [settings.defaultTtsProvider]);

  function handlePreview() {
    const voice = availableVoices.find((v) => v.id === settings.defaultVoice);
    if (!voice) return;

    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = "";
    }

    const url = `${API_BASE}/api/tts/preview?provider=${encodeURIComponent(settings.defaultTtsProvider)}&voice=${encodeURIComponent(voice.id)}`;
    const audio = new Audio(url);
    setPreviewAudio(audio);

    audio.oncanplaythrough = () => setPreviewLoading(false);
    audio.onerror = () => setPreviewLoading(false);
    setPreviewLoading(true);
    audio.play().catch(() => setPreviewLoading(false));
  }

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = "";
      }
    };
  }, [previewAudio]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const savedSettings = await saveSettings(settings);
      setSettings(savedSettings);
      
      await saveDJIdentity(identity);
      await saveDJPersona(persona);
      
      setStatus("All settings saved successfully.");
    } catch (error) {
      setStatus("Failed to save some settings.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-pulse">Settings</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-white">DJ Identify & Persona</h1>
        <p className="mt-4 text-base leading-8 text-slate-300">
          Customize who your AI DJ is and how they talk. These changes are saved to DJ_IDENTITY.md and DJ_PERSONA.md.
        </p>

        <div className="mt-8 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="DJ Name (中文)"
              value={identity.name}
              onChange={(v) => setIdentity({ ...identity, name: v })}
            />
            <Field
              label="DJ Name (English)"
              value={identity.englishName}
              onChange={(v) => setIdentity({ ...identity, englishName: v })}
            />
          </div>
          
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Program Name (中文)"
              value={identity.programName}
              onChange={(v) => setIdentity({ ...identity, programName: v })}
            />
            <Field
              label="Program Name (English)"
              value={identity.englishProgramName}
              onChange={(v) => setIdentity({ ...identity, englishProgramName: v })}
            />
          </div>

          <Field
            label="Brief Persona (中文)"
            value={identity.persona}
            onChange={(v) => setIdentity({ ...identity, persona: v })}
          />
          <Field
            label="Brief Persona (English)"
            value={identity.englishPersona}
            onChange={(v) => setIdentity({ ...identity, englishPersona: v })}
          />

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">Full DJ Persona (Markdown)</label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="h-64 w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white outline-none"
              placeholder="# Role: ..."
            />
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <h2 className="font-display text-2xl font-bold text-white">Provider Configuration</h2>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <Field
            label="Spotify Client ID"
            value={settings.spotifyClientId}
            onChange={(value) => setSettings((current) => ({ ...current, spotifyClientId: value }))}
          />
          <Field
            label="Spotify Client Secret"
            type="password"
            value={settings.spotifyClientSecret}
            onChange={(value) => setSettings((current) => ({ ...current, spotifyClientSecret: value }))}
          />

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">网易云音乐</label>
            <label className="flex cursor-pointer items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={settings.neteaseApiEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    neteaseApiEnabled: event.target.checked
                  }))
                }
                className="h-5 w-5 accent-pulse"
              />
              <span className="text-white">启用网易云音乐搜索（中文歌曲）</span>
            </label>
            <input
              type="text"
              value={settings.neteaseApiUrl}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  neteaseApiUrl: event.target.value
                }))
              }
              placeholder="API 地址"
              className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white">本地音乐库</label>
            <input
              type="text"
              value={settings.localMusicPath}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  localMusicPath: event.target.value
                }))
              }
              placeholder="音乐文件夹路径"
              className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="mb-4 font-semibold text-white">作息时间 (User Schedule)</h3>
            <p className="mb-4 text-sm text-slate-400">DJ-X 会根据你的作息自动调整推荐和语气。</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">起床时间</label>
                <input
                  type="time"
                  value={settings.userSchedule?.wakeTime || "07:00"}
                  onChange={(e) => setSettings((c) => ({
                    ...c,
                    userSchedule: { ...(c.userSchedule || { workStart: "09:00", workEnd: "18:00", workDays: [1,2,3,4,5], sleepTime: "23:00", wakeTime: "07:00" }), wakeTime: e.target.value }
                  }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">睡觉时间</label>
                <input
                  type="time"
                  value={settings.userSchedule?.sleepTime || "23:00"}
                  onChange={(e) => setSettings((c) => ({
                    ...c,
                    userSchedule: { ...(c.userSchedule || { workStart: "09:00", workEnd: "18:00", workDays: [1,2,3,4,5], sleepTime: "23:00", wakeTime: "07:00" }), sleepTime: e.target.value }
                  }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">上班时间</label>
                <input
                  type="time"
                  value={settings.userSchedule?.workStart || "09:00"}
                  onChange={(e) => setSettings((c) => ({
                    ...c,
                    userSchedule: { ...(c.userSchedule || { workStart: "09:00", workEnd: "18:00", workDays: [1,2,3,4,5], sleepTime: "23:00", wakeTime: "07:00" }), workStart: e.target.value }
                  }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">下班时间</label>
                <input
                  type="time"
                  value={settings.userSchedule?.workEnd || "18:00"}
                  onChange={(e) => setSettings((c) => ({
                    ...c,
                    userSchedule: { ...(c.userSchedule || { workStart: "09:00", workEnd: "18:00", workDays: [1,2,3,4,5], sleepTime: "23:00", wakeTime: "07:00" }), workEnd: e.target.value }
                  }))}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-white outline-none"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-400">工作日</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { day: 1, label: "周一" },
                  { day: 2, label: "周二" },
                  { day: 3, label: "周三" },
                  { day: 4, label: "周四" },
                  { day: 5, label: "周五" },
                  { day: 6, label: "周六" },
                  { day: 0, label: "周日" },
                ].map(({ day, label }) => {
                  const workDays = settings.userSchedule?.workDays || [1,2,3,4,5];
                  const active = workDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSettings((c) => ({
                          ...c,
                          userSchedule: {
                            ...(c.userSchedule || { workStart: "09:00", workEnd: "18:00", workDays: [1,2,3,4,5], sleepTime: "23:00", wakeTime: "07:00" }),
                            workDays: active ? workDays.filter((d) => d !== day) : [...workDays, day].sort(),
                          }
                        }));
                      }}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                        active ? "bg-pulse text-white" : "bg-white/10 text-slate-400 hover:bg-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">TTS Provider</label>
              <select
                value={settings.defaultTtsProvider}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    defaultTtsProvider: event.target.value as RuntimeSettings["defaultTtsProvider"]
                  }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                <option value="moss">🤖 MOSS-TTS-Nano</option>
                <option value="edge">🔥 Edge TTS</option>
                <option value="gemini">Gemini TTS</option>
                <option value="macsay">Mac Say</option>
                <option value="openai">OpenAI</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">DJ 语言</label>
              <select
                value={settings.djLanguage || "zh-CN"}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    djLanguage: event.target.value as RuntimeSettings["djLanguage"]
                  }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                <option value="zh-CN">🇨🇳 普通话</option>
                <option value="zh-HK">🇭🇰 粤语</option>
                <option value="en-US">🇺🇸 英语</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">DJ 语音</label>
              <select
                value={settings.defaultVoice}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, defaultVoice: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                {availableVoices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.lang})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || availableVoices.length === 0}
                className="mt-2 rounded-full bg-pulse px-4 py-1.5 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
              >
                {previewLoading ? "⏳ 合成中..." : "🔊 试听"}
              </button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">🎭 DJ 情绪风格</label>
              <select
                value={settings.djEmotion || "normal"}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    djEmotion: event.target.value as RuntimeSettings["djEmotion"]
                  }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                <option value="normal">😐 正常</option>
                <option value="happy">😊 开心</option>
                <option value="calm">😌 平静</option>
                <option value="excited">🤩 兴奋</option>
                <option value="sad">😢 悲伤</option>
                <option value="whisper">🤫 耳语</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button className="w-full rounded-full bg-white px-5 py-4 text-lg font-bold text-slate-950 shadow-xl transition hover:scale-[1.01] hover:bg-slate-100 active:scale-95">
              Save All Settings
            </button>
            {status ? <p className="mt-4 text-center text-sm font-medium text-pulse animate-pulse">{status}</p> : null}
          </div>
        </form>
      </div>

      {/* ---- 小米音响（独立卡片）---- */}
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <h2 className="font-display text-2xl font-bold text-white">🔊 小米音响 (Songloft)</h2>
        <p className="mt-2 text-sm text-slate-400">
          通过 <a href="https://github.com/songloft-org/songloft" target="_blank" rel="noopener noreferrer" className="text-pulse underline">Songloft</a> 将音频推送到小米 AI 音箱。
        </p>

        <div className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.xiaomiSpeaker?.enabled ?? false}
              onChange={(e) => setSettings((c) => ({
                ...c,
                xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: false, apiUrl: "http://localhost:8080", deviceId: "", accountId: "", jwtToken: "" }), enabled: e.target.checked },
              }))}
              className="h-5 w-5 accent-pulse"
            />
            <span className="text-white">启用小米音响输出</span>
          </label>

          {settings.xiaomiSpeaker?.enabled && (
            <div className="space-y-4 pl-8">
              <Field
                label="Songloft API 地址 (不包含 /api/v1)"
                value={settings.xiaomiSpeaker?.apiUrl || "http://localhost:8080"}
                onChange={(v) => setSettings((c) => ({
                  ...c,
                  xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: true, apiUrl: "", deviceId: "" }), apiUrl: v },
                }))}
              />
              
              <Field
                label="小米账号 ID (accountId)"
                value={settings.xiaomiSpeaker?.accountId || ""}
                onChange={(v) => setSettings((c) => ({
                  ...c,
                  xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: true, apiUrl: "", deviceId: "" }), accountId: v },
                }))}
              />

              <Field
                label="Songloft JWT Token"
                type="password"
                value={settings.xiaomiSpeaker?.jwtToken || ""}
                onChange={(v) => setSettings((c) => ({
                  ...c,
                  xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: true, apiUrl: "", deviceId: "" }), jwtToken: v },
                }))}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setXiaomiLoading(true);
                    setXiaomiTestResult("");
                    try {
                      const res = await testXiaomiConnection();
                      setXiaomiTestResult(res.ok ? `✅ 连接成功 (v${res.version})` : `❌ ${res.error}`);
                    } catch (err: any) {
                      setXiaomiTestResult(`❌ ${err.message}`);
                    } finally { setXiaomiLoading(false); }
                  }}
                  disabled={xiaomiLoading}
                  className="rounded-full bg-pulse px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
                >
                  {xiaomiLoading ? "测试中..." : "🔍 测试连接"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setXiaomiLoading(true);
                    try {
                      const res = await getXiaomiDevices();
                      setXiaomiDevices(res.devices);
                    } catch (err: any) {
                      setXiaomiTestResult(`❌ ${err.message}`);
                    } finally { setXiaomiLoading(false); }
                  }}
                  disabled={xiaomiLoading}
                  className="rounded-full bg-pulse px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
                >
                  📱 获取设备列表
                </button>
              </div>

              {xiaomiTestResult && (
                <p className="text-sm font-medium text-pulse">{xiaomiTestResult}</p>
              )}

              {xiaomiDevices.length > 0 ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-white">选择设备</label>
                  <select
                    value={settings.xiaomiSpeaker?.deviceId || ""}
                    onChange={(e) => setSettings((c) => ({
                      ...c,
                      xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: true, apiUrl: "", deviceId: "" }), deviceId: e.target.value },
                    }))}
                    className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
                  >
                    <option value="">-- 选择设备 --</option>
                    {xiaomiDevices.map((d) => (
                      <option key={d.did} value={d.did}>{d.name} ({d.hardware})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <Field
                  label="设备 ID (DID)"
                  value={settings.xiaomiSpeaker?.deviceId || ""}
                  onChange={(v) => setSettings((c) => ({
                    ...c,
                    xiaomiSpeaker: { ...(c.xiaomiSpeaker || { enabled: true, apiUrl: "", deviceId: "" }), deviceId: v },
                  }))}
                />
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="button"
              onClick={async () => {
                try {
                  await saveXiaomiConfig(settings.xiaomiSpeaker || { enabled: false, apiUrl: "http://localhost:8080", deviceId: "", accountId: "", jwtToken: "" });
                  setXiaomiTestResult("✅ 小米音响配置已保存");
                } catch (err: any) {
                  setXiaomiTestResult(`❌ 保存失败: ${err.message}`);
                }
              }}
              className="w-full rounded-full bg-white px-5 py-4 text-lg font-bold text-slate-950 shadow-xl transition hover:scale-[1.01] hover:bg-slate-100 active:scale-95"
            >
              保存音响配置
            </button>
          </div>

          {/* ---- 语音指令 ---- */}
          {settings.xiaomiSpeaker?.enabled && settings.xiaomiSpeaker?.deviceId && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h3 className="font-display text-xl font-bold text-white">🎤 语音指令控制</h3>
              <p className="mt-1 text-sm text-slate-400">
                对着小米音响说以下指令控制播放。请确保在 Songloft 插件中配置了 Webhook 转发到龙虾电台。
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">🔍 点歌</p>
                  <p className="mt-1 text-sm text-white">来首 歌名</p>
                  <p className="text-sm text-white">点歌 歌名</p>
                  <p className="text-sm text-white">我想听 歌名</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">🎮 控制</p>
                  <p className="mt-1 text-sm text-white">下一首 / 切歌</p>
                  <p className="text-sm text-white">停止播放 / 关机</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                💡 提示：语音指令通过 Songloft 的 Conversation Webhook 转发。
                Webhook URL 请设置为: <code className="text-pulse">http://你的IP:4000/api/voice/webhook</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}

function Field({ label, value, onChange, type = "text" }: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
      />
    </div>
  );
}
