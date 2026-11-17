import { describe, expect, it } from "vitest";
import { coinLine, mergeNotifications, type NotificationItem } from "@/server/notifications/feed";
import { alertLabel } from "@/components/buyer/AlertsPanel";
import { badgeFor } from "@/components/buyer/UserPanelShell";

function item(id: string, at: string | null): NotificationItem {
  return { id, kind: "coins", title: id, body: "", href: "/u/account/credits/history/", at };
}

describe("notifications feed", () => {
  it("sorts newest first and puts items without a time last", () => {
    const merged = mergeNotifications([item("old", "2026-01-01T00:00:00Z"), item("none", null), item("new", "2026-11-01T00:00:00Z")]);
    expect(merged.map((row) => row.id)).toEqual(["new", "old", "none"]);
  });

  it("keeps only the first thirty items", () => {
    const many = Array.from({ length: 40 }, (_, index) => item(`i${index}`, new Date(2026, 0, index + 1).toISOString()));
    expect(mergeNotifications(many)).toHaveLength(30);
  });

  it("writes the coin line for added and used coins", () => {
    expect(coinLine(5, "Pack purchase")).toEqual({ title: "5 credits added", body: "Pack purchase" });
    expect(coinLine(-1, "")).toEqual({ title: "1 credit used", body: "Credits were used." });
  });
});

describe("panel labels and badges", () => {
  it("labels a saved search from its words, category and city", () => {
    const categories = [{ slug: "flats", name: "Flats" }];
    const cities = [{ slug: "surat", name: "Surat" }];
    expect(alertLabel({ id: "1", q: "2 bhk", categorySlug: "flats", citySlug: "surat", createdAt: null }, categories, cities)).toBe('"2 bhk" · Flats · Surat');
    expect(alertLabel({ id: "2", q: "", categorySlug: "", citySlug: "", createdAt: null }, categories, cities)).toBe("Any words");
  });

  it("shows counts only for signed-in users and only where they apply", () => {
    const summary = { signedIn: true as const, userId: "u", email: "a@b.co", displayName: "A", balance: 4, unreadChat: 2, unreadSupport: 1, adCount: 0, seller: false, hasEarnings: false, memberSince: "Nov 2026" };
    expect(badgeFor("chats", summary)).toBe(2);
    expect(badgeFor("support", summary)).toBe(1);
    expect(badgeFor("notifications", summary)).toBe(3);
    expect(badgeFor("chats", { signedIn: false })).toBe(0);
  });
});
