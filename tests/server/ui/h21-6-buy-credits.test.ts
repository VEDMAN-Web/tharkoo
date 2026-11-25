import { describe, expect, it } from "vitest";
import { checkCustomAmount, phaseFor, POLL_LIMIT_MS, POLL_MS, startingPack } from "@/components/post/BuyCreditsDialog";
import { creditsForAmount } from "@/components/recharge/CreditPacks";
import { makeT, TEXT_DEFAULTS } from "@/lib/ui/text";
import type { PackLike } from "@/lib/credit-pack-view";

const pack = (id: string, total: number, price: number, bonus = 0): PackLike => ({ id, credits: total - bonus, bonus, total, price, badge: null });
const PACKS = [pack("p100", 100, 1000), pack("p210", 210, 1900, 10), pack("p575", 575, 4250, 75), pack("p7250", 7250, 27500, 2250)];
const LIMITS = { min: 1000, max: 50_000, maxPerDay: 100_000 };

describe("H21.6 the pack that starts chosen", () => {
  it("is the smallest pack that covers what is missing", () => {
    expect(startingPack(PACKS, 50)?.id).toBe("p100");
    expect(startingPack(PACKS, 100)?.id).toBe("p100");
    expect(startingPack(PACKS, 101)?.id).toBe("p210");
    expect(startingPack(PACKS, 211)?.id).toBe("p575");
    expect(startingPack(PACKS, 7250)?.id).toBe("p7250");
  });

  it("is the biggest pack when none covers it, and nothing when there are no packs", () => {
    expect(startingPack(PACKS, 9000)?.id).toBe("p7250");
    expect(startingPack([], 10)).toBeNull();
  });

  it("handles an unordered list and a need of zero or less", () => {
    expect(startingPack([PACKS[3], PACKS[0], PACKS[2], PACKS[1]], 150)?.id).toBe("p210");
    expect(startingPack(PACKS, 0)?.id).toBe("p100");
    expect(startingPack(PACKS, -5)?.id).toBe("p100");
  });
});

describe("H21.6 the payment states", () => {
  it("waits while the payment is pending or unknown", () => {
    expect(phaseFor("pending")).toBe("waiting");
    expect(phaseFor("created")).toBe("waiting");
    expect(phaseFor(undefined)).toBe("waiting");
  });

  it("is paid only when the payment says paid", () => {
    expect(phaseFor("paid")).toBe("paid");
  });

  it("is failed for failed, expired and cancelled", () => {
    for (const status of ["failed", "expired", "cancelled"]) expect(phaseFor(status)).toBe("failed");
  });

  it("asks every 3 seconds and stops after 30 minutes", () => {
    expect(POLL_MS).toBe(3000);
    expect(POLL_LIMIT_MS).toBe(30 * 60 * 1000);
  });
});

describe("H21.6 the own amount limits", () => {
  it("says nothing for an empty box", () => {
    expect(checkCustomAmount("", LIMITS)).toBe("empty");
  });

  it("refuses less than the smallest amount", () => {
    expect(checkCustomAmount("999", LIMITS)).toBe("small");
    expect(checkCustomAmount("0", LIMITS)).toBe("small");
    expect(checkCustomAmount("12.5", LIMITS)).toBe("small");
  });

  it("accepts the smallest and the largest single payment", () => {
    expect(checkCustomAmount("1000", LIMITS)).toBe("ok");
    expect(checkCustomAmount("50000", LIMITS)).toBe("ok");
  });

  it("refuses more than one payment may be", () => {
    expect(checkCustomAmount("50001", LIMITS)).toBe("big");
  });

  it("refuses more than the day allows when the day limit is the lower one", () => {
    expect(checkCustomAmount("30000", { min: 1000, max: 50_000, maxPerDay: 20_000 })).toBe("bigDay");
    expect(checkCustomAmount("20000", { min: 1000, max: 50_000, maxPerDay: 20_000 })).toBe("ok");
  });

  it("quotes the credits for an amount like the server does (base rate, or the best pack's rate)", () => {
    expect(creditsForAmount(1000, 10, PACKS)).toBe(100);
    expect(creditsForAmount(4250, 10, PACKS)).toBe(575);
    expect(creditsForAmount(5000, 10, PACKS)).toBeGreaterThanOrEqual(575);
    expect(creditsForAmount(0, 10, PACKS)).toBe(0);
    expect(creditsForAmount(Number.NaN, 10, PACKS)).toBe(0);
  });
});

describe("H21.6 words", () => {
  const t = makeT();
  it("has the lines of the spec", () => {
    expect(t("post.v2.buy.title")).toBe("Add ad credits");
    expect(t("post.v2.buy.line", { balance: "10", plan: "TOP", price: "499", need: "489" })).toBe("You have 10 credits. TOP needs 499, so you need 489 more.");
    expect(t("post.v2.buy.enough")).toBe("Enough for this");
    expect(t("post.v2.buy.pay", { amount: "4,250" })).toBe("Pay ₹4,250");
    expect(t("post.v2.buy.paidTitle", { count: "575" })).toBe("575 credits added");
    expect(t("post.v2.buy.publish", { plan: "TOP", price: "499" })).toBe("Publish with TOP · 499 credits");
    expect(t("post.v2.buy.back")).toBe("Back to review");
    expect(t("post.v2.buy.failedTitle")).toBe("Payment did not go through");
    expect(t("post.v2.buy.failedText")).toBe("Nothing was charged.");
  });

  it("keeps every word under post.v2.buy and never says buyer", () => {
    const keys = Object.keys(TEXT_DEFAULTS).filter((key) => key.startsWith("post.v2.buy."));
    expect(keys.length).toBeGreaterThanOrEqual(25);
    for (const key of keys) expect((TEXT_DEFAULTS as Record<string, string>)[key].toLowerCase()).not.toContain("buyer");
  });
});
