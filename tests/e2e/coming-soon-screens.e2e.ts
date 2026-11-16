import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

async function serious(page: Page) {
  const found = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  for (const [width, height] of [[1536, 674], [1366, 768], [390, 844]] as [number, number][]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${SHOTS}/h7-109-${name}-${width}x${height}.png` });
  }
}

const REDIRECTS: [string, RegExp][] = [
  ["/u/account/media/verify/", /\/u\/account\/media\/$/],
  ["/u/account/media/album/", /\/u\/account\/media\/$/],
  ["/u/account/packs/", /\/u\/account\/credits\/$/],
  ["/u/account/ads/in00001/", /\/u\/account\/ads\/$/],
  ["/u/account/ads/in00001/edit/", /\/u\/account\/ads\/$/],
];

const NOTICES: { path: string; tk: string; heading: string; shot: string }[] = [
  { path: "/u/account/credits/bank/", tk: "bank-off", heading: "Bank transfer is not available", shot: "bank" },
  { path: "/u/account/subscription/", tk: "no-subscription", heading: "No subscription", shot: "subscription" },
  { path: "/u/age-verification/", tk: "age-check", heading: "Age check", shot: "age" },
];

test.describe("H7.109 no Coming soon screens for a signed-in user", () => {
  test("old placeholder routes go to the real screen and the other notices say plainly what is true", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "comingsoon");
    await loginUi(page, email, undefined, "/u/account/");
    for (const [path, target] of REDIRECTS) {
      await page.goto(path);
      await expect(page, path).toHaveURL(target);
    }
    for (const item of NOTICES) {
      await page.goto(item.path);
      await expect(page.getByRole("navigation", { name: "My account" }), item.path).toBeVisible();
      await expect(page.locator(`[data-tk=${item.tk}] h1`), item.path).toHaveText(item.heading);
      await expect(page.getByText(/coming soon/i), item.path).toHaveCount(0);
      expect(await hasHorizontalScroll(page), item.path).toBe(false);
      expect(await serious(page), item.path).toEqual([]);
      await shots(page, item.shot);
    }
    await api.dispose();
  });

  test("analytics shows the views and clicks of the account ads, and an empty state for a new account", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "analytics");
    await loginUi(page, email, undefined, "/u/account/analytics/");
    await expect(page.locator("[data-tk=analytics-empty]")).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
    await shots(page, "analytics-empty");
    expect(await serious(page)).toEqual([]);
    const categories = (await (await page.request.get("/api/categories")).json()).data.categories as { _id: string }[];
    const cities = (await (await page.request.get("/api/locations?type=city")).json()).data.locations as { id: string }[];
    let made = false;
    for (const category of categories) {
      const draft = await page.request.post("/api/listings", {
        headers: { origin: baseURL!, referer: `${baseURL}/u/post-insert/` },
        data: { categoryId: category._id, cityId: cities[0].id, title: `Analytics ad ${Date.now()}`, description: "A friendly description of the ad that is long enough to pass the check." },
      });
      if (draft.status() === 201) {
        made = true;
        break;
      }
    }
    expect(made).toBe(true);
    await page.goto("/u/account/analytics/");
    await expect(page.locator("[data-tk=analytics]")).toBeVisible();
    await expect(page.locator("[data-tk=analytics-row]")).toHaveCount(1);
    await expect(page.locator("[data-tk=analytics-row]")).toContainText("Draft");
    await expect(page.locator("[data-tk=total-views]")).toHaveText("0");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shots(page, "analytics");
    await api.dispose();
  });

  test("delete account: explain, tick, confirm, then a ticket is opened and a confirmation shows; nothing is deleted", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "deleteflow");
    await loginUi(page, email, undefined, "/u/account/delete/");
    const request = page.locator("[data-tk=delete-request]");
    await expect(request).toBeDisabled();
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
    await shots(page, "delete-ask");
    await page.locator("[data-tk=delete-understood]").check();
    await expect(request).toBeEnabled();
    await request.click();
    await expect(page.locator("[data-tk=delete-account]")).toHaveAttribute("data-stage", "sure");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Send the request?");
    await shots(page, "delete-sure");
    await page.locator("[data-tk=delete-confirm]").click();
    await expect(page.locator("[data-tk=delete-sent]")).toContainText("Request received");
    await expect(page.locator("[data-tk=delete-sent]")).toContainText("Nothing has been deleted yet");
    await shots(page, "delete-sent");
    expect(await serious(page)).toEqual([]);
    const tickets = (await (await page.request.get("/api/support/tickets")).json()).data as { subject: string; topic: string }[];
    expect(tickets.some((ticket) => ticket.subject === "Delete my account" && ticket.topic === "my_account")).toBe(true);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    await api.dispose();
  });

  test("going back from the confirm step keeps the account and sends nothing", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "deleteback");
    await loginUi(page, email, undefined, "/u/account/delete/");
    await page.locator("[data-tk=delete-understood]").check();
    await page.locator("[data-tk=delete-request]").click();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(page.locator("[data-tk=delete-account]")).toHaveAttribute("data-stage", "ask");
    const tickets = (await (await page.request.get("/api/support/tickets")).json()).data as unknown[];
    expect(tickets).toHaveLength(0);
    await api.dispose();
  });
});
