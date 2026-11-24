import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { CallRow, ACCEPT_WINDOW_MS, callState, timeLeftLabel } from "@/components/vendor/CallsList";
import { badgeFor, showsFor } from "@/components/buyer/UserPanelShell";

const NOW = Date.parse("2026-11-24T10:00:00Z");
const base = { id: "t1", coins: 10, requestedAt: new Date(NOW - 5 * 60_000).toISOString(), adTitle: "Flat in Surat", adSlug: "flat", adPhoto: "/a.jpg", otherName: "Asha" };

describe("H19.5 call statuses", () => {
  it("names each call waiting, accepted, done, missed or refunded", () => {
    expect(callState("requested").key).toBe("waiting");
    expect(callState("accepted").key).toBe("accepted");
    expect(callState("completed").key).toBe("done");
    expect(callState("expired").key).toBe("missed");
    for (const status of ["declined", "failed", "cancelled", "reversed"]) expect(callState(status).key, status).toBe("refunded");
  });

  it("counts the time left to accept from the 30 minute window", () => {
    expect(ACCEPT_WINDOW_MS).toBe(30 * 60_000);
    expect(timeLeftLabel(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("25 min left to accept");
    expect(timeLeftLabel(new Date(NOW - 40 * 60_000).toISOString(), NOW)).toBe("");
    expect(timeLeftLabel(null, NOW)).toBe("");
  });
});

describe("H19.5 a call row", () => {
  const html = (row: Record<string, unknown>) => renderToStaticMarkup(createElement(CallRow, { row: { status: "requested", role: "advertiser", ...base, ...row } as never, now: NOW, busy: false, onAct: () => undefined }));

  it("shows the ad photo and title, the other person's name and the status", () => {
    const out = html({});
    expect(out).toContain("Flat in Surat");
    expect(out).toContain('src="/a.jpg"');
    expect(out).toContain("Asha");
    expect(out).toContain("Waiting");
  });

  it("gives a vendor Accept and Decline with the time left on a waiting request", () => {
    const out = html({});
    expect(out).toContain("Accept");
    expect(out).toContain("Decline");
    expect(out).toContain("25 min left to accept");
  });

  it("gives the user a Join call button once the vendor accepted, and no Accept for them", () => {
    const out = html({ role: "buyer", status: "accepted", joinUrl: "/u/account/tours/x/" });
    expect(out).toContain("Join call");
    expect(out).not.toContain(">Accept<");
  });

  it("shows no buttons on a finished call", () => {
    const out = html({ status: "completed" });
    expect(out).not.toContain("Accept");
    expect(out).not.toContain("Join call");
  });

  it("never uses the word buyer in what the person reads", () => {
    expect(html({ role: "buyer" }).replace(/data-[a-z-]+="[^"]*"/g, "")).not.toMatch(/buyer/i);
  });
});

describe("H19.5 the account menu by role", () => {
  const user = { signedIn: true, adCount: 0, hasEarnings: false, waitingCalls: 3 } as never;
  const vendor = { signedIn: true, adCount: 2, hasEarnings: false, waitingCalls: 0 } as never;

  it("hides My ads, Photos and videos and Earnings from an account that never posted", () => {
    expect(showsFor("ads", user)).toBe(false);
    expect(showsFor("media", user)).toBe(false);
    expect(showsFor("earnings", user)).toBe(false);
    for (const key of ["home", "chats", "calls", "saved", "coins", "support", "settings"] as const) expect(showsFor(key, user), key).toBe(true);
  });

  it("shows all of them once the account has an ad, Earnings included", () => {
    for (const key of ["ads", "media", "earnings"] as const) expect(showsFor(key, vendor), key).toBe(true);
  });

  it("puts the waiting requests on the Video calls item", () => {
    expect(badgeFor("calls", user)).toBe(3);
    expect(badgeFor("calls", vendor)).toBe(0);
  });
});
