import clsx from "clsx";

interface WaveformProps {
  active: boolean;
}

export function Waveform({ active }: WaveformProps) {
  return (
    <div className="flex h-28 items-end gap-2 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-glow">
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={index}
          className={clsx(
            "w-2 origin-bottom rounded-full bg-gradient-to-t from-coral via-pulse to-white transition-opacity",
            active ? "animate-pulsebar opacity-100" : "opacity-30"
          )}
          style={{
            height: `${20 + ((index * 13) % 65)}px`,
            animationDelay: `${index * 90}ms`
          }}
        />
      ))}
    </div>
  );
}
