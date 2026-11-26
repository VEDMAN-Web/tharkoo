"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "./listing-pager.css";
import { pageHref, pagerItems, showingRange } from "./listing-pager";

export type PagerLabels = {
  nav: string;
  prev: string;
  prevShort: string;
  next: string;
  showing: string;
  status: string;
  pageLabel: string;
};

const SCROLL_OFFSET = 96;

/** A new page of ads opens at the start of the list; at the top of the page when there is no list to find. */
function scrollToResults() {
  const target = document.querySelector<HTMLElement>('[data-tk="listing-grid"], .tk-feed');
  const top = target ? target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET : 0;
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

export function ListingPager({ base, page, pages, total, size, labels }: { base: string; page: number; pages: number; total: number; size: number; labels: PagerLabels }) {
  const previous = useRef(page);
  useEffect(() => {
    if (previous.current !== page) scrollToResults();
    previous.current = page;
  }, [page]);
  if (pages <= 1) return null;
  const { from, to } = showingRange(page, size, total);
  return (
    <div className="tkp-wrap" data-tk="pager">
      <p className="tkp-showing">{labels.showing.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total))}</p>
      <nav className="tkp" aria-label={labels.nav}>
        {page > 1 ? (
          <Link className="tkp-btn tkp-prev" href={pageHref(base, page - 1)} rel="prev" scroll={false} prefetch={false}>
            <span aria-hidden="true">‹</span>
            <span className="tkp-long">{labels.prev}</span>
            <span className="tkp-short">{labels.prevShort}</span>
          </Link>
        ) : (
          <span className="tkp-btn tkp-prev is-off" aria-disabled="true">
            <span aria-hidden="true">‹</span>
            <span className="tkp-long">{labels.prev}</span>
            <span className="tkp-short">{labels.prevShort}</span>
          </span>
        )}
        <span className="tkp-status">{labels.status.replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
        {pagerItems(page, pages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="tkp-gap" aria-hidden="true">
              …
            </span>
          ) : item === page ? (
            <span key={item} className="tkp-btn tkp-num is-current" aria-current="page" aria-label={labels.pageLabel.replace("{page}", String(item))}>
              {item}
            </span>
          ) : (
            <Link key={item} className="tkp-btn tkp-num" href={pageHref(base, item)} aria-label={labels.pageLabel.replace("{page}", String(item))} scroll={false} prefetch={false}>
              {item}
            </Link>
          ),
        )}
        {page < pages ? (
          <Link className="tkp-btn tkp-next" href={pageHref(base, page + 1)} rel="next" scroll={false} prefetch={false}>
            <span className="tkp-long">{labels.next}</span>
            <span className="tkp-short">{labels.next}</span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span className="tkp-btn tkp-next is-off" aria-disabled="true">
            <span className="tkp-long">{labels.next}</span>
            <span className="tkp-short">{labels.next}</span>
            <span aria-hidden="true">›</span>
          </span>
        )}
      </nav>
    </div>
  );
}
