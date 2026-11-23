import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { AdPopup } from "@/components/new/AdPopup";
import { CallPacksView } from "@/components/recharge/CallPacks";
import { callBackUrl } from "@/components/recharge/back-url";
import { TEXT_DEFAULTS } from "@/lib/ui/text";

const noop = () => undefined;
const BANNED = /free ads?|per ad|publish|ad credits?|post(ing)? (an )?ad/i;

function popup(extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(AdPopup, {
      kind: "call",
      name: "Asha",
      signedIn: true,
      tourCoins: 10,
      paymentsLive: true,
      alternatives: [],
      notice: null,
      onClose: noop,
      onSignedIn: noop,
      onStartCall: async () => "ok",
      onStartChat: async () => "ok",
      onSwitchToChat: noop,
      ...extra,
    } as never),
  );
}

const pack = (id: string, price: number, total: number) => ({ id, credits: total, bonus: 0, total, price, badge: null });
const DATA = {
  packs: [pack("ad1", 100, 10)],
  callPacks: [pack("c1", 100, 10), pack("c2", 250, 28), pack("c3", 500, 60), pack("c4", 1000, 130), pack("c5", 2000, 280)],
  custom: { min: { call: 50, ad: 100 }, maxPerPurchase: { call: 20000, ad: 20000 }, maxPerDay: 50000, moveEarningsMin: 100 },
  creditPriceInr: 10,
  fee: 0,
  available: true,
  testPayments: true,
  prices: null,
};

describe("H19.3 the video call pop-up", () => {
  const html = popup();

  it("has one headline, the three benefit lines, the price and ONE main button", () => {
    expect(html).toContain("Video call and verify");
    expect(html).toContain("See the person live before you meet");
    expect(html).toContain("Verify before you spend thousands");
    expect(html).toContain("You pay only if the call connects");
    expect(html).toContain("1 call = 10 credits");
    expect((html.match(/class="tkn-pop-btn"/g) ?? []).length).toBe(1);
    expect(html).toContain("Start video call");
  });

  it("shows the user's call-credit balance", () => {
    expect(html).toMatch(/Your call credits/);
  });

  it("says Recharge successful with the number of call credits after a payment", () => {
    expect(popup({ paidAdded: 25 })).toContain("Recharge successful, 25 call credits added");
    expect(html).not.toContain("Recharge successful");
  });

  it("never talks about ads, free ads or publishing", () => {
    expect(html).not.toMatch(BANNED);
    for (const [key, text] of Object.entries(TEXT_DEFAULTS)) {
      if (/^ad\.(call|buy|calling)\./.test(key)) expect(text, key).not.toMatch(BANNED);
    }
  });
});

describe("H19.3 buying call credits inside the pop-up", () => {
  const html = renderToStaticMarkup(createElement(CallPacksView, { data: DATA, shortfall: 10, returnTo: "/x/?call=1", onBusy: noop } as never));

  it("shows call packs only, four of them, plus an own-amount box, and one Pay button", () => {
    expect((html.match(/data-tk="call-pack"/g) ?? []).length).toBe(4);
    expect(html).toContain('data-tk="call-custom"');
    expect((html.match(/data-tk="call-pay"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("ad1");
  });

  it("has no ad-credit, free-ad, per-ad or publish wording and no wallet tabs", () => {
    expect(html).not.toMatch(BANNED);
    expect(html).not.toContain('role="tablist"');
  });
});

describe("H19.3 the way back from the payment", () => {
  it("returns to the same ad with the pop-up flag, the paid flag and the number of credits", () => {
    expect(callBackUrl("/dating/surat/x-k7q2z/?call=1", "paid", 25, "p1")).toBe("/dating/surat/x-k7q2z/?call=1&recharge=paid&credits=25&payment=p1&paid=1&added=25");
  });

  it("does not claim a payment after a failed or cancelled one", () => {
    const url = callBackUrl("/dating/surat/x-k7q2z/?call=1", "failed", 25, "p1");
    expect(url).toContain("call=1");
    expect(url).not.toContain("paid=1");
    expect(url).not.toContain("added=");
  });

  it("keeps the old behaviour for any other return page", () => {
    expect(callBackUrl("/u/account/credits/", "paid", 5, "p2")).toBe("/u/account/credits/?recharge=paid&credits=5&payment=p2");
    expect(callBackUrl("", "failed", 5, "p2")).toBe("/u/account/credits/?recharge=failed&credits=5&payment=p2");
  });
});
