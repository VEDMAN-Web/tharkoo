import { expect, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H17.10: Demo ads tab > "Refresh sample ad text": a typed confirmation, the text of sample ads in the covered categories is rewritten
 * (a real area named, nothing else changed), ONE audit entry, and Undo puts the old text back. Local database only.
 */

test.describe("H17.10 Refresh sample ad text", () => {
  test("the button waits for the typed phrase, rewrites sample ad text, writes one audit entry, and Undo puts it back", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the admin screens are for wide screens");
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    const before = await withLocalDb(async (db) => {
      const category = await db.collection("categories").findOne({ slug: "dating" }, { projection: { _id: 1 } });
      const rows = await db.collection("listings").find({ slug: /^demo-/, categoryId: category?._id }, { projection: { title: 1, description: 1, price: 1, status: 1 } }).limit(30).toArray();
      return { category: category?._id, rows };
    });
    expect(before?.rows.length, "the test database has sample ads in a covered category").toBeGreaterThan(0);

    await page.goto("/admin/ads/?tab=demo");
    const section = page.locator('[data-tk="demo-ads"]');
    await section.locator('[data-tk="refresh-demo-text"]').click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toContainText("Rewrite the text of");
    const count = Number(/Rewrite the text of ([0-9,]+) sample/.exec(await dialog.innerText())?.[1].replace(/,/g, ""));
    expect(count).toBeGreaterThan(0);
    const go = dialog.getByRole("button", { name: "Rewrite sample ad text" });
    const box = dialog.getByLabel(`Type REFRESH ${count} to confirm`);
    await box.fill("REFRESH");
    await go.click();
    await expect(dialog).toBeVisible();
    await box.fill(`REFRESH ${count}`);
    await go.click();
    const toast = page.locator('[data-tk="toast"]');
    await expect(toast).toContainText("Rewrote the text of", { timeout: 60_000 });

    const after = await withLocalDb(async (db) => {
      const rows = await db.collection("listings").find({ _id: { $in: before!.rows.map((row) => row._id) } }, { projection: { title: 1, description: 1, price: 1, status: 1 } }).toArray();
      const events = await db.collection("audit_events").countDocuments({ action: "listing.demo.text" });
      return { rows, events };
    });
    expect(after?.events, "one audit entry for the whole refresh").toBe(1);
    const changed = after!.rows.filter((row) => row.title !== before!.rows.find((old) => String(old._id) === String(row._id))?.title);
    expect(changed.length, "sample ad text was rewritten").toBeGreaterThan(0);
    for (const row of after!.rows) {
      const old = before!.rows.find((item) => String(item._id) === String(row._id))!;
      expect(row.price, "the price is not touched").toBe(old.price);
      expect(row.status, "the status is not touched").toBe(old.status);
    }

    await toast.getByRole("button", { name: /undo/i }).click();
    await expect(page.locator('[data-tk="toast"]').last()).toContainText("Undone", { timeout: 60_000 });
    const restored = await withLocalDb((db) => db.collection("listings").find({ _id: { $in: before!.rows.map((row) => row._id) } }, { projection: { title: 1, description: 1 } }).toArray());
    for (const row of restored ?? []) {
      const old = before!.rows.find((item) => String(item._id) === String(row._id))!;
      expect(row.title).toBe(old.title);
      expect(row.description).toBe(old.description);
    }
  });
});
