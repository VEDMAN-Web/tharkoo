import type { AdVideo } from "@/server/media/video";

export type GalleryItem =
  | { kind: "photo"; src: string }
  | { kind: "video"; src: string; poster: string | null; type: string };

export function buildGalleryItems(videos: AdVideo[], photos: string[]): GalleryItem[] {
  return [
    ...videos.map((video): GalleryItem => ({ kind: "video", src: video.url, poster: video.posterUrl, type: video.contentType })),
    ...photos.map((src): GalleryItem => ({ kind: "photo", src })),
  ];
}

export function wrapIndex(index: number, count: number): number {
  return count > 0 ? (index + count) % count : 0;
}
