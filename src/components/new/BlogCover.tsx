import { Newspaper } from "lucide-react";

export function BlogCover() {
  return (
    <div className="tkp-cover" data-tk="blog-cover" aria-hidden="true">
      <span className="tkp-cover-icon">
        <Newspaper size={28} strokeWidth={2} />
      </span>
    </div>
  );
}
