"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordNotFoundAction } from "./notfound-beacon";

/** Counts this 404 once per page view. Renders nothing. */
export function NotFoundBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const key = `nf:${pathname}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage can be blocked; count anyway */
    }
    void recordNotFoundAction(pathname, document.referrer).catch(() => undefined);
  }, [pathname]);
  return null;
}
