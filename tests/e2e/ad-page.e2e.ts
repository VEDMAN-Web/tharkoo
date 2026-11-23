import { expect, loginUi, newUserApi, originHeaders, realAdPath, test } from "./helpers";
import type { Page } from "@playwright/test";

const SLOW_MS = 2500;

async function adPathIn(page: Page, feed: string) {
  await page.goto(feed);
  const link = page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) a[data-ad-link]').first();
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

test.describe("H7.66 ad page", () => {
  test("an ad card of an account that verified nothing shows no verification badge (H7.119)", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "agebadge");
    const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
    const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
    const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
    for (const category of categories) {
      const res = await api.post("/api/listings", {
        headers: originHeaders(baseURL!, "/u/post-insert/"),
        data: { categoryId: category._id, cityId: city.id, title: `Badge desk ${Date.now()}`, description: "A wooden desk in good condition for the whole family." },
      });
      if (res.status() === 201) break;
    }
    await loginUi(page, email, undefined, "/");
    const profile = await page.request.put("/api/auth/seller-profile", {
      headers: originHeaders(baseURL!, "/u/seller-profile/"),
      data: { name: "E2E Seller", city: "Mumbai", whatsapp: "", availableNow: false },
    });
    expect(profile.status(), await profile.text()).toBe(200);
    await page.goto("/u/account/ads/");
    await expect(page.locator("[data-tk=card]").first()).toBeVisible();
    const texts = await page.locator("[data-tk=card] .tk-chk").allInnerTexts();
    expect(texts.filter((text) => /verified/i.test(text))).toEqual([]);
    await api.dispose();
  });

  test("the Area filter shows only once a city is chosen", async ({ page }) => {
    await page.goto("/dating/");
    await expect(page.locator('.tkn-ls-aside select[aria-label="Area"]')).toHaveCount(0);
    await expect(page.locator(".tkn-ls-aside select:disabled")).toHaveCount(0);
    await page.goto("/dating/surat/");
    await expect(page.locator('.tkn-ls-aside select[aria-label="Area"]')).toHaveCount(1);
  });

  test("the main ad has a Report this ad link and a Save heart", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the phone has icon buttons, checked in ad-page-content");
    await page.goto("/ad/demo-1410/");
    const actions = page.locator('[data-tk="ad-actions"]');
    await expect(actions).toBeVisible();
    const report = actions.getByRole("link", { name: "Report this ad" });
    await expect(report).toHaveAttribute("href", /^\/submit-report\/\?ad=.+/);
    expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(36);
    const save = actions.getByRole("button", { name: "Save this ad" });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await save.click();
    await expect(actions.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    await report.click();
    await page.waitForURL(/\/submit-report\/\?ad=/);
  });

  test("a people ad has no price row, only real thumbnails and the people safety lines", async ({ page }) => {
    await page.goto("/ad/demo-1410/");
    await expect(page.locator(".tkn-ad-price")).toHaveCount(0);
    await expect(page.getByText("Price on request")).toHaveCount(0);
    await expect(page.locator(".tkn-thumb-empty")).toHaveCount(0);
    const photos = await page.locator(".tkn-thumbs li").count();
    expect(photos).toBeGreaterThan(0);
    expect(await page.locator(".tkn-thumbs li img").count()).toBe(photos);
    const safe = page.locator('[data-tk="security-tips"]');
    await expect(safe).toContainText("Meet in a public place");
    await expect(safe).not.toContainText("deposit");
    const crumbs = page.locator(".tkn-ad-crumbs");
    const fits = await crumbs.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(fits).toBe(true);
  });

  test("a property ad keeps the deposit advice and no age badge on its cards", async ({ page }) => {
    const path = await adPathIn(page, "/property/bengaluru/");
    await expect(page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) .tk-chk', { hasText: "Age" })).toHaveCount(0);
    await page.goto(path);
    await expect(page.locator('[data-tk="security-tips"]')).toContainText("deposit");
    await expect(page.locator('[data-tk="security-tips"]')).not.toContainText("Meet in a public place");
  });

  test("Chat opens at once with a skeleton and the name, and the conversation exists only after the first message", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "chatlazy");
    await loginUi(page, email, undefined, "/");
    const creates: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/chat/conversations") creates.push(request.url());
    });
    await page.route("**/api/chat/conversations", async (route) => {
      if (route.request().method() === "GET") await new Promise((done) => setTimeout(done, SLOW_MS));
      await route.continue();
    });
    await page.goto(await realAdPath(page, "/dating/bengaluru/"));
    await page.locator("[data-tk=chat]:visible").first().click();
    const panel = page.locator("[data-tk=chat-panel]");
    await expect(panel).toBeVisible({ timeout: 1500 });
    await expect(panel.locator("[data-tk=chat-skeleton]")).toBeVisible();
    await expect(panel.locator("[data-tk=chat-peer]")).not.toHaveText("");
    await expect(panel).not.toContainText(/seller|vendor|buyer/i);
    await expect(panel.getByLabel("Your message")).toBeVisible({ timeout: SLOW_MS * 3 });
    await expect(panel.locator("[data-tk=chat-skeleton]")).toHaveCount(0);
    expect(creates).toEqual([]);

    const before = (await (await api.get("/api/chat/conversations")).json()).data as unknown[];
    expect(before).toEqual([]);

    const text = `Is this still available? ${Date.now()}`;
    await panel.getByLabel("Your message").fill(text);
    await panel.locator("button[type=submit]").click();
    await expect(panel.getByRole("log").getByText(text)).toBeVisible();
    expect(creates.length).toBe(1);
    await api.dispose();
  });
});
