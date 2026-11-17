import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test } from "./helpers";

/** H7.144: on a phone the kit pager keeps "1 to N of N", Previous and Next on one row and drops the rows-per-page select. */

const SHOTS = process.env.H144_SHOTS ?? "";
const SCREENS: [string, string][] = [
  ["users", "/admin/users/"],
  ["orders", "/admin/finance/?range=all"],
  ["reports", "/admin/reports/"],
  ["review", "/admin/moderation/"],
];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.locator("[data-tk=pager]").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${name}-390x844.png` });
}

test.describe("H7.144 kit pager on a phone", () => {
  for (const [name, path] of SCREENS) {
    test(`${name}: Previous and Next share one row with the range, and the page-size select is hidden`, async ({ browser, baseURL }, testInfo) => {
      test.skip(testInfo.project.name !== "phone-390", "the pager rule is for phones");
      test.setTimeout(120_000);
      const staff = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
      const page = await staff.newPage();
      await signInAdminContext(staff, baseURL!);
      await page.goto(path);
      const pager = page.locator("[data-tk=pager]").first();
      await expect(pager).toBeVisible();
      await expect(pager.locator(".adm-k-pagesize")).toBeHidden();
      const range = (await pager.locator("[data-tk=pager-range]").boundingBox())!;
      const previous = (await pager.getByRole("button", { name: "Previous" }).boundingBox())!;
      const next = (await pager.getByRole("button", { name: "Next" }).boundingBox())!;
      const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
      expect(Math.abs(middle(range) - middle(previous)), "range and Previous on one row").toBeLessThan(10);
      expect(Math.abs(middle(previous) - middle(next)), "Previous and Next on one row").toBeLessThan(4);
      expect(next.x + next.width, "Next stays inside the screen").toBeLessThanOrEqual(390);
      expect(range.x + range.width, "the range does not run into Previous").toBeLessThanOrEqual(previous.x + 1);
      await shot(page, `h7-144-${name}`);
      await staff.close();
    });
  }

  test("on a desktop the rows-per-page select is still there", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "desktop only");
    const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/users/");
    await expect(page.locator("[data-tk=pager] .adm-k-pagesize").first()).toBeVisible();
    await staff.close();
  });
});
