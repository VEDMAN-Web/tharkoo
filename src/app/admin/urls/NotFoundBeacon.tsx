"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Counts this 404 once per page view (each visit counts; a re-render does not). Renders nothing. */
export function NotFoundBeacon() {
  const pathname = usePathname();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || sent.current === pathname) return;
    sent.current = pathname;
    void fetch("/api/notfound/", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname, referrer: document.referrer }) }).catch(() => undefined);
  }, [pathname]);
  return null;
}
