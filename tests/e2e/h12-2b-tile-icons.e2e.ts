import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test, withLocalDb } from "./helpers";

const toast = (page: Page) => page.locator('[data-tk="toast"]');
const saveButton = (page: Page) => page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true });
const ALT = "Two people on a video call (H12.2b test)";

async function setIcon(page: Page, icon: string) {
  await page.goto("/admin/categories/?c=dating", { waitUntil: "networkidle" });
  const select = page.locator("#cat-icon");
  if ((await select.inputValue()) === icon) return;
  await select.selectOption(icon);
  await saveButton(page).click();
  await expect(toast(page)).toContainText("Saved");
}

async function iconClass(page: Page, path: string, selector: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  return (await page.locator(selector).first().getAttribute("class")) ?? "";
}

test.describe("H12.2b follow-ups", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a: a tile with no photo shows the icon from the category's own setting, on /categories/ and on Home", async ({ page, context, baseURL }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const categoriesTile = 'a.h714-cat[href$="/dating/"] .tk-block-icon svg';
    const homeTile = '.tkh-cats a[href$="/dating/"] .tkh-cat-icon svg';
    await signInAdminContext(context, baseURL!);
    await setIcon(page, "");
    try {
      await setIcon(page, "car");
      await expect
        .poll(() => iconClass(page, "/categories/", categoriesTile), { timeout: 150_000, intervals: [4_000] })
        .toContain("lucide-car");
      await expect.poll(() => iconClass(page, "/", homeTile), { timeout: 150_000, intervals: [4_000] }).toContain("lucide-car");
    } finally {
      await setIcon(page, "");
    }
    await expect
      .poll(() => iconClass(page, "/categories/", categoriesTile), { timeout: 150_000, intervals: [4_000] })
      .toContain("lucide-heart");
    await expect.poll(() => iconClass(page, "/", homeTile), { timeout: 150_000, intervals: [4_000] }).toContain("lucide-heart");
  });

  test("b: the How it works picture is the newest Media library picture tagged how-it-works, and no tag means no box", async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await withLocalDb(async (db) => {
      const row = await db.collection("site_media").insertOne({
        url: "/placeholders/buy-and-sell/01.webp",
        objectKey: `h122b-${Date.now()}`,
        alt: ALT,
        width: 1200,
        height: 800,
        bytes: 1000,
        contentType: "image/webp",
        tags: ["how-it-works"],
        uploadedBy: "e2e@example.test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return row.insertedId;
    });
    expect(id).not.toBeNull();
    try {
      await expect
        .poll(
          async () => {
            await page.goto("/how-it-works/", { waitUntil: "networkidle" });
            return page.getByRole("img", { name: ALT }).count();
          },
          { timeout: 330_000, intervals: [5_000] },
        )
        .toBe(1);
      expect(await page.locator("body").innerText()).not.toContain("Video call photo");
    } finally {
      await withLocalDb((db) => db.collection("site_media").deleteOne({ _id: id! }));
    }
  });

  test("c: the Help article breadcrumb shows Help once", async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/help/credits/", { waitUntil: "networkidle" });
      const crumb = (await page.getByRole("navigation", { name: "Breadcrumb" }).innerText()).replace(/\s+/g, " ").trim();
      expect(crumb).not.toMatch(/Help\s*\/\s*Help/);
      expect(crumb).toMatch(/^Help \/ .*Credits/);
    }
  });
});
