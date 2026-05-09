import {
  HandThumbDownIcon,
  HandThumbUpIcon,
  PauseIcon,
  PlayIcon,
  SpeakerWaveIcon
} from "@heroicons/react/24/solid";
import type { Track, VoiceOption, DJStyle } from "../types";

const voices: VoiceOption[] = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
  "elevenlabs-rachel",
  "elevenlabs-adam"
];

interface PlayerCardProps {
  track: Track | null;
  narration: string;
  voice: VoiceOption;
  djStyle: DJStyle;
  isPlaying: boolean;
  autoChatEnabled: boolean;
  onPlayTrack: () => void;
  onPlayNarration: () => void;
  onDJChat: () => void;
  onVoiceChange: (voice: VoiceOption) => void;
  onDjStyleChange: (style: DJStyle) => void;
  onFeedback: (feedback: "like" | "dislike") => void;
  onNextTrack: () => void;
  onAutoChatToggle: (enabled: boolean) => void;
}

export function PlayerCard({
  track,
  narration,
  voice,
  djStyle,
  isPlaying,
  autoChatEnabled,
  onPlayTrack,
  onPlayNarration,
  onDJChat,
  onVoiceChange,
  onDjStyleChange,
  onFeedback,
  onNextTrack,
  onAutoChatToggle
}: PlayerCardProps) {
  if (!track) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <p className="text-mist">Select a mood to start your station.</p>
      </div>
    );
  }

  return (
    <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div>
          <div className="flex flex-col gap-5 md:flex-row">
            <img src={track.artwork} alt={track.album} className="h-44 w-44 rounded-[28px] object-cover shadow-glow" />
            <div className="flex-1">
              <span className="rounded-full border border-pulse/40 bg-pulse/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-pulse">
                {track.source}
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold text-white">{track.title}</h2>
              <p className="mt-2 text-lg text-mist">{track.artist}</p>
              <p className="mt-1 text-sm text-mist/90">{track.album}</p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">{track.explanation}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={onPlayTrack}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.02]"
                >
                  {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                  {track.previewUrl ? (isPlaying ? "Pause Preview" : "Play Preview") : "Play Demo Clip"}
                </button>
                <button
                  onClick={onPlayNarration}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  <SpeakerWaveIcon className="h-5 w-5" />
                  Play DJ Intro
                </button>
                <button
                  onClick={onDJChat}
                  className="inline-flex items-center gap-2 rounded-full border border-pulse/40 bg-pulse/10 px-5 py-3 font-semibold text-pulse transition hover:bg-pulse/20"
                >
                  🎤 DJ 插句话
                </button>
                <button
                  onClick={() => onNextTrack()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Skip →
                </button>
                <button
                  onClick={() => onFeedback("like")}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 px-4 py-3 text-emerald-200 transition hover:bg-emerald-400/10"
                >
                  <HandThumbUpIcon className="h-5 w-5" />
                  Like
                </button>
                <button
                  onClick={() => onFeedback("dislike")}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 px-4 py-3 text-rose-200 transition hover:bg-rose-400/10"
                >
                  <HandThumbDownIcon className="h-5 w-5" />
                  Dislike
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <p className="font-display text-lg font-semibold text-white">DJ 旁白</p>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoChatEnabled}
                    onChange={(e) => onAutoChatToggle(e.target.checked)}
                    className="w-4 h-4 accent-pulse"
                  />
                  自动插话
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={voice}
                  onChange={(event) => onVoiceChange(event.target.value as VoiceOption)}
                  className="rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
                >
                  {voices.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={djStyle}
                  onChange={(event) => onDjStyleChange(event.target.value as DJStyle)}
                  className="rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
                >
                  <option value="classic">🎙️ 经典电台风</option>
                  <option value="night">🌙 深夜治愈风</option>
                  <option value="vibe">🔥 活力蹦迪风</option>
                  <option value="trivia">💡 冷知识科普风</option>
                </select>
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-200">{narration}</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-mist">Mood Tags</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {track.moodTags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-3 py-2 text-sm text-slate-200">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.25em] text-mist">Energy</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-pulse to-coral" style={{ width: `${track.energy}%` }} />
            </div>
          </div>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.25em] text-mist">Why It Fits</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Lobster Radio weighs your mood, time-of-day, prior likes, and recent skips to keep the station moving in the
              right direction.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
