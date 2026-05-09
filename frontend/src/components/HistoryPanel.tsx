import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/solid";
import type { PlaybackHistoryItem } from "../types";

interface HistoryPanelProps {
  history: PlaybackHistoryItem[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">Recently Played</h3>
        <span className="text-xs uppercase tracking-[0.25em] text-mist">History</span>
      </div>
      <div className="space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-mist">No tracks played yet. Start your station to build a personalized timeline.</p>
        ) : (
          history.slice(0, 8).map((item) => (
            <div key={`${item.id}-${item.playedAt}`} className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="flex items-start gap-3">
                <img src={item.artwork} alt={item.album} className="h-14 w-14 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{item.title}</p>
                  <p className="truncate text-sm text-mist">{item.artist}</p>
                  <p className="mt-1 text-xs text-mist">{new Date(item.playedAt).toLocaleString()}</p>
                </div>
                {item.feedback === "like" ? <HandThumbUpIcon className="h-5 w-5 text-emerald-300" /> : null}
                {item.feedback === "dislike" ? <HandThumbDownIcon className="h-5 w-5 text-rose-300" /> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
