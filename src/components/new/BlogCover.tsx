import { Newspaper } from "lucide-react";
import type { BlogCoverData } from "./blog-cover-data";

export function BlogCover({ cover }: { cover?: BlogCoverData | null }) {
  if (cover) {
    return (
      <figure className="tkp-cover tkp-cover-photo" data-tk="blog-cover" data-cover="photo">
        <img className="tkp-cover-img" src={cover.src} alt={cover.alt} style={{ objectPosition: cover.focus }} loading="eager" decoding="async" />
      </figure>
    );
  }
  return (
    <div className="tkp-cover" data-tk="blog-cover" aria-hidden="true">
      <span className="tkp-cover-icon">
        <Newspaper size={28} strokeWidth={2} />
      </span>
    </div>
  );
}
