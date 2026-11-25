import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdCardCounts } from "@/components/new/AdCardCounts";
import { ListingFilterPanel } from "@/components/new/ListingFilterPanel";
import { clampPopLeft, clampPopTop, popMaxHeight } from "@/components/new/pop-layout";
import { SearchBar } from "@/components/new/SearchHeader";
import { COOKIE_NOTICE_IDLE_MS } from "@/components/CookieBanner";
import { listingLabels } from "@/components/new/listing-frame-props";
import { makeT } from "@/lib/ui/text";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));

/** H19.1: home, category and listing page fixes. */

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const t = makeT();

describe("the cookie notice", () => {
  it("hides itself after 30 seconds of no answer", () => {
    expect(COOKIE_NOTICE_IDLE_MS).toBe(30_000);
    expect(read("src/components/CookieBanner.tsx")).toContain("COOKIE_NOTICE_IDLE_MS");
  });

  it("stores no choice when it hides itself", () => {
    const source = read("src/components/CookieBanner.tsx");
    const timer = source.slice(source.indexOf("COOKIE_NOTICE_IDLE_MS)") - 120, source.indexOf("COOKIE_NOTICE_IDLE_MS)") + 40);
    expect(timer).toContain("setOpen(false)");
    expect(timer).not.toContain("choose(");
  });
});

describe("the pop-out of an ad card stays inside the window", () => {
  it("is pulled up when there is no room below, and down when it would leave through the top", () => {
    expect(clampPopTop(700, 300, 800)).toBe(492);
    expect(clampPopTop(-40, 300, 800)).toBe(8);
    expect(clampPopTop(200, 300, 800)).toBe(200);
  });

  it("keeps its sides inside the window and never grows past it", () => {
    expect(clampPopLeft(1300, 400, 1440)).toBe(1032);
    expect(clampPopLeft(-30, 400, 1440)).toBe(8);
    expect(popMaxHeight(800)).toBe(784);
  });

  it("is a quarter smaller than before: the grid-card pop-out uses 75 percent of the old size; a list row's pop-out covers its row (H21.11)", () => {
    expect(read("src/components/new/HomeAdPopout.tsx")).toContain("SIZE_SHARE = 0.75");
    expect(read("src/components/new/ListingPopout.tsx")).toContain("rowPopBox(anchor, window.innerWidth)");
    expect(read("src/components/new/HomeAdPopout.tsx")).toContain("maxHeight: popMaxHeight(window.innerHeight)");
  });
});

describe("the category and listing pages", () => {
  const labels = listingLabels(t);
  const places = {
    categories: [{ value: "dating", label: "Dating", href: "/dating/" }],
    categoryValue: "dating",
    states: [{ value: "", label: "All states", href: "/dating/" }],
    stateValue: "",
    cities: [{ value: "", label: "All cities", href: "/dating/" }],
    cityValue: "",
    areas: [],
    areaValue: "",
  };
  const panel = (rows: Parameters<typeof ListingFilterPanel>[0]["rows"]) =>
    renderToStaticMarkup(createElement(ListingFilterPanel, { action: "/dating/", clearHref: "/dating/", rows, activeCount: 0, labels, places }));

  it("the filter panel has no Verified, With photos, With video or Online now button and no 'No filters' line", () => {
    const html = panel([]);
    for (const word of ["Verified", "With photos", "With video", "Online now", "No filters for this category"]) expect(html, word).not.toContain(word);
    expect(html).not.toContain('name="verified"');
    expect(html).not.toContain('name="online"');
  });

  it("a category's own yes/no filter is still there", () => {
    expect(panel([{ kind: "boolean", key: "ac", label: "Air conditioning", icon: "list" as never, picked: 0, checked: false }])).toContain("Air conditioning");
  });

  it("the results bar has no Sort menu", () => {
    const html = renderToStaticMarkup(createElement(SearchBar, { total: 12, t }));
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Best match");
    expect(html).toContain("12");
  });
});

describe("the views and clicks counts of an ad card", () => {
  it("show an eye and a pointer with 0 when the ad has none", () => {
    const html = renderToStaticMarkup(createElement(AdCardCounts, { slug: "no-such-ad" }));
    expect(html).toContain('data-tk="card-views"');
    expect(html).toContain('data-tk="card-clicks"');
    expect(html).toContain("0 views");
    expect(html).toContain("0 clicks");
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
  });

  it("show the numbers the page already has, with Indian grouping and the singular for 1", () => {
    const html = renderToStaticMarkup(createElement(AdCardCounts, { fixed: { views: 1234567, clicks: 1 } }));
    expect(html).toContain("12,34,567 views");
    expect(html).toContain("1 click");
    expect(html).not.toContain("1 clicks");
  });

  it("are on the Home card, the listing row, both pop-outs and the My ads card", () => {
    for (const file of ["HomeAdCard", "ListingRow", "HomeAdPopout", "ListingPopout"]) expect(read(`src/components/new/${file}.tsx`), file).toContain("<AdCardCounts");
    expect(read("src/components/ui/AdCard.tsx")).toContain("<AdCardCounts");
  });

  it("a click is a press of a contact button, not a click on the card's link", () => {
    for (const file of ["src/components/new/HomeAdCard.tsx", "src/components/new/ListingRow.tsx", "src/components/new/HomeAdPopout.tsx", "src/components/new/ListingPopout.tsx"]) {
      expect(read(file), file).not.toContain("recordAdClick");
    }
    const press = read("src/components/new/ContactPressCounter.tsx");
    for (const button of ["call", "whatsapp", "chat", "tour"]) expect(press).toContain(`[data-tk="${button}"]`);
    expect(read("src/components/new/NewAdDetail.tsx")).toContain("<ContactPressCounter");
  });

  it("an ad that is only shown on a card does not count a view", () => {
    expect(read("src/components/new/use-card-slider.ts")).not.toContain("watchAdCard");
    expect(read("src/components/ui/AdCard.tsx")).not.toContain("watchAdCard");
  });
});

describe("the header account menu", () => {
  it("closes on a press elsewhere, on Escape and when the pointer reaches an ad card or its pop-out", () => {
    const hook = read("src/components/ui/use-menu-dismiss.ts");
    for (const part of ["pointerdown", "Escape", "pointerover", "home-ad-popout", "listing-popout", "listing-row", "home-ad"]) expect(hook, part).toContain(part);
    expect(read("src/components/HeaderNew.tsx")).toContain("useMenuDismiss(accountOpen, accountRef, closeAccount)");
  });
});

describe("the support chat", () => {
  it("has the quick buttons just above the message box, after the conversation", () => {
    const source = read("src/components/chat/SupportChat.tsx");
    expect(source.indexOf('className="tkn-chat-body"')).toBeLessThan(source.indexOf('className="tkn-topics"'));
    expect(source.indexOf('className="tkn-topics"')).toBeLessThan(source.indexOf('className="tkn-composer"'));
    expect(source.slice(source.indexOf('className="tkn-chat-body"'), source.indexOf('className="tkn-topics"'))).not.toContain("tkn-topics");
  });
});
