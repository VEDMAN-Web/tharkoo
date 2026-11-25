import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, grantCredits, loginUi, newUserApi, originHeaders, test, USER_PASSWORD, withLocalDb } from "./helpers";

/**
 * H21.5a: Step 5, Review and publish. Options first, the video calls row (locked for Free, an inline "i" panel and a switch for TOP and Super Top),
 * the list preview with "YOUR AD", the earnings panel in three states, the summary with Edit links that come back to Review, the cost box, the ticks
 * (18+ only until accepted once) and the button label. Set SHOTS_DIR to save screenshots (390 and 1440).
 */
const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string, viewportOnly = false) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: !viewportOnly });
}

async function toReview(page: Page, baseURL: string, credits: number, opts: { adultAccepted?: boolean } = {}) {
  const owner = await newUserApi(baseURL, "h215");
  const categories = (await (await owner.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await owner.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const created = await owner.api.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category._id, cityId: city.id, title: `Review check ${Date.now()}`, description: "A friendly description of the ad that is long enough." },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  if (opts.adultAccepted === false) await withLocalDb((db) => db.collection("users").updateOne({ email: owner.email.toLowerCase() }, { $unset: { attestedAdultAt: "" } }));
  await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${id}&step=5`);
  if (credits > 0) await grantCredits(page, credits);
  await page.goto(`/u/post-insert/?draft=${id}&step=5`);
  await expect(page.locator("[data-tk=review-step]")).toBeVisible();
  return { id, owner };
}

const radio = (page: Page, code: string) => page.locator(`[data-tk=boost-choice] [role=radio][data-code=${code}]`);

test.describe("H21.5a step 5 review", () => {
  test("options first, the video row, the list preview, the earnings panel and the cost box", async ({ page, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    await toReview(page, baseURL!, 2000);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review and publish");
    await expect(page.locator("[data-tk=step-help]")).toHaveText("Check everything once. Your ad goes live as soon as you publish.");

    // Order on the page: options, video row, summary, cost box.
    const y = async (selector: string) => (await page.locator(selector).first().boundingBox())!.y;
    expect(await y("[data-tk=review-options]")).toBeLessThan(await y("[data-tk=video-row]"));
    expect(await y("[data-tk=video-row]")).toBeLessThan(await y("[data-tk=review-summary]"));
    expect(await y("[data-tk=review-summary]")).toBeLessThan(await y("[data-tk=review-cost]"));

    // Free: the video row is locked and grey, the earnings panel says it is locked, "YOUR AD" is in ALL ADS.
    await expect(radio(page, "free")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-tk=video-row]")).toHaveAttribute("data-state", "locked");
    await expect(page.locator("[data-tk=video-row]")).toContainText("Needs TOP or Super Top");
    await expect(page.locator("[data-tk=video-row] [role=switch]")).toHaveAttribute("aria-disabled", "true");
    const side = page.locator(phone ? "[data-tk=review-list-inline]" : "[data-tk=review-list-side]");
    await expect(side).toBeVisible();
    await expect(side).toHaveAttribute("data-kind", "free");
    await expect(side.locator("[data-tk=list-caption]")).toContainText("Free:");
    await expect(side.locator("[data-tk=list-mine]")).toHaveCount(1);
    const earn = page.locator("[data-tk=earn-panel]:visible");
    await expect(earn).toHaveAttribute("data-state", "locked");
    await expect(page.locator("[data-tk=cost-total]")).toHaveText("Free");
    await expect(page.locator("[data-tk=go-on]")).toHaveText("Publish ad");
    await shot(page, "review-free");

    // TOP: the row is live with an inline "i" panel; the cost box, the list and the button follow the option.
    await radio(page, "top").click();
    await expect(page.locator("[data-tk=video-row]")).toHaveAttribute("data-state", "on");
    await expect(side).toHaveAttribute("data-kind", "top");
    await expect(side.locator("[data-tk=list-caption]")).toContainText("TOP:");
    await expect(page.locator("[data-tk=cost-boost]")).toContainText("TOP");
    await expect(page.locator("[data-tk=cost-total]")).toContainText("credits");
    await expect(page.locator("[data-tk=go-on]")).toContainText("Publish with TOP");
    await expect(page.locator("[data-tk=earn-panel]:visible")).toHaveAttribute("data-state", "on");
    await expect(page.locator("[data-tk=earn-panel]:visible")).toContainText("People who want to see your staff before purchase, can video call you directly.");
    const info1 = page.locator("[data-tk=video-info]");
    await expect(info1).toHaveAttribute("aria-expanded", "false");
    await info1.click();
    await expect(info1).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("[data-tk=video-info-panel]")).toContainText("Why we allow video calls");
    await expect(page.locator("[data-tk=video-info-panel]")).toContainText("Video call rules");
    await shot(page, "review-top-info");
    await info1.click();
    // The switch turns the calls off: the row says Off and the panel changes.
    const sw = page.locator("[data-tk=video-row] [role=switch]");
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("[data-tk=video-row]")).toHaveAttribute("data-state", "off");
    await expect(page.locator("[data-tk=earn-panel]:visible")).toHaveAttribute("data-state", "off");
    await shot(page, "review-top-off");
    await sw.click();

    // Super Top moves "YOUR AD" to the first, biggest card.
    await radio(page, "super-top").click();
    await expect(side).toHaveAttribute("data-kind", "super");
    await expect(side.locator(".tkp-catpre-card.wide.is-mine")).toHaveCount(1);
    await expect(side.locator("[data-tk=list-caption]")).toContainText("Super Top:");

    // The summary has an Edit link per part, and the balance line says what is left.
    for (const key of ["category", "details", "photos", "contact"]) await expect(page.locator(`[data-tk=edit-${key}]`)).toBeVisible();
    await expect(page.locator("[data-tk=boost-balance]")).toContainText("Balance");
    await expect(page.locator("[data-tk=boost-balance]")).toContainText("after publishing");

    // Only the page scrolls, and the bubble is visible.
    const inner = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *")).filter((node) => { const s = getComputedStyle(node); return s.display !== "none" && (s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1; }).length);
    expect(inner).toBe(0);
    await shot(page, "review-super");
    await expect(page.locator(".tkn-chat-bubble")).toBeVisible();
    await shot(page, "review-bubble", true);
  });

  test("not enough credits: the warning, Buy credits opens the ad-credit sheet, and the button says so", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await toReview(page, baseURL!, 0);
    await radio(page, "top").click();
    const low = page.locator("[data-tk=boost-short]");
    await expect(low).toContainText("Not enough credits for TOP.");
    await expect(low).toContainText("You need");
    await expect(page.locator("[data-tk=go-on]")).toHaveText("Buy credits to continue");
    await shot(page, "review-low-credits");
    await page.locator("[data-tk=boost-buy]").click();
    await expect(page.locator("[data-tk=credit-packs]")).toBeVisible();
    await expect(page.locator("[data-tk=wallet-tab-call]")).toHaveCount(0);
    await shot(page, "review-low-credits-sheet", true);
  });

  test("Edit jumps to a step and comes back to Review; the 18+ tick is asked only until it was accepted once", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await toReview(page, baseURL!, 0);
    // The account has accepted before: only the Terms tick.
    await expect(page.locator("#consent-terms")).toBeVisible();
    await expect(page.locator("#consent-adult")).toHaveCount(0);
    await page.locator("[data-tk=edit-photos]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 3 of 5");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
    await expect(page.locator("[data-tk=review-step]")).toBeVisible();
  });

  test("an account that never accepted 18+ sees the tick", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await toReview(page, baseURL!, 0, { adultAccepted: false });
    await expect(page.locator("#consent-adult")).toBeVisible();
    await expect(page.locator("#consent-terms")).toBeVisible();
  });
});
