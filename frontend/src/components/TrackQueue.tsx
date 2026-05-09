import clsx from "clsx";
import type { Track } from "../types";

interface TrackQueueProps {
  tracks: Track[];
  currentTrackId: string | null;
  onSelect: (track: Track) => void;
}

export function TrackQueue({ tracks, currentTrackId, onSelect }: TrackQueueProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">Up Next</h3>
        <span className="text-xs uppercase tracking-[0.25em] text-mist">Queue</span>
      </div>
      <div className="space-y-3">
        {tracks.map((track, index) => (
          <button
            key={track.id}
            onClick={() => onSelect(track)}
            className={clsx(
              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
              currentTrackId === track.id
                ? "border-pulse/50 bg-pulse/10"
                : "border-white/5 bg-black/20 hover:bg-white/10"
            )}
          >
            <span className="w-6 text-xs uppercase tracking-[0.25em] text-mist">{String(index + 1).padStart(2, "0")}</span>
            <img src={track.artwork} alt={track.album} className="h-12 w-12 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{track.title}</p>
              <p className="truncate text-sm text-mist">{track.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
