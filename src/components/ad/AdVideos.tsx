import type { AdVideo } from "@/server/media/video";
import { ReelVideo } from "./ReelVideo";

/** The ad page video strip: up to 2 clips, each a 9:16 tile that plays while on screen. */
export function AdVideos({ videos, title }: { videos: AdVideo[]; title: string }) {
  if (videos.length === 0) return null;
  return (
    <section className="tk-container" aria-label="Videos" data-tk="ad-videos" style={{ paddingTop: 8, paddingBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {videos.map((video, index) => (
          <div key={video.id} style={{ flex: "0 1 260px", aspectRatio: "9 / 16", maxWidth: "100%" }}>
            <ReelVideo src={video.url} poster={video.posterUrl} type={video.contentType} label={`${title} video ${index + 1}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
