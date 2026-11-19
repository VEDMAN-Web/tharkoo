import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** FIX-15 (E1-C6): on a phone the All ads rows have visible tick boxes with 44 px targets, and the bulk bar (Pause, Remove...) works. */

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({});
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `F15 Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const ids: ObjectId[] = [];
    for (const name of ["one", "two", "three"]) {
      const id = new ObjectId();
      ids.push(id);
      await db.collection("listings").insertOne({
        _id: id,
        ownerId: owner,
        status: "active",
        categoryId: category?._id ?? new ObjectId(),
        title: `F15 ${tag} sofa ${name}`,
        slug: `f15-${tag}-${id.toHexString().slice(-6)}`,
        description: "A well kept thing for sale.",
        feedHidden: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return { ids, owner };
  });
}

const statusOf = (id: ObjectId) => withLocalDb(async (db) => (await db.collection("listings").findOne({ _id: id }))?.status as string);

test("All ads: tick boxes are visible with 44 px targets, two rows can be ticked, Pause works with Undo, Remove asks first", async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390", "the phone layout; the desktop table keeps its small tick boxes");
  test.setTimeout(180_000);
  const tag = `t${Date.now().toString(36)}`;
  const seeded = await seed(tag);
  if (!seeded) {
    test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    return;
  }
  const { ids, owner } = seeded;
  try {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    await page.getByRole("searchbox", { name: "Search ads" }).fill(`F15 ${tag}`);
    const rows = page.locator('[data-tk="ads-screen"] tbody tr');
    await expect(rows).toHaveCount(3);

    // Every row has a visible tick box, at least 44 px by 44 px, inside the screen.
    const view = page.viewportSize()!;
    for (let index = 0; index < 3; index += 1) {
      const box = rows.nth(index).locator("input.adm-k-check");
      await expect(box).toBeVisible();
      const rect = (await box.boundingBox())!;
      expect(rect.width, `tick box ${index} width`).toBeGreaterThanOrEqual(44);
      expect(rect.height, `tick box ${index} height`).toBeGreaterThanOrEqual(44);
      expect(rect.x + rect.width, "inside the screen").toBeLessThanOrEqual(view.width);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);

    // Tick two rows: the bulk bar says 2 selected, with big buttons.
    await page.getByRole("checkbox", { name: `Select F15 ${tag} sofa one` }).check();
    await page.getByRole("checkbox", { name: `Select F15 ${tag} sofa two` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();
    const bar = page.locator('[data-tk="bulk-bar"]');
    for (const name of ["Pause", "Remove..."]) {
      const rect = (await bar.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(rect.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    await bar.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByText(/Paused: 2 ads/)).toBeVisible();
    expect(await statusOf(ids[0])).toBe("paused");
    expect(await statusOf(ids[1])).toBe("paused");
    expect(await statusOf(ids[2])).toBe("active");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/Undone\. 2 ads are back as before/)).toBeVisible();
    expect(await statusOf(ids[0])).toBe("active");

    // Remove asks for a reason first; Cancel leaves the ad alone.
    await page.getByRole("checkbox", { name: `Select F15 ${tag} sofa three` }).check();
    await page.locator('[data-tk="bulk-bar"]').getByRole("button", { name: "Remove..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await statusOf(ids[2])).toBe("active");
  } finally {
    await withLocalDb(async (db) => {
      await db.collection("listings").deleteMany({ _id: { $in: ids } });
      await db.collection("users").deleteMany({ _id: owner });
      await db.collection("audit_events").deleteMany({ targetId: { $in: ids.map(String) } });
    });
  }
});
