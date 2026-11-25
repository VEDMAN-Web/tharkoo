import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, pickCity, PNG, test, USER_PASSWORD, withLocalDb } from "./helpers";

/** H21.12b: every step opens at the top, nothing in the post page scrolls inside itself, the previews are small and whole. */

const SHOTS = ".shots/H21.12b";
const SIZES = [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;

async function shots(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  const original = page.viewportSize()!;
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    expect(await hasHorizontalScroll(page), `${name} at ${width}`).toBe(false);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize(original);
}

/** Every element of the post page that scrolls inside itself (only the page may scroll). */
async function innerScrollers(page: Page) {
  return page.locator("[data-tk=post-shell]").evaluate((shell) =>
    [...shell.querySelectorAll<HTMLElement>("*")]
      .filter((el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} ${el.scrollHeight}>${el.clientHeight}`),
  );
}

async function opensAtTop(page: Page, step: number) {
  await expect(page.locator("[data-tk=step-of]")).toContainText(`Step ${step} of 5`);
  await expect.poll(async () => page.evaluate(() => window.scrollY), { message: `step ${step} opens at the top` }).toBe(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY), `step ${step} stays at the top`).toBe(0);
  await expect(page.locator("[data-tk=step-title]")).toBeFocused();
  expect(await innerScrollers(page), `step ${step}: no inner scroll`).toEqual([]);
}

async function goOn(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.locator("[data-tk=go-on]").click();
}

async function walk(page: Page, label: string, withShots: boolean) {
  await page.goto("/u/post-insert/");
  await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
  const preview = page.locator("[data-tk^=category-preview-]:visible");
  await expect(preview).toBeVisible();
  await expect.poll(async () => preview.locator(".tkp-catpre-card, .tkp-catpre-skel").count(), { timeout: 10_000 }).toBe(2);
  expect((await preview.boundingBox())!.width).toBeLessThanOrEqual(360.5);
  expect(await innerScrollers(page), "step 1: no inner scroll").toEqual([]);
  if (withShots) await shots(page, `${label}-step1`);
  await goOn(page);

  await opensAtTop(page, 2);
  await pickCity(page, "Mumbai");
  const roleHere = (await page.locator("#role").count()) > 0;
  if (roleHere) await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(`H21.12b ${label} ${Date.now()}`);
  await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
  if (withShots) await shots(page, `${label}-step2`);
  await goOn(page);
  if (!roleHere) {
    await page.locator("#role").fill("Office assistant");
    await goOn(page);
  }

  await opensAtTop(page, 3);
  // The long photo rules are closed until asked for.
  const rules = page.locator("[data-tk=photo-all-rules]:visible");
  await expect(rules).toHaveCount(1);
  await expect(rules).not.toHaveAttribute("open", /.*/);
  await expect(page.locator("[data-tk=post-shell]").getByText(/the first photo is your cover/i)).toHaveCount(1);
  await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const side = (await page.locator(".tkp-aside").boundingBox())!;
    const main = (await page.locator(".tkp-main").boundingBox())!;
    expect(side.height, "the right column is not taller than the centre card").toBeLessThanOrEqual(main.height + 1);
  }
  if (withShots) await shots(page, `${label}-step3`);
  await goOn(page);

  await opensAtTop(page, 4);
  await page.locator("#phone").fill("9876543210");
  await page.locator("#nickname").fill("Asha");
  if (withShots) await shots(page, `${label}-step4`);
  await goOn(page);

  await opensAtTop(page, 5);
  const list = page.locator("[data-tk^=review-list-]:visible");
  await expect(list.locator("[data-tk=list-mine]")).toHaveCount(1);
  await expect(list.locator("[data-tk=list-mine]")).toContainText("Your ad");
  expect(await list.locator(".tkp-catpre-card:not(.is-mine)").count()).toBeLessThanOrEqual(2);
  expect((await list.boundingBox())!.width).toBeLessThanOrEqual(360.5);
  // All option cards are the same size, chosen or not.
  const widths = await page.locator("[data-tk=boost-choice] [role=radio]").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
  expect(new Set(widths).size, `option widths ${widths.join(",")}`).toBe(1);
  const shadow = await page.locator("[data-tk=boost-choice] [role=radio][aria-checked=true]").evaluate((node) => getComputedStyle(node).boxShadow);
  expect(shadow).toBe("none");
  if (withShots) await shots(page, `${label}-step5`);
}

test.describe("H21.12b layout, scroll and preview", () => {
  test("with free ads left: every step opens at the top and nothing scrolls inside the page", async ({ page, baseURL }, info) => {
    test.setTimeout(300_000);
    const { api, email } = await newUserApi(baseURL!, "layfree");
    await api.dispose();
    await loginUi(page, email, USER_PASSWORD);
    await walk(page, "free-ads-left", info.project.name === "desktop-1440");
  });

  test("with no free ads left: the same", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "one run, for the pictures");
    test.setTimeout(300_000);
    const before = await withLocalDb((db) => db.collection("sites").findOne({ key: "default" }));
    await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: 30, freeAdsPerAccount: 0 } }, { upsert: true }));
    try {
      const { api, email } = await newUserApi(baseURL!, "laypaid");
      await api.dispose();
      await loginUi(page, email, USER_PASSWORD);
      await walk(page, "no-free-ads", true);
    } finally {
      await withLocalDb((db) =>
        db.collection("sites").updateOne({ key: "default" }, { $set: { paidPostingOn: before?.paidPostingOn ?? false, postingFeeCredits: before?.postingFeeCredits ?? 30, freeAdsPerAccount: before?.freeAdsPerAccount ?? 3 } }),
      );
    }
  });
});
