import { useEffect, useState, type FormEvent } from "react";
import { getSettings, saveSettings } from "../lib/api";
import type { RuntimeSettings } from "../types";

const initialState: RuntimeSettings = {
  spotifyClientId: "",
  spotifyClientSecret: "",
  neteaseApiEnabled: true,
  neteaseApiUrl: "",
  openAiApiKey: "",
  elevenLabsApiKey: "",
  defaultVoice: "alloy",
  defaultTtsProvider: "openai",
  preferredMusicSource: "auto",
  localMusicPath: ""
};

export function SettingsPage() {
  const [settings, setSettings] = useState<RuntimeSettings>(initialState);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => setStatus("Unable to load saved settings."));
  }, []);

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
              <option value="openai">OpenAI</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>
          <Field
            label="Default Voice"
            value={settings.defaultVoice}
            onChange={(value) => setSettings((current) => ({ ...current, defaultVoice: value }))}
          />
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
