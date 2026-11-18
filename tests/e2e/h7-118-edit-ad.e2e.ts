import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.118 (3-4): Edit opens the five steps on the same ad. No fee, no recharge prompt, same link, photos stay, owners only. */

const SHOTS = process.env.POST_SHOTS ?? "";
const SIZES = [
  [1536, 674],
  [390, 844],
] as const;
const FIT_SIZES: [number, number][] = [[1536, 674], [1366, 768]];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const original = page.viewportSize();
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png` });
  }
  if (original) await page.setViewportSize(original);
}

async function setPaidPosting(on: boolean) {
  await withLocalDb((db) =>
    db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: on, postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: 0 } }, { upsert: true }),
  );
}

async function ownerId(page: Page): Promise<ObjectId> {
  const me = await page.request.get("/api/auth/me");
  return new ObjectId(((await me.json()).data?.user?.id ?? "") as string);
}

async function overflows(page: Page) {
  return page.evaluate(() => {
    const pageExtra = document.documentElement.scrollHeight - window.innerHeight;
    const main = document.querySelector(".tkp-main");
    const inner: string[] = [];
    if (main) {
      for (const node of Array.from(main.querySelectorAll<HTMLElement>("*")).concat(main as HTMLElement)) {
        const style = getComputedStyle(node);
        if (style.overflowY === "visible" || style.display === "none") continue;
        if (node.scrollHeight - node.clientHeight > 1) inner.push(`${node.tagName.toLowerCase()}.${String(node.className).slice(0, 40)}`);
      }
    }
    const nav = document.querySelector<HTMLElement>(".tkp-nav");
    return { pageExtra, inner, navBottom: nav ? nav.getBoundingClientRect().bottom : 0 };
  });
}

async function readAd(page: Page, id: string) {
  const res = await page.request.get(`/api/listings/by-id/${id}`);
  expect(res.status()).toBe(200);
  return (await res.json()).data as { id: string; slug: string; title: string; status: string };
}

async function openEdit(page: Page, title: string) {
  await page.goto("/u/account/ads/");
  const card = page.locator("[data-tk=card]").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  return card;
}

test.describe("H7.118 edit an ad", () => {
  test("an ad posted free, edited later with Paid posting ON and 0 credits: same ad, same link, no fee, no recharge prompt", async ({ page, baseURL }, info) => {
    test.setTimeout(420_000);
    const ad = await createLiveAd(page, baseURL!, "editfree");
    const before = await readAd(page, ad.listingId);
    const user = await ownerId(page);
    await withLocalDb((db) => db.collection("wallet_entries").deleteMany({ userId: user }));
    await setPaidPosting(true);
    try {
      const card = await openEdit(page, ad.title);
      await shot(page, "h7-118-my-ads-edit");
      await card.getByRole("link", { name: "Edit", exact: true }).click();
      await page.waitForURL(/draft=/);
      await expect(page.locator("#title")).toHaveValue(ad.title);

      await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=1`);
      await expect(page.locator("[data-tk=step-help]")).toContainText("cannot change");
      await expect(page.locator(".tkp-tile[aria-pressed=true]")).toBeEnabled();
      expect(await page.locator(".tkp-tile[aria-pressed=false]:enabled").count()).toBe(0);
      await shot(page, "h7-118-edit-step-1");

      await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=5`);
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Review your changes");
      await expect(page.locator("[data-tk=review-photos]")).toContainText("1 photo");
      await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
      await expect(page.locator("[data-tk=pay-card]")).toHaveCount(0);
      await expect(page.locator("[data-tk=publish-blocked]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Recharge now" })).toHaveCount(0);
      await shot(page, "h7-118-edit-step-5");

      if (info.project.name === "desktop-1440") {
        for (const [width, height] of FIT_SIZES) {
          await page.setViewportSize({ width, height });
          for (const step of ["1", "5"]) {
            await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=${step}`);
            await expect(page.locator(".tkp-main[data-step]")).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            const found = await overflows(page);
            expect(found.pageExtra, `step ${step} at ${width}x${height}: page scroll`).toBeLessThanOrEqual(0);
            expect(found.inner, `step ${step} at ${width}x${height}: inner scroll`).toEqual([]);
            expect(found.navBottom, `step ${step} at ${width}x${height}: buttons in view`).toBeLessThanOrEqual(height);
          }
        }
        await page.setViewportSize({ width: 1440, height: 900 });
      }

      const edited = `${ad.title} edited`;
      await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=2`);
      await page.locator("#title").fill(edited);
      for (let turn = 0; turn < 6; turn += 1) {
        if ((await page.locator("[data-tk=step-title]").innerText()) === "Review your changes") break;
        await page.locator("[data-tk=go-on]").click();
        await page.waitForTimeout(400);
      }
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Review your changes");
      await expect(page.locator("[data-tk=review-title]")).toContainText(edited);
      await page.locator("#consent-terms").check();
      await page.locator("#consent-adult").check();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Changes saved");
      await expect(page.locator("[data-tk=receipt]")).toContainText("No charge for changes");
      await expect(page.locator("[data-tk=upsell]")).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "h7-118-edit-saved");

      const after = await readAd(page, ad.listingId);
      expect(after.id).toBe(before.id);
      expect(after.slug).toBe(before.slug);
      expect(after.title).toBe(edited);
      expect(after.status).toBe("active");
      expect(await withLocalDb((db) => db.collection("wallet_entries").countDocuments({ userId: user }))).toBe(0);
      expect(((await (await page.request.get("/api/wallet/")).json()).data.balance as number)).toBe(0);
      await expect
        .poll(async () => (await (await page.request.get(`/ad/${before.slug}/`)).text()).includes(edited), { timeout: 60_000, intervals: [3_000] })
        .toBe(true);
    } finally {
      await setPaidPosting(false);
    }
  });

  test("a paused ad stays paused when its changes are saved, and nothing is charged", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "editpaused");
    const paused = await page.request.post(`/api/listings/${ad.listingId}/pause`, { data: {}, headers: originHeaders(baseURL!, "/u/account/ads/") });
    expect(paused.status(), await paused.text()).toBe(200);
    const before = await readAd(page, ad.listingId);
    const user = await ownerId(page);
    await withLocalDb((db) => db.collection("wallet_entries").deleteMany({ userId: user }));
    await setPaidPosting(true);
    try {
      await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=5`);
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Review your changes");
      await page.locator("#consent-terms").check();
      await page.locator("#consent-adult").check();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.locator("[data-tk=step-title]")).toHaveText("Changes saved");
      await expect(page.locator("[data-tk=what-next]")).toContainText("still paused");
      const after = await readAd(page, ad.listingId);
      expect(after.status).toBe("paused");
      expect(after.slug).toBe(before.slug);
      expect(await withLocalDb((db) => db.collection("wallet_entries").countDocuments({ userId: user }))).toBe(0);
    } finally {
      await setPaidPosting(false);
    }
  });

  test("another account cannot open or change someone else's ad: it answers 404", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "editowner");
    const stranger = await newUserApi(baseURL!, "stranger");
    await page.context().clearCookies();
    await loginUi(page, stranger.email, undefined, "/u/account/");
    await stranger.api.dispose();
    const read = await page.request.get(`/api/listings/by-id/${ad.listingId}`);
    expect(read.status()).toBe(404);
    const patch = await page.request.patch(`/api/listings/${ad.listingId}`, {
      headers: originHeaders(baseURL!, "/u/post-insert/"),
      data: { stage: "basics", title: "Hijacked title for someone else" },
    });
    expect(patch.status()).toBe(404);
    const submit = await page.request.post(`/api/listings/${ad.listingId}/submit`, {
      headers: originHeaders(baseURL!, "/u/post-insert/"),
      data: { attestations: { adult: true, accurate: true, rights: true } },
    });
    expect(submit.status()).toBe(404);
    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=2`);
    await expect(page.getByText("This draft could not be loaded")).toBeVisible();
    const live = await page.request.get(ad.adHref);
    expect((await live.text()).includes("Hijacked")).toBe(false);
  });
});
