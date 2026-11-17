import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, signInAdminContext, test } from "./helpers";
import { fillNewPostAd } from "./flows";

/** H8.25 (A25): Settings essentials. */

const SHOTS = process.env.A25_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

test.describe("H8.25 Settings", () => {
  test("the screen has one H1, a section list, the emergency switches on top and no raw editor; a switch asks to confirm and can be undone", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/settings/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    const nav = page.locator("[data-tk=settings-nav]");
    for (const label of ["Emergency switches", "Posting rules", "Undo windows", "Search engines"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    await expect(page.locator("[data-tk=collection-editor]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a25-settings");

    const holdSwitch = page.locator('[data-tk=emergency-switch][data-key=holdNewAds]').getByRole("switch");
    await expect(holdSwitch).toHaveAttribute("aria-checked", "false");
    await holdSwitch.click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await expect(dialog.getByRole("heading", { name: /^Turn on: Hold every new ad for review\?/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(holdSwitch).toHaveAttribute("aria-checked", "false");
    await holdSwitch.click();
    await shot(page, "a25-emergency-confirm", false);
    await dialog.getByRole("button", { name: "Turn on" }).click();
    const toast = page.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast).toContainText("Hold every new ad for review");
    await expect(holdSwitch).toHaveAttribute("aria-checked", "true");
    await toast.locator("[data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(holdSwitch).toHaveAttribute("aria-checked", "false");
    await staff.close();
  });

  test("undo windows validate and save, post-moderation turns on and off, search engines and the moved code-only login show", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/settings/");
    const undo = page.locator("[data-tk=undo-windows]");
    await undo.getByLabel("Ad edits").fill("0");
    await undo.getByRole("button", { name: "Save undo windows" }).click();
    await expect(undo.getByRole("alert")).toContainText("whole number from 1 to 365");
    await undo.getByLabel("Ad edits").fill("45");
    await undo.getByRole("button", { name: "Save undo windows" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Undo windows saved.");
    await expect(undo.getByLabel("Ad edits")).toHaveValue("45");
    await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(undo.getByLabel("Ad edits")).toHaveValue("30");

    const post = page.locator("[data-tk=post-moderation]");
    await post.getByRole("switch").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("checked after they go live");
    await expect(post.locator("[data-tk=post-moderation-since]")).toBeVisible();
    await post.getByRole("switch").click();
    await expect(post.locator("[data-tk=post-moderation-since]")).toHaveCount(0);

    const search = page.locator("[data-tk=search-engines]");
    await expect(search).toContainText(/Hidden from Google|Open to Google/);
    await expect(search.getByRole("link", { name: "Open SEO" })).toBeVisible();
    await expect(page.locator("#sign-in")).toContainText("Code-only login");
    await page.goto("/admin/");
    await expect(page.getByText("Code-only login")).toHaveCount(0);
    await staff.close();
  });

  test("the raw site record is read only: shown to a superadmin inside a closed panel, with no editor", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/settings/");
    const raw = page.locator("[data-tk=raw-site]");
    await expect(raw).toBeVisible();
    await raw.getByText("Show the saved record").click();
    await expect(raw.locator("pre")).toContainText('"key": "default"');
    await expect(raw.getByRole("textbox")).toHaveCount(0);
    await staff.close();
  });
  test("hold every new ad: the next ad is posted but waits for review, it is not public, and turning the switch off ends the hold", async ({ browser, page, baseURL }) => {
    test.setTimeout(240_000);
    const staff = await browser.newContext({ baseURL });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await admin.goto("/admin/settings/");
    const holdSwitch = admin.locator("[data-tk=emergency-switch][data-key=holdNewAds]").getByRole("switch");
    await holdSwitch.click();
    await admin.locator("[data-tk=reason-dialog]").getByRole("button", { name: "Turn on" }).click();
    await expect(holdSwitch).toHaveAttribute("aria-checked", "true");
    try {
      const poster = await newUserApi(baseURL!, "a25hold");
      await poster.api.dispose();
      await loginUi(page, poster.email, undefined, "/u/post-insert/");
      const title = `E2E held ${Date.now()}`;
      const ad = await fillNewPostAd(page, baseURL!, { title, held: true });
      const own = await page.request.get("/api/listings/?pageSize=100");
      const row = (((await own.json()).data?.items || []) as { id: string; title: string; status: string }[]).find((item) => item.id === ad.listingId);
      expect(row?.status).toBe("pending");
      expect((await page.request.get(`/ad/${ad.slug}/`)).status()).not.toBe(200);
    } finally {
      await holdSwitch.click();
      await expect(holdSwitch).toHaveAttribute("aria-checked", "false");
      await staff.close();
    }
  });
});
