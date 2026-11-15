"use client";

import { useState } from "react";

/**
 * H7.4: the ad photo gallery in the New design. The main photo is shown whole (portrait photos are not cropped)
 * over a blurred copy of itself. Thumbnails below switch the main photo; each one is a 64 px button.
 */
export function NewGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[index];
  if (!current) {
    return <div className="tkn-gal tkn-gal-empty" aria-hidden="true" />;
  }
  return (
    <figure className="tkn-gal">
      <div className="tkn-gal-main">
        <img className="tkn-gal-blur" src={current} alt="" aria-hidden="true" loading="lazy" />
        <img className="tkn-gal-img" src={current} alt={`${title}, photo ${index + 1} of ${photos.length}`} />
      </div>
      {photos.length > 1 ? (
        <ul className="tkn-thumbs" aria-label="Photos">
          {photos.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button type="button" className="tkn-thumb" aria-label={`Show photo ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)}>
                <img src={src} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
