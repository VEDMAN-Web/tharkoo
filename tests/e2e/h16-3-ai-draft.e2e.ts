import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H16.3: the "AI draft" button of the content studio, its drawer, the missing-key message and the banner on an AI draft.
 * No test calls the AI service: the writing itself is covered by unit tests with the service mocked.
 */

const BANNER = "AI draft - check every fact before publishing";
const MISSING = "AI drafts need ANTHROPIC_API_KEY on the server";

async function openAiDraft(page: Page) {
  await page.goto("/admin/content/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveCount(1);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  if (phone) {
    await page.getByRole("button", { name: "More" }).first().click();
    await page.getByRole("menuitem", { name: "AI draft" }).click();
  } else {
    await page.getByRole("button", { name: "AI draft" }).click();
  }
  await expect(page.getByRole("dialog", { name: "AI draft" })).toBeVisible();
}

test.describe("H16.3 AI draft", () => {
  test("the button opens a drawer with the topic fields; a server without the key says so and cannot write", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    test.skip(Boolean(process.env.ANTHROPIC_API_KEY), "this machine has a key set, so the missing-key message does not show");
    await signInAdminContext(context, baseURL!);
    await openAiDraft(page);
    const drawer = page.getByRole("dialog", { name: "AI draft" });
    for (const label of ["Topic", "City (optional)", "Category (optional)", "Keywords (optional)"]) await expect(drawer.getByLabel(label, { exact: false }).first()).toBeVisible();
    await expect(drawer.getByText("Check every fact before publishing")).toBeVisible();
    await expect(drawer.locator('[data-tk="ai-missing"]')).toHaveText(MISSING);
    await expect(drawer.getByRole("button", { name: "Write the draft" })).toBeDisabled();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const serious = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => item.id)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "AI draft" })).toHaveCount(0);
  });

  test("an AI draft shows the banner in the editor and a normal post does not", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const stamp = Date.now().toString(36);
    const ids = await withLocalDb(async (db) => {
      const make = (suffix: string, aiDraft: boolean) => ({
        _id: new ObjectId(),
        kind: "blog",
        slug: `h163-${suffix}-${stamp}`,
        draft: { title: `H163 ${suffix} ${stamp}`, body: { v: 1, nodes: [{ t: "p", text: "A short paragraph." }] } },
        published: null,
        version: 1,
        status: "draft",
        ...(aiDraft ? { aiDraft: true } : {}),
        lastEditedBy: "e2e@example.test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const rows = [make("ai", true), make("plain", false)];
      await db.collection("content_items").insertMany(rows);
      return rows.map((row) => String(row._id));
    });
    await page.goto(`/admin/content/?item=${ids![0]}`, { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="ai-banner"]')).toHaveText(BANNER);
    await page.goto(`/admin/content/?item=${ids![1]}`, { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="editor"]')).toBeVisible();
    await expect(page.locator('[data-tk="ai-banner"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
