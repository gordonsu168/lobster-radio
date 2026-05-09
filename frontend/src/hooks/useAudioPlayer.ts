import { useEffect, useRef, useState } from "react";

export function useAudioPlayer(onTrackEnd?: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      onTrackEnd?.();
    };
    const onError = (e: Event) => {
      console.warn("Audio error:", (e.target as HTMLAudioElement).error);
      setIsPlaying(false);
    };
    
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [onTrackEnd]);

  function play(src: string) {
    if (!audioRef.current) {
      return;
    }

    // 同一切换逻辑，不等待 Promise
    audioRef.current.pause();
    audioRef.current.src = src;
    setCurrentSrc(src);
    audioRef.current.load();
    
    // 忽略 AbortError，这是正常行为
    audioRef.current.play().catch((e) => {
      if (e.name !== "AbortError") {
        console.warn("Playback failed:", e);
      }
    });
  }

  function pause() {
    audioRef.current?.pause();
  }

  function playBlobUrl(url: string) {
    play(url);
  }

  return { isPlaying, play, pause, playBlobUrl, currentSrc };
}
