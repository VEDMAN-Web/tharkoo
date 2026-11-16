"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SimilarRow({
  title,
  allText,
  allHref,
  listLabel,
  prevLabel,
  nextLabel,
  children,
}: {
  title: string;
  allText: string;
  allHref: string;
  listLabel: string;
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}) {
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true, scrolls: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1, scrolls: el.scrollWidth > el.clientWidth + 1 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function move(direction: 1 | -1) {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = first.getBoundingClientRect().width + gap;
    const visible = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    el.scrollBy({ left: direction * visible * step, behavior: "smooth" });
  }

  return (
    <section className="tkn-similar" aria-labelledby="tkn-similar" data-tk="similar-ads">
      <div className="tkn-similar-head">
        <h2 id="tkn-similar">{title}</h2>
        <div className="tkn-similar-tools">
          <Link href={allHref} className="tkn-similar-all">{allText}</Link>
          {edge.scrolls ? (
            <div className="tkn-similar-arrows">
              <button type="button" className="tkn-similar-arrow" aria-label={prevLabel} data-tk="similar-prev" disabled={edge.start} onClick={() => move(-1)}>
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button type="button" className="tkn-similar-arrow" aria-label={nextLabel} data-tk="similar-next" disabled={edge.end} onClick={() => move(1)}>
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ul className="tkn-similar-grid" aria-label={listLabel} ref={row} onScroll={measure} data-tk="similar-row">
        {children}
      </ul>
    </section>
  );
}
