import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.173: Add takedown on the Legal takedown tab, and plain words on the SEO screens. */

const SHOTS = process.env.H7173_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H7.173 Reports and SEO", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("Add takedown opens a form with a due time 36 hours after it was received, and the new request shows in the Legal takedown list with its due time (1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const listing = await withLocalDb((db) => db.collection("listings").findOne({ status: "active" }, { projection: { slug: 1, title: 1 } }));
    expect(listing?.slug).toBeTruthy();
    const who = `H7173 lawyer ${Date.now() % 100000}`;
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/reports/?tab=legal");
      await expect(page.getByRole("button", { name: "Add takedown" })).toBeVisible();
      await page.getByRole("button", { name: "Add takedown" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Add takedown" })).toBeVisible();
      const received = await dialog.getByLabel("Received on").inputValue();
      const due = await dialog.getByLabel("Due by").inputValue();
      expect(received).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(new Date(due).getTime() - new Date(received).getTime()).toBe(36 * 3_600_000);
      await dialog.getByLabel("Received on").fill("2026-11-10T09:00");
      await expect(dialog.getByLabel("Due by")).toHaveValue("2026-11-11T21:00");
      expect(await serious(page)).toEqual([]);
      await shot(page, "add-takedown");
      if (size.width === 390) {
        await dialog.getByRole("button", { name: "Cancel" }).click();
        expect(await hasHorizontalScroll(page)).toBe(false);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/reports/?tab=legal");
    await page.getByRole("button", { name: "Add takedown" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add takedown" }).click();
    await expect(dialog.locator('[data-tk="takedown-error"]')).toContainText("Paste the link of the ad, or its ID.");
    await dialog.getByLabel(/^Ad \(link or ID\)/).fill(`/ad/${listing!.slug}/`);
    await dialog.getByLabel(/^Who asked/).fill(who);
    await dialog.getByLabel("How it arrived").selectOption("letter");
    await dialog.getByLabel(/^Reason/).fill("Uses a logo without permission.");
    await dialog.getByRole("button", { name: "Add takedown" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Takedown added to the list.");
    await expect(page.getByRole("tab", { name: /^Legal takedown/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("table, [role=table], ul").first()).toContainText(/Due in|Overdue/);
    const saved = await withLocalDb((db) => db.collection("reports").findOne({ askedBy: who }, { projection: { source: 1, channel: 1, slaAckDueAt: 1 } }));
    expect(saved).toMatchObject({ source: "legal", channel: "letter" });
    await shot(page, "legal-list");
    await withLocalDb((db) => db.collection("reports").deleteMany({ askedBy: who }));
  });

  test("SEO: the tab is called Search engines & AI, issues say Must fix and Should fix, and the hidden-site line shows only while the site is hidden", async ({ page, context, baseURL, request }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const robots = await (await request.get("/robots.txt")).text();
    const hidden = /^User-agent: \*\s*\nDisallow: \/\s*$/m.test(robots);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/seo/");
      await expect(page.getByRole("link", { name: "Search engines & AI" })).toBeVisible();
      await expect(page.getByText("robots, llms & schema")).toHaveCount(0);
      await expect(page.locator('[data-tk="seo-hidden-note"]')).toHaveCount(hidden ? 1 : 0);
      if (hidden) await expect(page.locator('[data-tk="seo-hidden-note"]')).toContainText("The site is hidden from Google until launch, so no page counts as indexable yet.");
      await expect(page.getByText(/\bP0\b|\bP1\b/)).toHaveCount(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "seo-overview");
    }
    await page.goto("/admin/seo/settings/");
    await expect(page.getByRole("heading", { level: 1, name: "Search engines & AI" })).toBeVisible();
  });
});
