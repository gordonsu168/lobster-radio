import { useEffect, useState } from "react";
import type { SongWiki } from "../types";

export function WikiPage() {
  const [songs, setSongs] = useState<SongWiki[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongWiki | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 加载所有歌曲
  useEffect(() => {
    fetch("http://localhost:4000/api/wiki")
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      await fetch(`http://localhost:4000/api/wiki/song/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      // 重新加载
      const res = await fetch("http://localhost:4000/api/wiki");
      const newData = await res.json();
      setSongs(newData.songs);
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-white">🎵 歌曲 Wiki 数据库</h1>
        <span className="rounded-full bg-white/10 px-4 py-2 text-white">
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
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white placeholder-white/50 outline-none focus:border-cyan-400/50"
        />
      </div>

      {/* 内容区 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：歌曲列表 */}
        <div className="lg:col-span-1">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            {loading ? (
              <p className="p-4 text-white/50">加载中...</p>
            ) : filteredSongs.length === 0 ? (
              <p className="p-4 text-white/50">没有找到歌曲</p>
            ) : (
              filteredSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className={`w-full rounded-xl p-3 text-left transition hover:bg-white/10 ${
                    selectedSong?.id === song.id ? "bg-white/10" : ""
                  }`}
                >
                  <p className="font-semibold text-white truncate">{song.title}</p>
                  <p className="text-sm text-white/60 truncate">{song.artist} - {song.album}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右侧：编辑面板 */}
        <div className="lg:col-span-2">
          {!selectedSong ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50">
              从左侧选择一首歌开始编辑
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="font-display text-xl font-bold text-white">
                编辑：{selectedSong.title}
              </h2>

              {/* 基本信息 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block pb-2 text-sm text-white/70">歌曲名</label>
                  <input
                    type="text"
                    value={selectedSong.title}
                    onChange={(e) => setSelectedSong({ ...selectedSong, title: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block pb-2 text-sm text-white/70">歌手</label>
                  <input
                    type="text"
                    value={selectedSong.artist}
                    onChange={(e) => setSelectedSong({ ...selectedSong, artist: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block pb-2 text-sm text-white/70">专辑</label>
                  <input
                    type="text"
                    value={selectedSong.album}
                    onChange={(e) => setSelectedSong({ ...selectedSong, album: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block pb-2 text-sm text-white/70">发行年份</label>
                  <input
                    type="number"
                    value={selectedSong.releaseYear || ""}
                    onChange={(e) =>
                      setSelectedSong({
                        ...selectedSong,
                        releaseYear: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              {/* 趣闻/冷知识 */}
              <div>
                <label className="block pb-2 text-sm text-white/70">歌曲趣闻（每行一条）</label>
                <textarea
                  value={selectedSong.trivia?.join("\n") || ""}
                  onChange={(e) =>
                    setSelectedSong({
                      ...selectedSong,
                      trivia: e.target.value.split("\n").filter((t) => t.trim())
                    })
                  }
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-cyan-400/50"
                  placeholder="输入这首歌的有趣故事、背景故事..."
                />
              </div>

              {/* 保存按钮 */}
              <button
                onClick={() => saveSong(selectedSong.id, selectedSong)}
                className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-white transition hover:bg-cyan-400"
              >
                保存到 Wiki
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
