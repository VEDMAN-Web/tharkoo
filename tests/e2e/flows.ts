import { expect, type Page } from "@playwright/test";
import { adminApi, loginUi, newApi, originHeaders, PNG, registerApi, uniqueEmail, USER_PASSWORD } from "./helpers";

/** The state of each city the flows use. */
const STATE_OF: Record<string, string> = { Mumbai: "Maharashtra", Pune: "Maharashtra", Bengaluru: "Karnataka", Delhi: "Delhi" };

export interface LiveAd {
  email: string;
  title: string;
  /** Public ad path, e.g. /ad/in00012/ */
  adHref: string;
  /** Listing id as used by the API. */
  listingId: string;
}

/**
 * H7.5: walks the New design post-ad form (five steps: category, details, photos, contact, review) and publishes.
 * The page must already be the post-ad page for a signed-in poster. Uses the "Jobs" category and Mumbai by default.
 * Returns the new listing's id and the title it was saved with.
 */
export async function fillNewPostAd(page: Page, base: string, options: { title: string; category?: string; city?: string; held?: boolean }) {
  const { title, category = "Jobs", city = "Mumbai", held = false } = options;
  // Step 1: category.
  await page.locator(".tkp-tile", { hasText: category }).click();
  await page.locator("[data-tk=go-on]").click();
  // Step 2: details.
  // H19.6: State first, then the city of that state.
  if (await page.locator("#state").count()) await page.locator("#state").selectOption({ label: STATE_OF[city] ?? "Maharashtra" });
  await page.locator("#city").selectOption({ label: city });
  await page.locator("#nickname").fill("Asha");
  const roleHere = (await page.locator("#role").count()) > 0;
  if (roleHere) await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
  await page.locator("[data-tk=go-on]").click();
  if (!roleHere) {
    await page.locator("#role").fill("Office assistant");
    await page.locator("[data-tk=go-on]").click();
  }
  // Step 3: photos (the photo step has its own Continue).
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
  await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
  await page.locator("[data-tk=go-on]").click();
  // Step 4: contact.
  await page.locator("#phone").fill("9876543210");
  await page.locator("[data-tk=go-on]").click();
  // Step 5: review. The ID-check switch is off by default (H6.14), so PUBLISH goes straight to live.
  await page.locator("#consent-terms").check();
  await page.locator("#consent-adult").check();
  await page.locator(".tkp-nav button", { hasText: "PUBLISH" }).click();
  // H8.25: with "Hold every new ad for review" on, the ad is posted but waits, and the success screen says it will be checked.
  if (held) await expect(page.locator("[data-tk=post-success]")).toHaveAttribute("data-state", "review");
  else await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toBeVisible();

  const own = await page.request.get("/api/listings/?pageSize=100");
  expect(own.status()).toBe(200);
  const rows = ((await own.json()).data?.items || []) as { id: string; title: string; slug?: string }[];
  const row = rows.find((item) => item.title.includes(title));
  expect(row, "the published ad is in the poster's list").toBeTruthy();
  return { title, listingId: row!.id, slug: row!.slug || "" };
}

/**
 * Registers a poster, walks the post form (fillNewPostAd), and publishes. Leaves `page` signed in as the poster.
 * Jobs in Mumbai.
 */
export async function createLiveAd(page: Page, base: string, prefix = "poster"): Promise<LiveAd> {
  const email = uniqueEmail(prefix);
  const title = `E2E ${prefix} ${Date.now()}`;
  const signup = await newApi(base);
  await registerApi(signup, base, email);
  await signup.dispose();

  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
  const ad = await fillNewPostAd(page, base, { title });
  return { email, title, adHref: `/ad/${ad.slug}/`, listingId: ad.listingId };
}

/** Admin approves the newest pending identity check (API, as an admin would in the queue). */
export async function approveLatestKyc(base: string) {
  const admin = await adminApi(base);
  const queue = await admin.get("/api/admin/verifications/?page=1&pageSize=50");
  expect(queue.status()).toBe(200);
  const items = ((await queue.json()).data?.items || []) as { id: string }[];
  expect(items.length).toBeGreaterThan(0);
  const decision = await admin.post(`/api/admin/verifications/${items[items.length - 1].id}/decision/`, {
    headers: originHeaders(base, "/admin/"),
    data: { decision: "approved", reason: "Documents match the account" },
  });
  expect(decision.status(), await decision.text()).toBe(200);
  await admin.dispose();
}
