import { mkdirSync } from "node:fs";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, test, uniqueEmail, withLocalDb, withoutAddress } from "./helpers";

const SHOTS = process.env.A21_SHOTS_DIR || "";
const FEE = 30;
const HOUR_MS = 60 * 60 * 1000;

async function seed() {
  return withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ status: "active" });
    if (!source) throw new Error("no seeded ad");
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `a21-${Date.now()}@example.test`, displayName: "Reported Seller", status: "active", roles: ["user"], createdAt: new Date() });
    const make = async (title: string, index: number) => {
      const { _id, lastModerationAt, ...rest } = source as Record<string, unknown> & { _id: ObjectId; lastModerationAt?: Date };
      void _id;
      void lastModerationAt;
      const now = new Date(Date.now() - (index + 1) * HOUR_MS);
      return (await db.collection("listings").insertOne({ ...withoutAddress(rest), ownerId: owner, title, status: "active", slug: `a21-${index}-${Date.now()}`, publishedAt: now, createdAt: now, updatedAt: now })).insertedId;
    };
    const fake = await make("Fake photos ad", 0);
    const wrong = await make("Wrong price ad", 1);
    const legal = await make("Photo used without consent", 2);
    const entry = (delta: number, refType: string, refId: string, balanceAfter: number) => ({
      userId: owner,
      delta,
      reason: delta > 0 ? "credit" : "debit",
      refType,
      refId,
      balanceAfter,
      idempotencyKey: `a21-${refType}-${refId}-${Math.random()}`,
      createdAt: new Date(),
    });
    await db.collection("wallet_entries").insertMany([entry(100, "seed", `a21-${owner}`, 100), entry(-FEE, "listing_fee", `${fake}:0`, 100 - FEE)]);
    const report = (listingId: ObjectId, extra: Record<string, unknown>) => ({
      listingId,
      reason: "fake",
      details: "Photos are from a social profile",
      severity: "S3",
      status: "open",
      createdAt: new Date(Date.now() - 2 * HOUR_MS),
      updatedAt: new Date(),
      ...extra,
    });
    await db.collection("reports").insertMany([
      report(fake, { severity: "S1", reason: "prohibited_content", details: "Asks for advance payment" }),
      report(fake, {}),
      report(wrong, { reason: "wrong_contact", details: "Wrong number" }),
      report(legal, { source: "legal", reason: "other", severity: "S2", details: "Photo used without consent", slaAckDueAt: new Date(Date.now() + 3 * HOUR_MS) }),
    ]);
    return { owner, fake };
  });
}

async function balance(owner: ObjectId) {
  const rows = await withLocalDb((db) => db.collection("wallet_entries").find({ userId: owner }).project({ delta: 1 }).toArray());
  return (rows ?? []).reduce((sum, row) => sum + (row.delta as number), 0);
}

async function state(owner: ObjectId, fake: ObjectId) {
  return withLocalDb(async (db) => ({
    ad: (await db.collection("listings").findOne({ _id: fake }, { projection: { status: 1 } }))?.status as string,
    seller: (await db.collection("users").findOne({ _id: owner }, { projection: { status: 1 } }))?.status as string,
    open: await db.collection("reports").countDocuments({ listingId: fake, status: "open" }),
  }));
}

test.describe("A21 Reports", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("remove an ad and ban the seller from a report with the credits given back, then Undo brings everything back", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail("a21ts");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    const promoted = await setRoles(email, ["trust_safety"]);
    test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const seeded = await seed();
    if (!seeded) {
      test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      return;
    }
    const { owner, fake } = seeded;
    const before = await balance(owner);
    expect(before).toBe(100 - FEE);

    await loginUi(page, email, undefined, "/admin/reports/");
    await expect(page.locator("h1")).toHaveText("Reports");
    await expect(page.getByRole("tab", { name: /Open/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Legal takedown/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Closed/ })).toBeVisible();
    await expect(page.getByText("Urgent").first()).toBeVisible();
    await expect(page.getByText("2 reports")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/reports-list-1440x900.png` });
    }

    await page.getByText("Fake photos ad").first().click();
    const drawer = page.locator('[data-tk="report-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Asks for advance payment")).toBeVisible();
    await expect(drawer.getByText("Prohibited content")).toBeVisible();
    await drawer.getByLabel(/Note/).fill("Asking for payment before meeting is not allowed.");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-drawer-1440x900.png` });
    await page.getByRole("button", { name: "More" }).last().click();
    await page.getByRole("menuitem", { name: /Remove ad and ban seller/ }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    const giveBack = dialog.getByLabel(/Give back the 30 credits/);
    await expect(giveBack).not.toBeChecked();
    await giveBack.check();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-dialog-1440x900.png` });
    await dialog.getByRole("button", { name: "Remove ad and ban seller" }).click();
    await expect(page.getByText(/Removed the ad and banned the seller/)).toBeVisible();
    await expect.poll(async () => (await state(owner, fake))?.ad).toBe("removed");
    expect((await state(owner, fake))?.seller).toBe("suspended");
    expect(await balance(owner)).toBe(100);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-toast-1440x900.png` });

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await state(owner, fake))?.ad).toBe("active");
    expect(await state(owner, fake)).toMatchObject({ seller: "active", open: 2 });
    expect(await balance(owner)).toBe(before);

    await page.goto("/admin/reports/?tab=legal");
    await expect(page.getByText(/Due in/).first()).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reports-legal-1440x900.png` });

    if (SHOTS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/reports/");
      await expect(page.getByText("Fake photos ad").first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/reports-list-390x844.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
      await page.getByText("Fake photos ad").first().click();
      await expect(drawer).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/reports-drawer-390x844.png` });
    }
  });
});
