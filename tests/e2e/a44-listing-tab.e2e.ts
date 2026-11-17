import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H8.44 (A44): the Listing tab of the Page builder. Heading and intro template per category, and which source an address uses. */

const SHOTS = process.env.A44_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

test.describe("H8.44 Page builder, Listing tab", () => {
  test("write a heading for one category, see the sample, save the draft, publish, and the address shows where its words come from", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/page-builder/");
    await page.getByRole("tab", { name: "Listing pages" }).click();
    const card = page.locator("[data-tk=listing-header-card]");
    await expect(page.getByLabel("Applies to")).toBeVisible();
    await expect(card.getByLabel(/^Heading template/)).toHaveValue("{h1}");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    const select = page.getByLabel("Applies to");
    // Each screen size uses its own category, so a run on one size does not change what the other starts from.
    const slug = await select.locator("option").nth(test.info().project.name.startsWith("phone") ? 1 : 2).getAttribute("value");
    expect(slug).toBeTruthy();
    await select.selectOption(slug!);
    await expect(card.getByText("Using the default")).toBeVisible();
    await expect(card.getByLabel(/^Heading template/)).toBeVisible();

    const wording = `Meet people ${Date.now() % 100000}: {h1}`;
    await card.getByLabel(/^Heading template/).fill(wording);
    await card.getByLabel(/^Intro template/).fill("Profiles checked by our team.");
    await expect(card.locator("[data-tk=header-sample]")).toContainText("Meet people");
    await expect(card.getByText("Unsaved changes")).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("[data-tk=listing-builder]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a44-listing-header");

    await card.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Draft saved.");
    await expect(card.getByText("Draft, not published")).toBeVisible();
    await card.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Published");
    await expect(card.getByText(/Published, version 1/)).toBeVisible();

    // The address shows the template as the source of the heading.
    const ask = page.locator("[data-tk=explain-card]");
    await ask.getByLabel("Address").fill(`/${slug}/`);
    await ask.getByRole("button", { name: "Show the source" }).click();
    const result = ask.locator("[data-tk=explain-result]");
    await expect(result.locator("tr[data-field=h1]")).toContainText("The heading and intro template on this tab");
    await expect(result.locator("tr[data-field=h1]")).toContainText("Meet people");
    await expect(result.getByRole("link", { name: /Content studio/ })).toBeVisible();
    await shot(page, "a44-listing-explain");

    // A bad address is refused with plain words.
    await ask.getByLabel("Address").fill("/a/b/c/d/");
    await ask.getByRole("button", { name: "Show the source" }).click();
    await expect(ask.getByText(/Type a category page/)).toBeVisible();

    // The public category page uses the new heading once the page refreshes.
    await expect
      .poll(async () => {
        const html = await (await page.request.get(`/${slug}/`)).text();
        return /Meet people \d+:/.test(html);
      }, { timeout: 40_000 })
      .toBe(true);
    await staff.close();
  });

  test("only an admin sees the Page builder", async ({ page }) => {
    await page.goto("/admin/page-builder/");
    await expect(page).not.toHaveURL(/\/admin\/page-builder\/$/);
  });
});
