"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./home-ads.css";

export function HomeAdsSection({
  id,
  eyebrow,
  title,
  listLabel,
  moreHref,
  moreText,
  prevLabel,
  nextLabel,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  listLabel: string;
  moreHref: string;
  moreText: string;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdge({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function move(direction: 1 | -1) {
    const row = rowRef.current;
    const first = row?.firstElementChild as HTMLElement | null;
    if (!row || !first) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const stepPx = first.getBoundingClientRect().width + gap;
    const visible = Math.max(1, Math.floor((row.clientWidth + gap) / stepPx));
    row.scrollBy({ left: direction * visible * stepPx, behavior: "smooth" });
  }

  return (
    <section className="tkh-page tkh-section" aria-labelledby={id}>
      <div className="tkh-head">
        <div>
          <p className="tkh-eyebrow tkh-eyebrow-lavender">{eyebrow}</p>
          <h2 id={id} className="tkh-h2">
            {title}
          </h2>
        </div>
        <div className="tkh-head-tools">
          <Link className="tkh-more" href={moreHref} prefetch={false}>
            {moreText}
          </Link>
          <div className="tkh-row-arrows">
            <button type="button" className="tkh-row-arrow" aria-label={prevLabel} data-tk="ads-prev" disabled={edge.start} onClick={() => move(-1)}>
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" className="tkh-row-arrow" aria-label={nextLabel} data-tk="ads-next" disabled={edge.end} onClick={() => move(1)}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <ul className="tkh-ads" aria-label={listLabel} ref={rowRef} onScroll={measure} data-tk="ads-row">
        {children}
      </ul>
    </section>
  );
}
