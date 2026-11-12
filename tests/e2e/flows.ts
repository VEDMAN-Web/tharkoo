import { expect, type Page } from "@playwright/test";
import { adminApi, loginUi, newApi, originHeaders, PNG, registerApi, uniqueEmail, USER_PASSWORD } from "./helpers";

export interface LiveAd {
  email: string;
  title: string;
  /** Public ad path, e.g. /ad/in00012/ */
  adHref: string;
  /** Listing id as used by the API. */
  listingId: string;
}

/**
 * Registers a poster, walks the 3-step post form, passes KYC (admin approves through the API)
 * and publishes. Leaves `page` signed in as the poster. Jobs in Mumbai.
 */
export async function createLiveAd(page: Page, base: string, prefix = "poster"): Promise<LiveAd> {
  const email = uniqueEmail(prefix);
  const title = `E2E ${prefix} ${Date.now()}`;
  const signup = await newApi(base);
  await registerApi(signup, base, email);
  await signup.dispose();

  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
  await page.locator("#category").selectOption({ label: "Jobs" });
  await page.locator("#city").selectOption({ label: "Mumbai" });
  await page.locator("#nickname").fill("Asha");
  await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
  await page.locator("#phone").fill("9876543210");
  await page.locator("#consent-terms").check();
  await page.locator("#consent-adult").check();
  await page.locator("[data-tk=go-on]").click();
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
  await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
  await page.locator("[data-tk=go-on]").click();
  await page.locator("button", { hasText: "PUBLISH" }).click();
  const verify = page.locator("[data-tk=verify-id]");
  await expect(verify).toBeVisible();
  const draftUrl = page.url();
  await verify.click();
  await page.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
  await page.locator("#selfie-id").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: PNG });
  await page.locator("[data-tk=kyc-submit]").click();
  await expect(page.locator("[data-tk=kyc-note]")).toContainText(/review/i);

  await approveLatestKyc(base);

  await page.goto(draftUrl.includes("step=") ? draftUrl.replace(/step=\d+/, "step=3") : draftUrl);
  await page.locator("[data-tk=card]").waitFor();
  await page.locator("button", { hasText: "PUBLISH" }).click();
  await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toBeVisible();

  const own = await page.request.get("/api/listings/?pageSize=100");
  expect(own.status()).toBe(200);
  const rows = ((await own.json()).data?.items || []) as { id: string; title: string; slug?: string }[];
  const row = rows.find((item) => item.title.includes(title));
  expect(row, "the published ad is in the poster's list").toBeTruthy();
  return { email, title, adHref: `/ad/${row!.slug}/`, listingId: row!.id };
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
