export interface NarrationAudioResult {
  audio: HTMLAudioElement;
  url: string;
}

export function createNarrationAudio(
  audioBase64: string,
  mimeType: string | null,
  onComplete: () => void,
  onError: () => void
): NarrationAudioResult {
  const binary = atob(audioBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || "audio/mpeg" });
  const url = URL.createObjectURL(blob);

  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";

  const handleEnded = () => {
    cleanupNarrationAudio(audio, url);
    onComplete();
  };

  const handleError = () => {
    cleanupNarrationAudio(audio, url);
    onError();
  };

  audio.addEventListener("ended", handleEnded, { once: true });
  audio.addEventListener("error", handleError, { once: true });

  return { audio, url };
}

export function cleanupNarrationAudio(audio: HTMLAudioElement, url: string): void {
  audio.pause();
  URL.revokeObjectURL(url);
}
