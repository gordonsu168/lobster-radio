import clsx from "clsx";
import type { MoodOption } from "../types";

const moods: { label: MoodOption; accent: string; description: string }[] = [
  { label: "Working", accent: "from-sky-400 to-cyan-300", description: "Focused, steady, low-distraction picks" },
  { label: "Relaxing", accent: "from-emerald-300 to-teal-400", description: "Warm textures and easy transitions" },
  { label: "Exercising", accent: "from-orange-400 to-rose-400", description: "High tempo, lift, and momentum" },
  { label: "Party", accent: "from-fuchsia-400 to-amber-300", description: "Big hooks and high-energy rotation" },
  { label: "Sleepy", accent: "from-indigo-400 to-blue-200", description: "Soft landings and lower stimulation" }
];

interface MoodSelectorProps {
  value: MoodOption;
  onChange: (mood: MoodOption) => void;
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {moods.map((mood) => {
        const active = mood.label === value;
        return (
          <button
            key={mood.label}
            onClick={() => onChange(mood.label)}
            className={clsx(
              "rounded-3xl border px-4 py-4 text-left transition",
              active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
            )}
          >
            <span className={clsx("mb-3 block h-2 rounded-full bg-gradient-to-r", mood.accent)} />
            <span className="block font-display text-lg font-semibold text-white">{mood.label}</span>
            <span className="mt-1 block text-sm text-mist">{mood.description}</span>
          </button>
        );
      })}
    </div>
  );
}
