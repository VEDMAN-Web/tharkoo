import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanGaId, cleanPageLocation, consentGranted, gaInitScript, gaMayLoad, gaScriptSrc, isPublicPath, safeEventParams, trackEvent } from "@/lib/analytics/ga";

/** H17.11: Google Analytics loads only with an ID, on a public page, after Accept; events carry no personal fields. */

describe("the measurement ID", () => {
  it("accepts a GA4 web ID and nothing else", () => {
    expect(cleanGaId("G-TRCWRYJSZ1")).toBe("G-TRCWRYJSZ1");
    expect(cleanGaId("  g-trcwryjsz1 ")).toBe("G-TRCWRYJSZ1");
    for (const bad of ["", "UA-12345-1", "G-", "G-<script>", "G-AB CD", "https://x.test", "G-TRCWRYJSZ1';alert(1)//", undefined, null, 12]) {
      expect(cleanGaId(bad), String(bad)).toBe("");
    }
  });
});

describe("when the tag may load", () => {
  const id = "G-TRCWRYJSZ1";
  it("needs an ID, a public page and Accept", () => {
    expect(gaMayLoad({ id, pathname: "/", consent: "all" })).toBe(true);
    expect(gaMayLoad({ id: "", pathname: "/", consent: "all" })).toBe(false);
    expect(gaMayLoad({ id, pathname: "/", consent: "necessary" })).toBe(false);
    expect(gaMayLoad({ id, pathname: "/", consent: null })).toBe(false);
    expect(gaMayLoad({ id, pathname: "/", consent: undefined })).toBe(false);
  });

  it("never on an admin screen or a tool page", () => {
    for (const path of ["/admin", "/admin/", "/admin/settings/", "/styleguide/admin/", "/styleguide"]) {
      expect(isPublicPath(path), path).toBe(false);
      expect(gaMayLoad({ id, pathname: path, consent: "all" }), path).toBe(false);
    }
    for (const path of ["/", "/dating/pune/", "/ad/x/", "/administrators-note/"]) expect(isPublicPath(path), path).toBe(true);
  });

  it("only Accept counts as consent", () => {
    expect(consentGranted("all")).toBe(true);
    for (const value of ["necessary", "", "yes", "true", null, undefined]) expect(consentGranted(value as string | null)).toBe(false);
  });
});

describe("what Google receives", () => {
  it("the page address has no query string and no hash", () => {
    expect(cleanPageLocation("https://tharkoo.example", "/search/?q=rahul+9876543210#top")).toBe("https://tharkoo.example/search/");
    expect(cleanPageLocation("https://tharkoo.example/", "/dating/pune/")).toBe("https://tharkoo.example/dating/pune/");
  });

  it("an event keeps only its allowed fields, never free text or personal data", () => {
    expect(safeEventParams("search", { category: "dating", city: "pune", q: "rahul 9876543210", query: "x", email: "a@b.test" })).toEqual({ category: "dating", city: "pune" });
    expect(safeEventParams("contact_click", { method: "whatsapp", category: "jobs", city: "surat", phone: "9876543210", name: "Asha", userId: "u1" })).toEqual({ method: "whatsapp", category: "jobs", city: "surat" });
    expect(safeEventParams("contact_click", { method: "email-me@x.test" })).toEqual({});
    expect(safeEventParams("ad_view", { category: "Dating In Pune!", city: "pune", title: "My flat" })).toEqual({ city: "pune" });
    expect(safeEventParams("sign_up", { method: "email", email: "a@b.test", userId: "u1" })).toEqual({ method: "email" });
    expect(safeEventParams("post_ad_start", { anything: "x" })).toEqual({});
    expect(safeEventParams("post_ad_published", { category: "jobs", title: "Hiring", description: "call me" })).toEqual({ category: "jobs" });
    expect(safeEventParams("save_ad", { slug: "abc", title: "t" })).toEqual({});
  });

  it("the start-up script keeps consent denied by default and Google signals and ad personalisation off", () => {
    const script = gaInitScript("G-TRCWRYJSZ1");
    expect(script).toContain("gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})");
    expect(script).toContain("allow_google_signals:false");
    expect(script).toContain("allow_ad_personalization_signals:false");
    expect(script).toContain("send_page_view:false");
    expect(script).toContain("window.__tkGa=true;window.dispatchEvent(new Event('tk-ga-ready'));");
    expect(script).toContain("gtag('config','G-TRCWRYJSZ1'");
    expect(script).not.toMatch(/ad_storage:'granted'|ad_user_data:'granted'|ad_personalization:'granted'/);
  });

  it("the start-up script cannot carry a made-up ID", () => {
    expect(gaInitScript("G-X');alert(1);('")).not.toContain("alert");
    expect(gaScriptSrc("G-TRCWRYJSZ1")).toBe("https://www.googletagmanager.com/gtag/js?id=G-TRCWRYJSZ1");
    expect(gaScriptSrc("nope")).toBe("https://www.googletagmanager.com/gtag/js?id=");
  });
});

describe("sending an event", () => {
  const calls: unknown[][] = [];
  afterEach(() => {
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  it("does nothing until the tag is loaded (so nothing before Accept), and never throws", () => {
    vi.stubGlobal("window", { gtag: (...args: unknown[]) => calls.push(args) });
    expect(() => trackEvent("search", { category: "dating" })).not.toThrow();
    expect(calls).toEqual([]);
    expect(() => trackEvent("search")).not.toThrow();
  });

  it("once loaded it sends the event with only the allowed fields", () => {
    vi.stubGlobal("window", { __tkGa: true, gtag: (...args: unknown[]) => calls.push(args) });
    trackEvent("contact_click", { method: "chat", category: "dating", city: "pune", phone: "9876543210", text: "hello" });
    expect(calls).toEqual([["event", "contact_click", { method: "chat", category: "dating", city: "pune" }]]);
  });
});

describe("events that happen before the tag has loaded", () => {
  const calls: unknown[][] = [];
  const store = (value: string | null) => ({ getItem: () => value });
  afterEach(() => {
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  it("wait in a short queue for a visitor who accepted, and are sent once the tag is loaded", async () => {
    const { flushGaQueue } = await import("@/lib/analytics/ga");
    const win: Record<string, unknown> = { __tkGaWanted: true, localStorage: store("all"), gtag: (...args: unknown[]) => calls.push(args) };
    vi.stubGlobal("window", win);
    trackEvent("search", { category: "dating", city: "pune", q: "private words" });
    expect(calls).toEqual([]);
    win.__tkGa = true;
    flushGaQueue();
    expect(calls).toEqual([["event", "search", { category: "dating", city: "pune" }]]);
  });

  it("are dropped for a visitor who chose Only necessary or has not chosen", async () => {
    const { flushGaQueue } = await import("@/lib/analytics/ga");
    for (const choice of ["necessary", null]) {
      const win: Record<string, unknown> = { __tkGaWanted: true, localStorage: store(choice), gtag: (...args: unknown[]) => calls.push(args) };
      vi.stubGlobal("window", win);
      trackEvent("save_ad");
      win.__tkGa = true;
      flushGaQueue();
    }
    expect(calls).toEqual([]);
  });

  it("are dropped on a page that does not use analytics at all (no ID, an admin screen)", async () => {
    const { flushGaQueue } = await import("@/lib/analytics/ga");
    const win: Record<string, unknown> = { localStorage: store("all"), gtag: (...args: unknown[]) => calls.push(args) };
    vi.stubGlobal("window", win);
    trackEvent("login", { method: "email" });
    win.__tkGa = true;
    flushGaQueue();
    expect(calls).toEqual([]);
  });
});
