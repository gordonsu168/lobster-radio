import type { PreferencesSnapshot } from "../types";

interface StatsStripProps {
  preferences: PreferencesSnapshot | null;
}

export function StatsStrip({ preferences }: StatsStripProps) {
  const likes = preferences?.likes.length ?? 0;
  const dislikes = preferences?.dislikes.length ?? 0;
  const history = preferences?.history.length ?? 0;
  const topMood = Object.entries(preferences?.moodAffinity ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None yet";

  const stats = [
    { label: "Liked Tracks", value: likes },
    { label: "Skipped Tracks", value: dislikes },
    { label: "Station History", value: history },
    { label: "Strongest Mood", value: topMood }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-mist">{stat.label}</p>
          <p className="mt-3 font-display text-2xl font-bold text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
