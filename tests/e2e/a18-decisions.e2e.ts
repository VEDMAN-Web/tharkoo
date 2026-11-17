import { mkdirSync } from "node:fs";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A18_SHOTS_DIR || "";
const DAY_MS = 24 * 60 * 60 * 1000;
const FEE = 30;

async function seed() {
  return withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ status: "active" });
    if (!source) throw new Error("no seeded ad");
    await db.collection("sites").updateMany({}, { $set: { postModerationSince: new Date(Date.now() - DAY_MS) } });
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `a18-${Date.now()}@example.test`, displayName: "Paying Seller", status: "active", roles: ["user"], createdAt: new Date() });
    const ids: Record<string, ObjectId> = {};
    for (const [index, title] of ["Paid ad to remove", "Free ad to remove", "Held paid ad"].entries()) {
      const { _id, lastModerationAt, ...rest } = source as Record<string, unknown> & { _id: ObjectId; lastModerationAt?: Date };
      void _id;
      void lastModerationAt;
      const now = new Date(Date.now() - (2 - index) * 60_000);
      const row = await db.collection("listings").insertOne({ ...rest, ownerId: owner, title, status: title === "Held paid ad" ? "pending" : "active", slug: `a18-${index}-${Date.now()}`, publishedAt: now, createdAt: now, updatedAt: now });
      ids[title] = row.insertedId;
    }
    const entry = (delta: number, refType: string, refId: string, balanceAfter: number) => ({
      userId: owner,
      delta,
      reason: delta > 0 ? "credit" : "debit",
      refType,
      refId,
      balanceAfter,
      idempotencyKey: `a18-${refType}-${refId}-${Math.random()}`,
      createdAt: new Date(),
    });
    await db.collection("wallet_entries").insertMany([
      entry(100, "seed", `a18-${owner}`, 100),
      entry(-FEE, "listing_fee", `${ids["Paid ad to remove"]}:0`, 100 - FEE),
      entry(-FEE, "listing_fee", `${ids["Held paid ad"]}:0`, 100 - 2 * FEE),
    ]);
    return { owner, paidId: ids["Paid ad to remove"], freeId: ids["Free ad to remove"], heldId: ids["Held paid ad"] };
  });
}

async function balance(owner: ObjectId) {
  const rows = await withLocalDb((db) => db.collection("wallet_entries").find({ userId: owner }).project({ delta: 1 }).toArray());
  return (rows ?? []).reduce((sum, row) => sum + (row.delta as number), 0);
}

async function status(id: ObjectId) {
  return (await withLocalDb((db) => db.collection("listings").findOne({ _id: id }, { projection: { status: 1 } })))?.status;
}

test.describe("A18 Ad decisions", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("remove a paid live ad with the credits given back, then Undo: the ad is live and the balance is as before", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail("a18mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["moderator"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const seeded = await seed();
    if (!seeded) {
      test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      return;
    }
    const { owner, paidId, freeId, heldId } = seeded;
    const before = await balance(owner);
    expect(before).toBe(100 - 2 * FEE);

    await loginUi(page, email, undefined, "/admin/moderation/");
    await expect(page.getByText("Paid ad to remove").first()).toBeVisible();
    await expect(page.getByText("No flags").first()).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toHaveCount(0);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/review-list-1440x900.png` });
    }
    const removeFor = (title: string) => page.locator("tr, li, article").filter({ hasText: title }).getByRole("button", { name: "Remove ad..." }).first();

    await removeFor("Free ad to remove").click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Give back the .* credits/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    await removeFor("Paid ad to remove").click();
    await expect(dialog).toBeVisible();
    const giveBack = dialog.getByLabel(/Give back the 30 credits/);
    await expect(giveBack).toBeVisible();
    await expect(giveBack).not.toBeChecked();
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/remove-dialog-1440x900.png` });
    }
    await giveBack.check();
    await dialog.getByLabel("Breaks the posting rules").check();
    await dialog.getByRole("button", { name: "Remove ad" }).click();
    await expect(page.getByText(/removed\. 30 credits given back/)).toBeVisible();
    await expect.poll(() => status(paidId)).toBe("removed");
    expect(await balance(owner)).toBe(100 - FEE);
    expect(await status(freeId)).toBe("active");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/removed-toast-1440x900.png` });

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => status(paidId)).toBe("active");
    expect(await balance(owner)).toBe(before);
    await expect(page.getByText(/took back 30 credits/)).toBeVisible();

    await page.goto("/admin/moderation/?tab=held");
    await expect(page.getByText("Held paid ad").first()).toBeVisible();
    await page.getByText("Held paid ad").first().click();
    const drawer = page.locator('[data-tk="review-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Paid 30 credits")).toBeVisible();
    await expect(drawer.getByText(/give back the 30 credits/)).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-drawer-1440x900.png` });
    await page.getByRole("button", { name: "Reject..." }).last().click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Give back the 30 credits/)).not.toBeChecked();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reject-dialog-1440x900.png` });
    await dialog.getByLabel("Photos do not match the text").check();
    await dialog.getByRole("button", { name: "Reject ad" }).click();
    await expect(page.getByText(/rejected\. The seller is told/)).toBeVisible();
    await expect.poll(() => status(heldId)).toBe("rejected");
    expect(await balance(owner)).toBe(before);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => status(heldId)).toBe("pending");
    expect(await balance(owner)).toBe(before);

    if (SHOTS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/moderation/");
      await expect(page.getByText("Paid ad to remove").first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/review-list-390x844.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
      const range = page.locator('[data-tk="pager-range"]');
      await range.scrollIntoViewIfNeeded();
      const rangeBox = await range.boundingBox();
      const nextBox = await page.getByRole("button", { name: "Next" }).first().boundingBox();
      const previousBox = await page.getByRole("button", { name: "Previous" }).first().boundingBox();
      expect(Math.abs((nextBox?.y ?? 0) - (rangeBox?.y ?? 0))).toBeLessThan(24);
      expect(Math.abs((previousBox?.y ?? 0) - (rangeBox?.y ?? 0))).toBeLessThan(24);
      await expect(page.locator(".adm-k-pagesize")).toBeHidden();
      await page.screenshot({ path: `${SHOTS}/review-pager-390x844.png` });
      await page.getByText("Paid ad to remove").first().click();
      await expect(drawer).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/review-drawer-390x844.png` });
      await page.getByRole("button", { name: "Back" }).first().click().catch(() => undefined);
      await page.goto("/admin/moderation/");
      await removeFor("Paid ad to remove").click();
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/remove-dialog-390x844.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });
});
