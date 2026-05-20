import { useEffect, useState } from "react";
import type { SongWiki } from "../types";

export function WikiPage() {
  const [songs, setSongs] = useState<SongWiki[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongWiki | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 加载所有歌曲
  const loadData = () => {
    fetch("/api/wiki")
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // 搜索过滤
  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.album.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 保存歌曲信息
  const saveSong = async (id: string, data: Partial<SongWiki>) => {
    try {
      await fetch(`/api/wiki/song/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, lastUpdated: new Date().toISOString() })
      });
      loadData();
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const forceEnrich = async (id: string) => {
    try {
      await fetch(`/api/wiki/song/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrichmentStatus: "pending" })
      });
      // The background job isn't directly exposed via REST yet, 
      // but setting it to pending ensures the stream will pick it up, 
      // or we can just mock a refresh for now.
      alert("Status set to pending. Play this track in Stream mode to trigger enrichment.");
      loadData();
    } catch (e) {
      console.error("Set pending failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-white">🎵 歌曲 Wiki 数据库</h1>
        <span className="rounded-full bg-white/10 px-4 py-2 text-white text-sm font-medium">
          {songs.length} 首歌曲
        </span>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          placeholder="搜索歌曲、歌手、专辑..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white placeholder-white/50 outline-none focus:border-pulse/50 transition-colors"
        />
      </div>

      {/* 内容区 */}
      <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-200px)] min-h-[600px]">
        {/* 左侧：歌曲列表 */}
        <div className="lg:col-span-1 flex flex-col rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
             <span className="text-sm font-semibold text-white/70">曲库列表</span>
             <span className="text-xs text-white/40">已完成: {songs.filter(s => s.enrichmentStatus === 'completed').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <p className="p-4 text-center text-white/50 text-sm">加载中...</p>
            ) : filteredSongs.length === 0 ? (
              <p className="p-4 text-center text-white/50 text-sm">没有找到歌曲</p>
            ) : (
              filteredSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className={`w-full flex flex-col items-start rounded-xl p-3 text-left transition ${
                    selectedSong?.id === song.id ? "bg-pulse/20 border border-pulse/30" : "hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <div className="flex w-full justify-between items-center mb-1">
                    <p className="font-semibold text-white truncate pr-2">{song.title}</p>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      song.enrichmentStatus === 'completed' ? 'bg-green-500' :
                      song.enrichmentStatus === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} title={`Status: ${song.enrichmentStatus}`}></div>
                  </div>
                  <p className="text-xs text-white/60 truncate w-full">{song.artist} - {song.album}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右侧：编辑面板 */}
        <div className="lg:col-span-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          {!selectedSong ? (
            <div className="flex h-full items-center justify-center text-white/50">
              从左侧选择一首歌开始查看或编辑硬核事实
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white mb-1">
                    {selectedSong.title}
                  </h2>
                  <p className="text-mist text-sm">{selectedSong.artist} • {selectedSong.album}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
                    selectedSong.enrichmentStatus === 'completed' ? 'bg-green-500/20 text-green-400' :
                    selectedSong.enrichmentStatus === 'failed' ? 'bg-red-500/20 text-red-400' : 
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedSong.enrichmentStatus || 'unknown'}
                  </span>
                  <button 
                    onClick={() => forceEnrich(selectedSong.id)}
                    className="text-[10px] text-white/40 hover:text-white underline"
                  >
                    Mark Pending
                  </button>
                </div>
              </div>

              {/* 基本事实 */}
              <div>
                <h3 className="text-sm font-bold text-pulse uppercase tracking-widest mb-4">Hard Facts</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">作词 (Lyricist)</label>
                    <input
                      type="text"
                      value={selectedSong.lyricist || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, lyricist: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50"
                    />
                  </div>
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">作曲 (Composer)</label>
                    <input
                      type="text"
                      value={selectedSong.composer || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, composer: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50"
                    />
                  </div>
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">编曲 (Arranger)</label>
                    <input
                      type="text"
                      value={selectedSong.arranger || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, arranger: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50"
                    />
                  </div>
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">发行年份 (Year)</label>
                    <input
                      type="number"
                      value={selectedSong.releaseYear || ""}
                      onChange={(e) =>
                        setSelectedSong({
                          ...selectedSong,
                          releaseYear: e.target.value ? Number(e.target.value) : undefined
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50"
                    />
                  </div>
                </div>
              </div>

              {/* 原始素材 */}
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-pulse uppercase tracking-widest mb-4">Original Materials</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">真实趣闻 (Trivia)</label>
                    <textarea
                      value={selectedSong.trivia?.join("\n") || ""}
                      onChange={(e) =>
                        setSelectedSong({
                          ...selectedSong,
                          trivia: e.target.value.split("\n").filter((t) => t.trim())
                        })
                      }
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50 resize-y"
                      placeholder="百科上的客观事实、记录..."
                    />
                  </div>
                  
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">网易云热评 (Hot Comments)</label>
                    <textarea
                      value={selectedSong.hotComments?.join("\n---\n") || ""}
                      onChange={(e) =>
                        setSelectedSong({
                          ...selectedSong,
                          hotComments: e.target.value.split("\n---\n").filter((t) => t.trim())
                        })
                      }
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50 resize-y"
                      placeholder="每条评论用 --- 分隔"
                    />
                  </div>

                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">维基摘要 (Wiki Abstract)</label>
                    <textarea
                      value={selectedSong.wikiAbstract || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, wikiAbstract: e.target.value })}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50 resize-y"
                      placeholder="维基百科爬取的原始长段落摘要..."
                    />
                  </div>

                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">歌词 (Lyrics)</label>
                    <textarea
                      value={selectedSong.lyric || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, lyric: e.target.value })}
                      rows={6}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-mono text-white outline-none focus:border-pulse/50 resize-y"
                      placeholder="歌曲完整歌词..."
                    />
                  </div>
                </div>
              </div>

              {/* 外部关联 */}
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-pulse uppercase tracking-widest mb-4">External Links</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block pb-1 text-xs text-white/50 uppercase">网易云 ID</label>
                    <input
                      type="text"
                      value={selectedSong.neteaseId || ""}
                      onChange={(e) => setSelectedSong({ ...selectedSong, neteaseId: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-pulse/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="pt-6 flex justify-end">
                <button
                  onClick={() => saveSong(selectedSong.id, selectedSong)}
                  className="rounded-xl bg-pulse px-8 py-3 font-bold text-black transition hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(var(--color-pulse),0.3)]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
