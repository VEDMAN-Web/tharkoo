export type CardSlide = { kind: "video"; src: string; poster: string | null } | { kind: "image"; src: string };

export const IMAGE_MS = 3000;
export const VIDEO_CAP_MS = 15000;
export const OFFSET_MS = 600;
export const CALM_MS = 6000;
export const VISIBLE_SHARE = 0.5;
export const MAX_VIDEOS_DESKTOP = 4;
export const MAX_VIDEOS_PHONE = 1;

export function cardSlides(photos: string[], videoUrl?: string | null, videoPoster?: string | null): CardSlide[] {
  const images: CardSlide[] = photos.map((src) => ({ kind: "image", src }));
  return videoUrl ? [{ kind: "video", src: videoUrl, poster: videoPoster || photos[0] || null }, ...images] : images;
}

/** The next slide, looping. When video is off (data saver, no free player) the video slide is skipped. */
export function nextSlide(index: number, slides: CardSlide[], withVideo: boolean): number {
  if (slides.length === 0) return 0;
  let next = (index + 1) % slides.length;
  if (!withVideo && slides[next]?.kind === "video" && slides.length > 1) next = (next + 1) % slides.length;
  return next;
}

/**
 * How long to wait before the card moves on from an image, or starts a video. The first move of each card is offset by
 * its place in the grid (600 ms each) so cards do not flip together. After a manual move the card stays calm for 6 s.
 */
export function slideDelay(input: { kind: "video" | "image"; first: boolean; order: number; now: number; calmUntil: number }): number {
  const offset = input.first ? input.order * OFFSET_MS : 0;
  const base = input.kind === "image" ? IMAGE_MS + offset : offset;
  return Math.max(base, input.calmUntil - input.now);
}
