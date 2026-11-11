"use client";

import { useState } from "react";
import { safePhoto } from "@/lib/media";
import { SmartImage } from "./SmartImage";
import { PlaceholderArt } from "./PlaceholderArt";
import { useFocusTrap } from "./useFocusTrap";

export function Gallery({
  photos,
  title,
  seed,
  category,
}: {
  photos: (string | null | undefined)[];
  title: string;
  seed: string;
  category?: string;
}) {
  const items = photos.map((photo) => safePhoto(photo)).filter((photo): photo is string => Boolean(photo));
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap(open, () => setOpen(false));

  if (!items.length) {
    return (
      <div data-tk="gallery">
        <div className="tk-tile" style={{ minHeight: 220 }}>
          <PlaceholderArt seed={seed} category={category} decorative />
        </div>
        <p className="t-small" style={{ color: "var(--muted)" }}>No photos yet</p>
      </div>
    );
  }

  const mosaic = items.slice(0, 4);

  return (
    <div data-tk="gallery">
      <div className="tk-gallery">
        <div className="tk-mosaic">
          {mosaic.map((photo, index) => (
            <button key={photo + index} type="button" className="tk-tile" onClick={() => setOpen(true)} aria-label={`Open photo ${index + 1}`}>
              <SmartImage src={photo} alt={`${title}, photo ${index + 1} of ${items.length}`} seed={`${seed}-${index}`} category={category} width={320} height={400} sizes="(max-width: 767px) 100vw, 50vw" fit="cover" priority={index === 0} />
            </button>
          ))}
        </div>
        <button type="button" className="tk-btn tk-btn-outline-rose tk-show-all" data-tk="show-all" onClick={() => setOpen(true)}>
          SHOW ALL
        </button>
      </div>
      {open ? (
        <div className="tk-sheet" role="dialog" aria-modal="true" aria-label="Photos" ref={ref}>
          <button type="button" className="tk-sheet-back" onClick={() => setOpen(false)}>
            &lt; Back
          </button>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {items.map((photo, index) => (
              <SmartImage key={photo + index} src={photo} alt={`${title}, photo ${index + 1} of ${items.length}`} seed={`${seed}-full-${index}`} category={category} width={800} height={600} sizes="100vw" fit="contain" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
