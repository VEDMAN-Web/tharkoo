/**
 * H17.11: Google Analytics 4, the rules in one client-safe place.
 * The measurement ID is an admin setting (empty = no tag). The tag loads only on public pages, only after a visitor
 * chose Accept, and every event carries only the fields listed here: never a name, phone, email, user id, ad text or search text.
 */

/** A GA4 web measurement ID such as G-TRCWRYJSZ1. Anything else is not stored. */
export const GA_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/** The localStorage key the cookie notice already uses; "all" means Accept, "necessary" means Only necessary. */
export const CONSENT_KEY = "nl-cookies";
/** The browser event the cookie notice sends when the visitor chooses. */
export const CONSENT_EVENT = "tk-cookies";
/** The browser event the start-up script sends once the tag is set up. */
export const GA_READY_EVENT = "tk-ga-ready";

export function cleanGaId(value: unknown): string {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return GA_ID_PATTERN.test(text) ? text : "";
}

export function consentGranted(stored: string | null | undefined): boolean {
  return stored === "all";
}

/** Public pages only: no admin screen and no tool page ever loads the tag. */
export function isPublicPath(pathname: string): boolean {
  return !(/^\/admin(\/|$)/.test(pathname) || /^\/styleguide(\/|$)/.test(pathname));
}

/** Whether the tag may load now: an ID is set, the page is public and the visitor accepted. */
export function gaMayLoad(input: { id: string; pathname: string; consent: string | null | undefined }): boolean {
  return cleanGaId(input.id) !== "" && isPublicPath(input.pathname) && consentGranted(input.consent);
}

/** The page address sent to Google: the origin and the path, never the query string or the hash. */
export function cleanPageLocation(origin: string, pathname: string): string {
  return `${origin.replace(/\/$/, "")}${pathname.split("?")[0].split("#")[0]}`;
}

export type GaEventName = "sign_up" | "login" | "post_ad_start" | "post_ad_published" | "contact_click" | "ad_view" | "search" | "save_ad" | "page_view";

/** The only parameters each event may carry, and the values allowed for each. */
const ALLOWED: Record<GaEventName, Record<string, RegExp>> = {
  sign_up: { method: /^(email|phone|code)$/ },
  login: { method: /^(email|phone|code)$/ },
  post_ad_start: {},
  post_ad_published: { category: /^[a-z0-9-]{1,60}$/ },
  contact_click: { method: /^(chat|call|whatsapp)$/, category: /^[a-z0-9-]{1,60}$/, city: /^[a-z0-9-]{1,60}$/ },
  ad_view: { category: /^[a-z0-9-]{1,60}$/, city: /^[a-z0-9-]{1,60}$/ },
  search: { category: /^[a-z0-9-]{1,60}$/, city: /^[a-z0-9-]{1,60}$/ },
  save_ad: { category: /^[a-z0-9-]{1,60}$/, city: /^[a-z0-9-]{1,60}$/ },
  page_view: { page_location: /^https?:\/\/[^?#\s]+$/, page_path: /^\/[^?#\s]*$/, page_title: /^\/[^?#\s]*$/ },
};

/** Keeps only the allowed parameters with allowed values (slugs and fixed words). Free text never passes. */
export function safeEventParams(name: GaEventName, params: Record<string, unknown> = {}): Record<string, string> {
  const rules = ALLOWED[name] ?? {};
  const out: Record<string, string> = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = params[key];
    if (typeof value === "string" && rule.test(value)) out[key] = value;
  }
  return out;
}

type Gtag = (command: string, ...args: unknown[]) => void;
type Queued = [Exclude<GaEventName, "page_view">, Record<string, string>];
type GaWindow = Window & { gtag?: Gtag; __tkGa?: boolean; __tkGaWanted?: boolean; __tkGaQueue?: Queued[] };
const QUEUE_MAX = 20;

function storedConsent(w: GaWindow): string | null {
  try {
    return w.localStorage?.getItem(CONSENT_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Sends one event, only when the tag is loaded (so only after Accept). A page's own first events can happen a moment before
 * the tag has loaded: those wait in a short queue, but only for a visitor who already accepted. Without Accept this does nothing.
 * It never throws.
 */
export function trackEvent(name: Exclude<GaEventName, "page_view">, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as GaWindow;
  try {
    const safe = safeEventParams(name, params);
    if (w.__tkGa && typeof w.gtag === "function") {
      w.gtag("event", name, safe);
      return;
    }
    if (w.__tkGaWanted && consentGranted(storedConsent(w))) {
      const queue = (w.__tkGaQueue ??= []);
      queue.push([name, safe]);
      if (queue.length > QUEUE_MAX) queue.shift();
    }
  } catch {
    /* analytics must never break a page */
  }
}

/** Marks that this page may send events once the visitor has accepted (set by the tag component on public pages). */
export function markGaWanted(wanted: boolean): void {
  if (typeof window !== "undefined") (window as GaWindow).__tkGaWanted = wanted;
}

/** Sends what waited for the tag, once it is loaded. */
export function flushGaQueue(): void {
  if (typeof window === "undefined") return;
  const w = window as GaWindow;
  if (!w.__tkGa || typeof w.gtag !== "function") return;
  const queue = w.__tkGaQueue ?? [];
  w.__tkGaQueue = [];
  for (const [name, safe] of queue) w.gtag("event", name, safe);
}

/** The inline start-up script: consent denied by default, no Google signals, no ad personalisation, no automatic page view. */
export function gaInitScript(id: string): string {
  const safe = cleanGaId(id);
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});",
    "gtag('js',new Date());",
    `gtag('config','${safe}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});`,
    "gtag('consent','update',{analytics_storage:'granted'});",
    "window.__tkGa=true;",
    "window.dispatchEvent(new Event('tk-ga-ready'));",
  ].join("");
}

export function gaScriptSrc(id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanGaId(id))}`;
}
