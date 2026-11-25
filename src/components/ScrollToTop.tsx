"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useSitePath } from "@/components/useSitePath";

/**
 * A tap on a link to another page opens that page from the top, also from the bottom of a long page and on a phone.
 * Back and forward keep the browser's own place, a #hash link keeps its anchor, and a change of filters or page number
 * on the same page (same path) never jumps.
 */
export function ScrollToTop() {
  const pathname = useSitePath();
  const last = useRef(pathname);
  const fromHistory = useRef(false);

  useEffect(() => {
    const mark = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", mark);
    return () => window.removeEventListener("popstate", mark);
  }, []);

  // Before the new page is painted, so the visitor never sees it at the old scroll place.
  useLayoutEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const back = fromHistory.current;
    fromHistory.current = false;
    if (back || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // Some pages finish loading a moment later and can push the view down again; one more look after the first frame.
    const frame = window.requestAnimationFrame(() => {
      if (window.scrollY > 0 && !window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
