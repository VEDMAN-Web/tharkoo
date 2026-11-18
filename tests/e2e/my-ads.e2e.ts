import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test } from "./helpers";
import type { APIRequestContext, Page } from "@playwright/test";

async function draftAd(api: APIRequestContext, base: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) return ((await res.json()).data as { id: string }).id;
  }
  throw new Error("No category accepted a draft ad");
}

async function sellerWithDraft(page: Page, base: string, prefix: string) {
  const { api, email } = await newUserApi(base, prefix);
  const id = await draftAd(api, base, `Draft desk ${Date.now()}`);
  await loginUi(page, email, undefined, "/");
  const profile = await page.request.put("/api/auth/seller-profile", {
    headers: originHeaders(base, "/u/seller-profile/"),
    data: { name: "E2E Seller", city: "Mumbai", whatsapp: "", availableNow: false },
  });
  expect(profile.status(), await profile.text()).toBe(200);
  await page.goto("/u/account/ads/");
  return id;
}

test.describe("H7.61 my ads and support form", () => {
  test("a draft card opens the finish flow, shows a clean card, and asks twice before deleting", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    page.on("dialog", () => {
      throw new Error("the browser confirm box must not open");
    });
    const id = await sellerWithDraft(page, baseURL!, "draftcard");
    const card = page.locator("article.tk-card", { has: page.locator('[data-tk="owner-card"]') }).first();
    await expect(card).toBeVisible();
    await expect(card.locator(".tkp-owner-counts")).toContainText(/views? . \d+ clicks/);

    const link = card.locator("a.tk-card-link");
    await expect(link).toHaveAttribute("href", `/u/post-insert/?draft=${id}&step=2`);
    await expect(card.locator("a.tk-card-hit")).toHaveAttribute("href", `/u/post-insert/?draft=${id}&step=2`);

    const title = await card.locator(".tk-card-title").boundingBox();
    const photo = await card.locator(".tk-card-photo").boundingBox();
    const box = await card.boundingBox();
    expect(title!.width).toBeGreaterThan(100);
    expect(photo!.width).toBeGreaterThan(box!.width * 0.9);
    expect(photo!.height).toBeLessThan(photo!.width);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await expect(card.getByText("Not live yet. Finish the steps to send it for review.")).toBeVisible();
    await expect(card.getByRole("link", { name: "Finish your ad" })).toHaveAttribute("href", `/u/post-insert/?draft=${id}&step=5`);

    const del = card.getByRole("button", { name: "Delete", exact: true });
    await del.click();
    await expect(card.getByRole("button", { name: "Tap again to delete" })).toBeVisible();
    expect((await page.request.get(`/api/listings/by-id/${id}`)).status()).toBe(200);
    await expect(card.getByRole("button", { name: "Delete", exact: true })).toBeVisible({ timeout: 8000 });
    expect((await page.request.get(`/api/listings/by-id/${id}`)).status()).toBe(200);

    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await card.getByRole("button", { name: "Tap again to delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    await expect(page.locator('[data-tk="owner-card"]')).toHaveCount(0);
    await page.goto("/u/account/ads/");
    await expect(page.locator('[data-tk="owner-card"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="my-ads-empty"]')).toContainText("You have no ads yet");
  });

  test("Finish your ad opens the last step of the draft", async ({ page, baseURL }) => {
    const id = await sellerWithDraft(page, baseURL!, "finish");
    await page.getByRole("link", { name: "Finish your ad" }).first().click();
    await page.waitForURL(new RegExp(`draft=${id}.*step=5|step=5.*draft=${id}`));
  });

  test("on a phone the up-arrow is gone on panel pages and on the ad page", async ({ page, baseURL }) => {
    test.skip(!test.info().project.name.startsWith("phone"), "phone layout only");
    const { email } = await newUserApi(baseURL!, "arrow");
    await loginUi(page, email, undefined, "/u/account/dashboard/");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    await expect(page.locator(".tkn-top")).toBeHidden();
    await page.goto("/ad/demo-1410/");
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(500);
    await expect(page.locator(".tkn-top")).toBeHidden();
    await expect(page.locator(".tkn-chat-bubble")).toBeHidden();
  });

  test("the new ticket form shows visible boxes and a styled file button", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "ticketform");
    await loginUi(page, email, undefined, "/u/account/support/new/");
    for (const selector of ["#support-topic", "#support-subject", "#support-body"]) {
      const field = page.locator(selector);
      await expect(field).toBeVisible();
      const look = await field.evaluate((node) => {
        const css = getComputedStyle(node);
        return { border: css.borderTopWidth, style: css.borderTopStyle, color: css.borderTopColor, background: css.backgroundColor };
      });
      expect(look.style).toBe("solid");
      expect(parseFloat(look.border)).toBeGreaterThanOrEqual(1);
      expect(look.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(look.background).toBe("rgb(255, 255, 255)");
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator("#support-screenshots")).toHaveClass(/tk-file/);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
