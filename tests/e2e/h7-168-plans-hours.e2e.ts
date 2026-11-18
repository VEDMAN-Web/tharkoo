import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.168: promotion plans last a number of hours, and never more than the 72 hours of the longest plan (H11.1 raised the limit from 48). */

const SHOTS = process.env.H7168_SHOTS ?? "";
const row = (page: Page, code: string) => page.locator(`[data-tk="plan-row"][data-code="${code}"]`);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

test.describe("H7.168 plans in hours", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`the plan form asks for hours, refuses more than 72, saves and undoes, at ${size.width}`, async ({ page, context, baseURL }) => {
      test.setTimeout(180_000);
      await signInAdminContext(context, baseURL!);
      await page.setViewportSize(size);
      await page.goto("/admin/prices/");
      await expect(page.locator("[data-tk=plans-table]")).toBeVisible();
      await shot(page, "plans-table");
      await row(page, "bump").getByRole("button", { name: "Edit" }).click();
      const drawer = page.locator("[data-tk=drawer]");
      await expect(drawer.getByLabel("Lasts (hours)")).toBeVisible();
      await expect(drawer).not.toContainText("Days");
      await drawer.getByLabel("Lasts (hours)").fill("73");
      await drawer.getByRole("button", { name: "Save plan" }).click();
      await expect(drawer.getByRole("alert")).toContainText("1 to 72");
      await drawer.getByLabel("Lasts (hours)").fill("36");
      await shot(page, "plan-drawer");
      await drawer.getByRole("button", { name: "Save plan" }).click();
      const toast = page.locator("[data-tk=toast]");
      await expect(toast).toContainText("Bump saved.");
      if (size.width >= 768) await expect(row(page, "bump")).toContainText("36 hours");
      const products = await (await page.request.get("/api/promotions/products")).json();
      expect(products.data.products.find((item: { code: string }) => item.code === "bump")?.durationHours).toBe(36);
      await toast.locator("[data-tk=toast-undo]").click();
      await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
      if (size.width >= 768) await expect(row(page, "bump")).toContainText("24 hours");
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("a plan saved in days before this change is shown in hours and flagged when longer than the longest plan", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const before = await withLocalDb((db) => db.collection("promotion_products").findOne({ code: "new" }, { projection: { durationDays: 1, durationHours: 1 } }));
    expect(before).toBeTruthy();
    await withLocalDb((db) => db.collection("promotion_products").updateOne({ code: "new" }, { $set: { durationDays: 7 }, $unset: { durationHours: "" } }));
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/admin/prices/");
      await expect(row(page, "new")).toContainText("168 hours");
      await expect(row(page, "new").locator('[data-tk="plan-too-long"]')).toContainText("Longer than the longest plan (72 hours)");
      await shot(page, "plan-too-long");
    } finally {
      await withLocalDb((db) => db.collection("promotion_products").updateOne({ code: "new" }, { $set: { durationDays: before!.durationDays, ...(before!.durationHours ? { durationHours: before!.durationHours } : {}) } }));
    }
  });

  test("the plan with no price says it is never offered in Promote", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/prices/");
    const free = row(page, "free");
    if ((await free.count()) > 0) await expect(free.locator('[data-tk="plan-not-offered"]')).toContainText("never offered in Promote");
    await expect(row(page, "bump").locator('[data-tk="plan-not-offered"]')).toHaveCount(0);
  });
});
