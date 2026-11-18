import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createLiveAd } from "./flows";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, signInAdminContext, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

/** H12.3: the seller panel and admin small alignment fixes, and the live posting line on My ads. */

const SHOTS = process.env.H123_SHOTS_DIR ?? "";
const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

/** Box heights and tops of every match, rounded. */
async function boxes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: Math.round(rect.top * 10) / 10, height: Math.round(rect.height * 10) / 10, left: Math.round(rect.left * 10) / 10, width: Math.round(rect.width * 10) / 10 };
    }),
  );
}

function equal(values: number[], tolerance = 1) {
  return Math.max(...values) - Math.min(...values) <= tolerance;
}

test.describe("H12.3 panel and admin alignment", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("seller panel: equal number boxes, alerts form and help link, photo chips, Chats uses the standard ad card", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    await createLiveAd(page, baseURL!, "h123panel");
    for (const size of SIZES) {
      await page.setViewportSize(size);
      const phone = size.width < 768;

      await page.goto("/u/account/");
      await expect(page.locator('[data-tk="dash-tiles"]')).toBeVisible();
      const stats = await boxes(page, '[data-tk="dash-tiles"] .up-dash-kpi');
      expect(stats.length).toBe(3);
      expect(equal(stats.map((box) => box.height)), `number boxes at ${size.width}: ${JSON.stringify(stats)}`).toBe(true);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "account");

      await page.goto("/u/account/alerts/");
      const card = page.locator('section[aria-labelledby="alerts-new"]');
      await expect(card).toBeVisible();
      const cardBox = (await boxes(page, 'section[aria-labelledby="alerts-new"]'))[0];
      for (const input of await boxes(page, 'section[aria-labelledby="alerts-new"] .up-select')) {
        if (phone) expect(input.width, "alerts input width").toBeGreaterThanOrEqual(cardBox.width * 0.9);
      }
      const title = (await boxes(page, "#alerts-list"))[0];
      const help = (await boxes(page, ".sec-help summary"))[0];
      expect(help.top, "the help link is under the title").toBeGreaterThanOrEqual(title.top + title.height - 1);
      expect(Math.abs(help.left - title.left), "the help link is left-aligned with the title").toBeLessThanOrEqual(2);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "alerts");

      await page.goto("/u/account/media/");
      const chips = await boxes(page, '[data-tk="media-filter"]');
      expect(chips.length).toBe(3);
      expect(equal(chips.map((box) => box.height)), `photo chips: ${JSON.stringify(chips)}`).toBe(true);
      const radii = await page.locator('[data-tk="media-filter"]').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderRadius));
      expect(new Set(radii).size, "one chip shape").toBe(1);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "media");

      await page.goto("/u/account/messages/");
      await expect(page.locator('[data-tk="discover"] [data-tk="listing-row"]').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-tk="discover"] [data-tk="card"]')).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "chats");
    }
  });

  test("My ads empty text follows the live posting rule: free ads left, then the fee in rupees and credits, then free when paid posting is off", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    const before = await withLocalDb((db) => db.collection("sites").findOne({ key: "default" }, { projection: { paidPostingOn: 1, postingFeeCredits: 1, freeAdsPerAccount: 1 } }));
    const email = uniqueEmail("h123free");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/account/");
    const line = page.locator('[data-tk="my-ads-cost"]');
    async function expectLine(text: RegExp) {
      await expect(async () => {
        await page.goto("/u/account/ads/");
        await expect(line).toHaveText(text, { timeout: 3_000 });
      }).toPass({ timeout: 150_000, intervals: [5_000] });
    }
    try {
      await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: 30, freeAdsPerAccount: 3 } }, { upsert: true }));
      await expectLine(/^You have 3 free ads left\.$/);
      await page.setViewportSize({ width: 390, height: 844 });
      await shot(page, "my-ads-free-left");
      await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { freeAdsPerAccount: 0 } }));
      await expectLine(/^Each ad costs ₹300 \(30 credits\) to post\.$/);
      await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: false } }));
      await expectLine(/^Posting an ad is free\.$/);
    } finally {
      const fields = ["paidPostingOn", "postingFeeCredits", "freeAdsPerAccount"] as const;
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      for (const field of fields) {
        if (before && field in before) set[field] = (before as Record<string, unknown>)[field];
        else unset[field] = "";
      }
      await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }));
    }
  });

  test("admin: checklist buttons in one row, content chips one pill, page builder titles aligned, Ad videos left-aligned, no sideways scroll", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await signInAdminContext(context, baseURL!);
    for (const size of SIZES) {
      await page.setViewportSize(size);

      await page.goto("/admin/");
      await expect(page.locator('[data-tk="launch-checklist"]')).toBeVisible();
      for (const row of await page.locator('[data-tk="launch-checklist"] .adm-d-check').all()) {
        const buttons = await row.locator(".adm-d-actions > *").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top * 10) / 10));
        expect(equal(buttons), `checklist buttons start at the same top: ${buttons.join(",")}`).toBe(true);
        const heights = await row.locator(".adm-d-actions > *").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
        expect(equal(heights), `checklist buttons are one height: ${heights.join(",")}`).toBe(true);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "admin-dashboard");

      await page.goto("/admin/content/");
      await expect(page.locator(".adm-st-chips")).toBeVisible();
      const chips = await boxes(page, ".adm-st-chips .adm-k-chip");
      expect(chips.length).toBeGreaterThanOrEqual(5);
      expect(equal(chips.map((box) => box.height)), `content chips: ${JSON.stringify(chips)}`).toBe(true);
      const looks = await page.locator(".adm-st-chips .adm-k-chip").evaluateAll((nodes) => nodes.map((node) => `${getComputedStyle(node).borderRadius}|${getComputedStyle(node).paddingLeft}|${getComputedStyle(node).fontWeight}`));
      expect(new Set(looks).size, `one pill: ${looks.join(" / ")}`).toBe(1);
      for (const chip of chips) expect(chip.width, `every chip is a pill, wider than it is tall: ${JSON.stringify(chip)}`).toBeGreaterThan(chip.height * 1.4);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "admin-content");

      await page.goto("/admin/page-builder/");
      await expect(page.locator(".adm-pb-grid")).toBeVisible();
      if (size.width >= 1200) {
        const tops = await page.locator(".adm-pb-grid .adm-pb-head h2").evaluateAll((nodes) => {
          const firstIn = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? null;
          return [firstIn(".adm-pb-main .adm-pb-head h2"), firstIn(".adm-pb-side .adm-pb-head h2"), nodes.length ? nodes[0].getBoundingClientRect().top : null].filter((value): value is number => value !== null);
        });
        expect(equal(tops), `page builder titles start at one top: ${tops.join(",")}`).toBe(true);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "admin-page-builder");

      await page.goto("/admin/media/");
      const videos = page.locator(".adm-vr");
      await expect(videos).toBeVisible();
      await expect(videos.locator(".adm-empty, article").first()).toBeVisible({ timeout: 30_000 });
      if ((await videos.locator(".adm-empty").count()) > 0) {
        const heading = (await boxes(page, ".adm-vr > h2"))[0];
        const empty = (await boxes(page, ".adm-vr .adm-empty h2, .adm-vr .adm-empty p"))[0];
        expect(empty.left, "the empty-state text starts at the title's side").toBeLessThan(heading.left + 80);
        expect(await videos.locator(".adm-empty").evaluate((node) => getComputedStyle(node).textAlign)).toBe("left");
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "admin-media");
    }
  });

  test("admin axe: the loading skeleton and the bell with unread notifications have no accessible-name problems", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    // The bell with more than nine unread: its visible badge reads 9+ and the name must say so.
    await page.route("**/api/admin/notifications?size=*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { now: Date.now(), items: [], total: 12, unread: 12, page: 1, pageSize: 10, kinds: [] } }) }),
    );
    await page.goto("/admin/");
    await expect(page.locator('[data-tk="bell-count"]')).toHaveText("9+");
    await expect(page.locator('[data-tk="bell"]')).toHaveAttribute("aria-label", "Notifications, 9+ unread");
    const bell = await new AxeBuilder({ page }).include('[data-tk="bell"]').withRules(["label-content-name-mismatch", "aria-allowed-attr", "button-name"]).analyze();
    expect(bell.violations.map((item) => item.id)).toEqual([]);

    // The loading skeleton on Media stays on screen while the video list is slow.
    await page.route("**/admin/media/", async (route) => {
      if (route.request().method() === "POST") await new Promise((done) => setTimeout(done, 6_000));
      await route.continue();
    });
    await page.goto("/admin/media/");
    await expect(page.locator(".adm-skeleton").first()).toBeVisible({ timeout: 15_000 });
    const skeleton = await new AxeBuilder({ page }).include(".adm-skeleton").withRules(["aria-prohibited-attr", "aria-allowed-attr", "aria-allowed-role"]).analyze();
    expect(skeleton.violations.map((item) => item.id)).toEqual([]);
  });
});
