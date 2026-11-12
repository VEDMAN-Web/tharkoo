"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordNotFoundAction } from "./notfound-beacon";

/** Counts this 404 once per page view (each visit counts; a re-render does not). Renders nothing. */
export function NotFoundBeacon() {
  const pathname = usePathname();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || sent.current === pathname) return;
    sent.current = pathname;
    void recordNotFoundAction(pathname, document.referrer).catch(() => undefined);
  }, [pathname]);
  return null;
}
