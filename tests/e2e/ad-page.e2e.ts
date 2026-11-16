import { expect, loginUi, newUserApi, test } from "./helpers";
import type { Page } from "@playwright/test";

const SLOW_MS = 2500;

async function adPathIn(page: Page, feed: string) {
  await page.goto(feed);
  const link = page.locator('[data-tk=card] a[href*="/ad/"]').first();
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

test.describe("H7.66 ad page", () => {
  test("the main ad has a Report this ad link and a Save heart", async ({ page }) => {
    await page.goto("/ad/demo-1410/");
    const actions = page.locator('[data-tk="ad-actions"]');
    await expect(actions).toBeVisible();
    const report = actions.getByRole("link", { name: "Report this ad" });
    await expect(report).toHaveAttribute("href", /^\/submit-report\/\?ad=.+/);
    expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const save = actions.getByRole("button", { name: "Save ad" });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await save.click();
    await expect(actions.getByRole("button", { name: "Remove saved ad" })).toHaveAttribute("aria-pressed", "true");
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
    await expect(page.locator('[data-tk=card] .tk-chk', { hasText: "Age" })).toHaveCount(0);
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
    await page.goto("/ad/demo-1410/");
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
