import { MAX_VIDEOS_DESKTOP, MAX_VIDEOS_PHONE } from "./card-slides";

const playing = new Set<HTMLVideoElement>();

function limit() {
  return typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768) ? MAX_VIDEOS_PHONE : MAX_VIDEOS_DESKTOP;
}

/** Plays this video if fewer than the allowed number are playing (4 on a computer, 1 on a phone). Returns false when there is no free place. */
export function takeVideo(video: HTMLVideoElement): boolean {
  if (!playing.has(video) && playing.size >= limit()) return false;
  playing.add(video);
  video.muted = true;
  void video.play().catch(() => undefined);
  return true;
}

export function releaseVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  playing.delete(video);
  video.pause();
}

export function videosPlaying() {
  return playing.size;
}
