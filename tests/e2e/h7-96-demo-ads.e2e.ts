import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test } from "./helpers";

const SHOTS = process.env.DEMO_SHOTS_DIR || "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("H7.96 demo ads in the admin All ads screen", () => {
  test("the Demo ads section filters the list and the End button waits for the typed phrase, and nothing is ended", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/admin/ads/?tab=demo");
    const section = page.locator('[data-tk="demo-ads"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-tk="end-demo-note"]')).toContainText("Real ads are never touched.");
    const line = await section.locator("p").first().innerText();
    const live = Number((/([0-9]+) still live/.exec(line) ?? [])[1]);
    expect(live).toBeGreaterThan(0);
    await expect(section.locator('[data-tk="restore-note"]')).toContainText("nothing ended yet");
    await section.locator('[data-tk="end-demo"]').click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toContainText(`End ${live} demo`);
    const end = dialog.getByRole("button", { name: new RegExp(`^End ${live} demo`) });
    const box = dialog.getByLabel(`Type END ${live} to confirm`);
    await box.fill("END");
    await end.click();
    await expect(dialog).toBeVisible();
    await box.fill(`END ${live + 1}`);
    await end.click();
    await expect(dialog).toBeVisible();
    await box.fill(`END ${live}`);
    await shot(page, "demo-ads-ready-1536x674");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await section.scrollIntoViewIfNeeded();
    await shot(page, "demo-ads-1536x674");

    await page.goto("/admin/ads/?tab=demo");
    const rows = page.locator('[data-tk="ads-screen"] tbody tr');
    await expect(rows.first()).toBeVisible();
    const demoText = await rows.allInnerTexts();
    expect(demoText.every((text) => text.includes("Demo"))).toBe(true);
    await shot(page, "demo-ads-filter-1536x674");
    await page.goto("/admin/ads/?kind=real");
    const realText = await page.locator('[data-tk="ads-screen"] tbody tr').allInnerTexts();
    expect(realText.some((text) => text.includes("Demo"))).toBe(false);

    await page.goto("/admin/ads/?tab=demo");
    await expect(page.locator('[data-tk="demo-ads"]')).toContainText(`${live} still live`);
  });
});
