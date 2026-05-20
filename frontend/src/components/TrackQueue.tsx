import clsx from "clsx";
import type { Track } from "../types";

interface TrackQueueProps {
  tracks: Track[];
  currentTrackId: string | null;
  onSelect: (track: Track) => void;
  compact?: boolean;
}

export function TrackQueue({ tracks, currentTrackId, onSelect, compact = false }: TrackQueueProps) {
  return (
    <div className={clsx("rounded-[28px] border border-white/10 bg-white/5", compact ? "p-4" : "p-5")}>
      <div className={clsx("flex items-center justify-between", compact ? "mb-3" : "mb-4")}>
        <h3 className={clsx("font-display font-semibold text-white", compact ? "text-base" : "text-lg")}>Up Next</h3>
        <span className="text-[10px] uppercase tracking-[0.25em] text-mist">Queue</span>
      </div>
      <div className={clsx("space-y-2", !compact && "space-y-3")}>
        {tracks.map((track, index) => (
          <button
            key={track.id}
            onClick={() => onSelect(track)}
            className={clsx(
              "flex w-full items-center gap-3 rounded-2xl border text-left transition",
              compact ? "p-2" : "p-3",
              currentTrackId === track.id
                ? "border-pulse/50 bg-pulse/10"
                : "border-white/5 bg-black/20 hover:bg-white/10"
            )}
          >
            <span className="w-5 text-[10px] uppercase tracking-[0.25em] text-mist">{String(index + 1).padStart(2, "0")}</span>
            {!compact && <img src={track.artwork} alt={track.album} className="h-12 w-12 rounded-2xl object-cover" />}
            <div className="min-w-0 flex-1">
              <p className={clsx("truncate font-semibold text-white", compact ? "text-sm" : "text-base")}>{track.title}</p>
              <p className={clsx("truncate text-mist", compact ? "text-xs" : "text-sm")}>{track.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
