import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, PNG, test } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

const PAGES: { path: string; active: string; heading: RegExp; shot: string }[] = [
  { path: "/u/account/kyc/", active: "Settings", heading: /^Identity check$/, shot: "kyc" },
  { path: "/u/account/media/", active: "My ads", heading: /^My photos & videos$/, shot: "media" },
  { path: "/u/account/edit-account/", active: "Settings", heading: /^Settings$/, shot: "settings" },
  { path: "/u/account/delete/", active: "Settings", heading: /^Delete your account$/, shot: "delete" },
];

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H7.81 old account pages in the panel", () => {
  test("identity check, photos and videos, settings and delete sit in the panel, with plain words, no sideways scroll and axe 0", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "acctpages");
    await loginUi(page, email, undefined, "/u/account/");
    for (const item of PAGES) {
      await page.goto(item.path);
      const nav = page.getByRole("navigation", { name: "My account" });
      await expect(nav, item.path).toBeVisible();
      await expect(nav.locator("a[aria-current='page']"), item.path).toContainText(item.active);
      await expect(page.getByRole("heading", { level: 1 }), item.path).toHaveText(item.heading);
      await expect(page.getByText("Current status")).toHaveCount(0);
      expect(await hasHorizontalScroll(page), item.path).toBe(false);
      expect(await serious(page), item.path).toEqual([]);
      if (SHOTS) {
        for (const [width, height] of [[1536, 674], [1366, 768], [390, 844]] as [number, number][]) {
          await page.setViewportSize({ width, height });
          await page.screenshot({ path: `${SHOTS}/h7-81-${item.shot}-${width}x${height}.png` });
        }
        await page.setViewportSize(info.project.use.viewport ?? { width: 1440, height: 900 });
      }
    }
    await api.dispose();
  });

  test("the identity check says ID checked, Being checked or Not checked yet, never a raw status", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "kycwords");
    await loginUi(page, email, undefined, "/u/account/kyc/");
    await expect(page.locator("[data-tk=kyc-status]")).toContainText("Not checked yet");
    await expect(page.locator("[data-tk=kyc-form]")).toBeVisible();
    await expect(page.getByText(/unsubmitted|pending_review|approved|rejected/)).toHaveCount(0);
    await api.dispose();
  });

  test("the identity check uses the site's upload boxes, shows a preview after choosing, and sends for review", async ({ page, baseURL }, info) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "kycboxes");
    await loginUi(page, email, undefined, "/u/account/kyc/");
    const front = page.locator("[data-tk=upload-front]");
    const selfie = page.locator("[data-tk=upload-selfie]");
    await expect(front).toContainText("Add photo of your ID");
    await expect(selfie).toContainText("Add a photo of you holding it");
    for (const box of [front, selfie]) {
      expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(120);
      expect(await box.evaluate((node) => getComputedStyle(node).borderStyle)).toBe("dashed");
      await expect(box.locator("svg")).toBeVisible();
    }
    await expect(page.getByText("No file chosen")).toHaveCount(0);
    await page.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
    await expect(front.locator("img.up-drop-thumb")).toBeVisible();
    await expect(front).toContainText("Photo added");
    expect(await serious(page)).toEqual([]);
    if (SHOTS) {
      for (const [width, height] of [[1536, 674], [1366, 768], [390, 844]] as [number, number][]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({ path: `${SHOTS}/h7-81b-kyc-boxes-${width}x${height}.png` });
      }
      await page.setViewportSize(info.project.use.viewport ?? { width: 1440, height: 900 });
    }
    await page.locator("#selfie-id").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await page.locator("[data-tk=kyc-submit]").click();
    await expect(page.locator("[data-tk=kyc-note]")).toContainText(/review/i);
    await expect(page.locator("[data-tk=kyc-status]")).toContainText("Being checked");
    await api.dispose();
  });

  test("settings has the name with a Change link and no Manage button", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "settingsrows");
    await loginUi(page, email, undefined, "/u/account/edit-account/");
    await expect(page.locator("[data-tk=setting-name]")).toContainText("E2E");
    await expect(page.locator("[data-tk=setting-name] a")).toHaveAttribute("href", /\/u\/seller-profile\//);
    await expect(page.getByText("Manage", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-tk=setting-email]")).toContainText(email.toLowerCase());
    await api.dispose();
  });

  test("the seller profile picks the city from the list by its display name", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { api, email } = await newUserApi(baseURL!, "cityselect");
    await loginUi(page, email, undefined, "/u/seller-profile/");
    const city = page.locator("select[name=city]");
    await expect(city).toBeVisible();
    await expect(city.locator("option").nth(1)).not.toHaveText(/^[a-z-]+$/);
    await expect(city.locator("option", { hasText: "Mumbai" })).toHaveCount(1);
    await page.locator("input[name=name]").fill("Asha");
    await city.selectOption({ label: "Mumbai" });
    await page.getByRole("button", { name: /continue|save/i }).click();
    await expect.poll(async () => ((await (await page.request.get("/api/auth/me")).json()).data?.user?.seller?.city ?? "") as string).toBe("Mumbai");
    await page.goto("/u/seller-profile/");
    await expect(page.locator("select[name=city]")).toHaveValue("Mumbai");
    await api.dispose();
  });
});
