import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H16.1: Admin > Cities & areas > "Import cities and areas (CSV)": preview, import, the new place on the public site, and Undo,
 * all on the LOCAL database. The admin screens are checked at 1440 (the admin is for a wide screen).
 */

const SHOTS = join(process.cwd(), ".shots", "H16.1b");

const CITY_CSV = [
  "name,state,slug,isDistrictHq,population,source",
  "H161 Testpur,Gujarat,h161-testpur,yes,,https://example.test/h161",
  "Mumbai,Maharashtra,mumbai,no,,https://example.test/m",
  "H161 Nowhere,Narnia,h161-nowhere,no,,",
].join("\n");

async function openImport(page: Page) {
  await page.goto("/admin/locations/");
  await expect(page.locator('[data-tk="places-screen"]')).toBeVisible();
  await page.getByRole("button", { name: "Import cities and areas (CSV)" }).click();
  await expect(page.getByRole("dialog", { name: "Import cities and areas (CSV)" })).toBeVisible();
}

const cityRows = (slug: string) => withLocalDb((db) => db.collection("locations").countDocuments({ type: "city", slug }));

test.describe("H16.1 import cities and areas", () => {
  test("a file of my own: preview says new, already there and problem; Import adds only the new city; the city page works; Undo removes it", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are checked at 1440");
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await withLocalDb((db) => db.collection("locations").deleteMany({ slug: "h161-testpur" }));
    const mumbaiBefore = await withLocalDb((db) => db.collection("locations").findOne({ type: "city", slug: "mumbai" }, { projection: { name: 1, order: 1, enabled: 1 } }));

    await openImport(page);
    const dialog = page.getByRole("dialog");
    await dialog.locator('[data-tk="import-source-upload"]').check();
    await dialog.locator('[data-tk="import-file"]').setInputFiles({ name: "cities.csv", mimeType: "text/csv", buffer: Buffer.from(CITY_CSV, "utf8") });
    await dialog.getByRole("button", { name: "Preview" }).click();
    const preview = dialog.locator('[data-tk="import-preview"]');
    await expect(preview.locator('[data-tk="import-new"]')).toHaveText("1 new");
    await expect(preview.locator('[data-tk="import-existing"]')).toHaveText("1 already there");
    await expect(preview.locator('[data-tk="import-problems"]')).toHaveText("1 problem");
    await expect(preview.locator('[data-tk="import-problem-list"]')).toContainText('The state "Narnia" is not on Tharkoo');
    expect(await cityRows("h161-testpur"), "preview writes nothing").toBe(0);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, "preview-1440.png") });

    await dialog.getByRole("button", { name: "Import 1 new cities" }).click();
    await expect(dialog.locator('[data-tk="import-done"]')).toContainText("Added 1 cities. 1 were already there and 1 were skipped.");
    expect(await cityRows("h161-testpur")).toBe(1);
    expect(await cityRows("h161-nowhere")).toBe(0);
    await page.screenshot({ path: join(SHOTS, "imported-1440.png") });

    const events = await withLocalDb((db) => db.collection("audit_events").find({ action: "location.import", summary: "Imported 1 cities (1 already there, 1 skipped)" }).toArray());
    expect(events, "one audit entry for the whole import").toHaveLength(1);
    expect(["admin", "superadmin"], "the audit entry records who").toContain((events![0] as { actorRole?: string }).actorRole);
    const mumbaiAfter = await withLocalDb((db) => db.collection("locations").findOne({ type: "city", slug: "mumbai" }, { projection: { name: 1, order: 1, enabled: 1 } }));
    expect(mumbaiAfter, "an old city is left exactly as it was").toEqual(mumbaiBefore);

    const city = await page.request.get("/cities/h161-testpur/");
    expect(city.status()).toBe(200);
    expect(await city.text()).toContain("H161 Testpur");

    await dialog.getByRole("button", { name: "Undo this import" }).click();
    await expect.poll(() => cityRows("h161-testpur"), { timeout: 15_000 }).toBe(0);
    expect((await page.request.get("/cities/h161-testpur/")).status()).toBe(404);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await staff.close();
  });

  test("the built-in cities list previews with no problems and plenty of new cities, and a preview adds nothing", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are checked at 1440");
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const before = await withLocalDb((db) => db.collection("locations").countDocuments({ type: "city" }));
    await openImport(page);
    const dialog = page.getByRole("dialog");
    await dialog.locator('[data-tk="import-source-cities"]').check();
    await dialog.getByRole("button", { name: "Preview" }).click();
    const preview = dialog.locator('[data-tk="import-preview"]');
    await expect(preview.locator('[data-tk="import-problems"]')).toHaveText("0 problems");
    const fresh = Number(((await preview.locator('[data-tk="import-new"]').innerText()) || "").replace(/[^\d]/g, ""));
    expect(fresh).toBeGreaterThanOrEqual(700);
    expect(await withLocalDb((db) => db.collection("locations").countDocuments({ type: "city" })), "a preview writes nothing").toBe(before);
    await staff.close();
  });
});
