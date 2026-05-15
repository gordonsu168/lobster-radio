import { useEffect, useState, type FormEvent } from "react";
import { getSettings, saveSettings, getVoices, API_BASE } from "../lib/api";
import type { RuntimeSettings } from "../types";
import type { VoiceInfo } from "../lib/api";

const initialState: RuntimeSettings = {
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
  localMusicPath: ""
};

export function SettingsPage() {
  const [settings, setSettings] = useState<RuntimeSettings>(initialState);
  const [status, setStatus] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => setStatus("Unable to load saved settings."));
  }, []);

  useEffect(() => {
    getVoices(settings.defaultTtsProvider)
      .then((res) => {
        setAvailableVoices(res.voices);
        // If current voice isn't in the new provider's list, default to first
        const voices = res.voices;
        if (voices.length > 0 && !voices.find((v) => v.id === settings.defaultVoice)) {
          setSettings((current) => ({ ...current, defaultVoice: voices[0].id }));
        }
      })
      .catch(() => setAvailableVoices([]));
  }, [settings.defaultTtsProvider]);

  function handlePreview() {
    const voice = availableVoices.find((v) => v.id === settings.defaultVoice);
    if (!voice) return;

    // Stop any currently playing preview
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

  // Stop preview audio on unmount
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
    const saved = await saveSettings(settings);
    setSettings(saved);
    setStatus("Settings saved.");
  }

  return (
    <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.35em] text-pulse">Settings</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-white">Provider configuration</h1>
      <p className="mt-4 text-base leading-8 text-slate-300">
        Store local API keys for Spotify, OpenAI, and ElevenLabs. Environment variables still work and are preferred for
        deployment.
      </p>

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
          <p className="text-sm text-slate-400 mb-2">
            💡 内置 13 首精选中文歌单。如需实时搜索，请自行部署
            <a
              href="https://github.com/Binaryify/NeteaseCloudMusicApi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pulse underline"
            >
              网易云音乐 API
            </a>
            并填写下方地址。
          </p>
          <input
            type="text"
            value={settings.neteaseApiUrl}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                neteaseApiUrl: event.target.value
              }))
            }
            placeholder="API 地址（如：http://localhost:3000）"
            className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">本地音乐库</label>
          <p className="text-sm text-slate-400 mb-2">
            🎵 扫描本地音乐文件夹，支持 mp3, flac, wav, m4a, aac, ogg, opus, wma 等格式
          </p>
          <input
            type="text"
            value={settings.localMusicPath}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                localMusicPath: event.target.value
              }))
            }
            placeholder="音乐文件夹路径（如：/Users/xxx/Music）"
            className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-2">
            💡 Mac 用户建议：/Users/[你的用户名]/Music 或 /Users/[你的用户名]/Music/Music/Media.localized
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">优先音乐源</label>
          <select
            value={settings.preferredMusicSource}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                preferredMusicSource: event.target.value as RuntimeSettings["preferredMusicSource"]
              }))
            }
            className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
          >
            <option value="auto">自动（优先本地音乐）</option>
            <option value="local">本地音乐库</option>
            <option value="netease">网易云音乐</option>
            <option value="spotify">Spotify</option>
          </select>
        </div>
        <Field
          label="OpenAI API Key"
          type="password"
          value={settings.openAiApiKey}
          onChange={(value) => setSettings((current) => ({ ...current, openAiApiKey: value }))}
        />
        <Field
          label="ElevenLabs API Key"
          type="password"
          value={settings.elevenLabsApiKey}
          onChange={(value) => setSettings((current) => ({ ...current, elevenLabsApiKey: value }))}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">Default TTS Provider</label>
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
              <option value="moss">🤖 MOSS-TTS-Nano (本地0.1B引擎)</option>
              <option value="edge">🔥 Edge TTS (推荐！粤语超棒)</option>
              <option value="gemini">Gemini TTS</option>
              <option value="macsay">Mac Say (系统语音)</option>
              <option value="openai">OpenAI</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>          </div>
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
              className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none mb-4"
            >
              <option value="zh-CN">🇨🇳 普通话（推荐）</option>
              <option value="zh-HK">🇭🇰 粤语 Cantonese</option>
              <option value="en-US">🇺🇸 英语 English</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">DJ 语音</label>
            {availableVoices.length > 0 ? (
              <select
                value={settings.defaultVoice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    defaultVoice: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
              >
                {["zh-CN", "zh-HK", "en-US", "ja", "ko", "other"].map((lang) => {
                  const group = availableVoices.filter((v) => v.lang === lang);
                  if (group.length === 0) return null;
                  const labels: Record<string, string> = {
                    "zh-CN": "普通话", "zh-HK": "粤语", "en-US": "英语",
                    "ja": "日本語", "ko": "한국어", "other": "其他语言"
                  };
                  return (
                    <optgroup key={lang} label={labels[lang] || lang}>
                      {group.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={settings.defaultVoice}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, defaultVoice: event.target.value }))
                }
                className="w-full rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none"
                placeholder="输入语音 ID"
              />
            )}
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
              <option value="normal">😐 正常 - 标准语调</option>
              <option value="happy">😊 开心 - 欢快愉悦</option>
              <option value="calm">😌 平静 - 放松舒缓</option>
              <option value="excited">🤩 兴奋 - 充满活力</option>
              <option value="sad">😢 悲伤 - 低沉温柔</option>
              <option value="angry">😠 有力 - 激动有气势</option>
              <option value="whisper">🤫 耳语 - 低声私密</option>
              <option value="radio">📻 电台 - 专业主持风格</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">
              💡 情绪调整目前仅支持 ElevenLabs TTS Provider
            </p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-white">AI 功能</label>
          <label className="flex cursor-pointer items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={settings.enableAiNarration ?? true}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  enableAiNarration: event.target.checked
                }))
              }
              className="h-5 w-5 accent-pulse"
            />
            <span className="text-white">AI 智能旁白</span>
          </label>
          <p className="text-sm text-slate-400">
            使用 Gemini AI 生成更自然多样的开场白，关闭则使用固定模板。需要配置 GEMINI_API_KEY。
          </p>
        </div>

        <button className="rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.02]">
          Save Settings
        </button>
        {status ? <p className="text-sm text-mist">{status}</p> : null}
      </form>
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
