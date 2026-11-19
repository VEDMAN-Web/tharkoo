"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, CONSENT_KEY, GA_READY_EVENT, cleanGaId, cleanPageLocation, flushGaQueue, gaInitScript, gaMayLoad, gaScriptSrc, isPublicPath, markGaWanted } from "@/lib/analytics/ga";

type GaWindow = Window & { gtag?: (command: string, ...args: unknown[]) => void; __tkGa?: boolean };

function readConsent(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function onConsent(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  return () => window.removeEventListener(CONSENT_EVENT, callback);
}

function onReady(callback: () => void) {
  window.addEventListener(GA_READY_EVENT, callback);
  return () => window.removeEventListener(GA_READY_EVENT, callback);
}

/**
 * H17.11: Google Analytics 4. Mounted only inside the public site chrome (never an admin screen). Nothing is requested
 * from Google until the visitor chose Accept on the cookie notice; with "Only necessary" nothing ever loads.
 * The page view is sent by hand with the address minus its query string, so a search word never leaves the site.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const id = cleanGaId(measurementId);
  const pathname = usePathname() || "/";
  // The server renders nothing (no choice known); the browser reads the saved choice and follows the notice.
  const consent = useSyncExternalStore(onConsent, readConsent, () => null);
  const ready = useSyncExternalStore(onReady, () => Boolean((window as GaWindow).__tkGa), () => false);
  const mayLoad = gaMayLoad({ id, pathname, consent });

  // This page may send events (after Accept): public page with an ID set. A layout effect, so it is set before the page's own effects send their first event.
  useLayoutEffect(() => {
    markGaWanted(id !== "" && isPublicPath(pathname));
    return () => markGaWanted(false);
  }, [id, pathname]);

  useEffect(() => {
    if (!mayLoad || !ready) return;
    const w = window as GaWindow;
    if (typeof w.gtag !== "function") return;
    const location = cleanPageLocation(window.location.origin, pathname);
    w.gtag("set", { page_location: location, page_path: pathname, page_title: pathname });
    w.gtag("event", "page_view", { page_location: location, page_path: pathname, page_title: pathname });
    flushGaQueue();
  }, [mayLoad, ready, pathname]);

  if (!mayLoad) return null;
  return (
    <>
      <Script id="tk-ga-src" src={gaScriptSrc(id)} strategy="afterInteractive" />
      <Script id="tk-ga-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gaInitScript(id) }} />
    </>
  );
}
