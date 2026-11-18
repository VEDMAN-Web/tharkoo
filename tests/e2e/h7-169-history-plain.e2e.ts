import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.169: History & undo in plain words: field names, values and audit rows. */

const SHOTS = process.env.H7169_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

async function seed() {
  const stamp = Date.now();
  const changeId = new ObjectId();
  await withLocalDb(async (db) => {
    await db.collection("audit_events").insertMany([
      {
        _id: changeId,
        actorType: "admin",
        actorRole: "admin",
        action: "plan.update",
        targetType: "promotion_plan",
        targetId: "plan-h7169",
        targetLabel: `Bump H7169 ${stamp % 10000}`,
        summary: `Changed Bump H7169: Lasts (hours), Shown`,
        before: { durationHours: 24, enabled: true, homeOrder: 3, startsAt: "2026-06-15T10:00:00.000Z", roles: ["admin", "support"] },
        after: { durationHours: 36, enabled: false, homeOrder: 4, startsAt: "2026-06-16T10:00:00.000Z", roles: ["admin"] },
        requestId: "e2e",
        createdAt: new Date(stamp - 60_000),
      },
      { actorType: "user", action: "listing.contact_reveal", targetType: "listing", targetId: "ad-h7169", requestId: "e2e", createdAt: new Date(stamp - 120_000) },
    ]);
  });
  return String(changeId);
}

test.describe("H7.169 History & undo in plain words", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`the change details say fields and values in words, at ${size.width}`, async ({ page, context, baseURL }) => {
      test.setTimeout(180_000);
      const id = await seed();
      await signInAdminContext(context, baseURL!);
      await page.setViewportSize(size);
      await page.goto(`/admin/history/?open=${id}`);
      const drawer = page.locator('[data-tk="history-drawer"]');
      await expect(drawer).toBeVisible();
      const diff = drawer.locator('[data-tk="diff"]');
      await expect(diff).toContainText("Lasts (hours)");
      await expect(diff).toContainText("Place on the Home page");
      await expect(diff).toContainText("Shown");
      await expect(diff).toContainText("Yes");
      await expect(diff).toContainText("No");
      await expect(diff).toContainText("15 Jun, 3:30 pm");
      await expect(diff).toContainText("admin, support");
      for (const code of ["durationHours", "homeOrder", "startsAt", "true", "false", "T10:00:00"]) await expect(diff).not.toContainText(code);
      expect(await hasHorizontalScroll(page)).toBe(false);
      const serious = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
      expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
      await shot(page, "change-details");
    });
  }

  test("the full audit log says what happened in a sentence, never as a code", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await seed();
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/history/?tab=audit&days=30");
      const rows = page.locator('[data-tk="server-table"]');
      await expect(rows).toContainText("A visitor showed a phone number");
      await expect(rows).toContainText("An ad");
      await expect(rows).not.toContainText("listing.contact_reveal");
      await expect(rows).not.toContainText("ad-h7169");
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "audit-log");
    }
  });
});
