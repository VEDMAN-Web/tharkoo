import { mkdirSync } from "node:fs";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, setRoles, test, uniqueEmail, withLocalDb } from "./helpers";

const SHOTS = process.env.A23_SHOTS_DIR || "";
const MIN_MS = 60 * 1000;

async function seed() {
  return withLocalDb(async (db) => {
    const people = [
      ["Riya Thakur", "1998-04-02", 41],
      ["Sneha Rao", "1995-09-14", 62],
    ] as const;
    const ids: Record<string, { check: ObjectId; user: ObjectId }> = {};
    for (const [name, born, waitedMinutes] of people) {
      const user = new ObjectId();
      await db.collection("users").insertOne({ _id: user, email: `${name.split(" ")[0].toLowerCase()}-${Date.now()}@example.test`, displayName: name, status: "active", roles: ["user"], verificationStatus: "pending_review", createdAt: new Date() });
      const doc = async (key: string) => (await db.collection("media_assets").insertOne({ ownerId: user, kind: "id_document", objectKey: `private:${key}-${user}`, contentType: "image/jpeg", status: "cleared", createdAt: new Date() })).insertedId;
      const documents = { front: String(await doc("front")), back: String(await doc("back")), selfie: String(await doc("selfie")) };
      const at = new Date(Date.now() - waitedMinutes * MIN_MS);
      const check = (await db.collection("identity_verifications").insertOne({ userId: user, provider: "manual", documentRef: documents.front, documents, status: "pending_review", dateOfBirthAsserted: new Date(born), createdAt: at })).insertedId;
      ids[name] = { check, user };
    }
    return ids;
  });
}

async function snapshot(check: ObjectId, user: ObjectId) {
  return withLocalDb(async (db) => ({
    check: await db.collection("identity_verifications").findOne({ _id: check }, { projection: { status: 1, documents: 1 } }),
    userStatus: (await db.collection("users").findOne({ _id: user }, { projection: { verificationStatus: 1 } }))?.verificationStatus as string,
  }));
}

test.describe("A23 ID checks", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("approve a check, Reopen it, and the documents and the waiting list are as before", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail("a23mod");
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
    const riya = seeded["Riya Thakur"];
    const before = await snapshot(riya.check, riya.user);

    await loginUi(page, email, undefined, "/admin/kyc/");
    await expect(page.locator("h1")).toHaveText("ID checks");
    await expect(page.getByRole("tab", { name: /Waiting/ })).toContainText("2");
    await expect(page.getByText("Riya Thakur").first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/id-list-1440x900.png` });
    }

    await page.getByText("Riya Thakur").first().click();
    const drawer = page.locator('[data-tk="id-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Selfie")).toBeVisible();
    await expect(drawer.getByText("ID front")).toBeVisible();
    await expect(drawer.getByText("ID back")).toBeVisible();
    await expect(drawer.getByText("18+")).toBeVisible();
    await expect(drawer.locator('[data-tk="id-photo-missing"]')).toHaveCount(3);
    await expect(drawer.getByText("Photo not available")).toHaveCount(3);
    await expect(drawer.locator("img")).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/id-drawer-1440x900.png` });
    await page.getByRole("button", { name: "Reject..." }).last().click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/id-reject-dialog-1440x900.png` });
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Approve" }).last().click();
    await expect(page.getByText(/Riya Thakur approved/)).toBeVisible();
    await expect.poll(async () => (await snapshot(riya.check, riya.user))?.check?.status).toBe("approved");
    expect((await snapshot(riya.check, riya.user))?.userStatus).toBe("approved");
    await expect(page.getByRole("tab", { name: /Waiting/ })).toContainText("1");

    await page.goto("/admin/kyc/?tab=approved");
    await expect(page.getByText("Riya Thakur").first()).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/id-approved-1440x900.png` });
    await page.getByText("Riya Thakur").first().click();
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByText(/Reopened/)).toBeVisible();
    await expect.poll(async () => (await snapshot(riya.check, riya.user))?.check?.status).toBe("pending_review");
    const after = await snapshot(riya.check, riya.user);
    expect(after?.userStatus).toBe("pending_review");
    expect(after?.check?.documents).toEqual(before?.check?.documents);
    await page.goto("/admin/kyc/");
    await expect(page.getByRole("tab", { name: /Waiting/ })).toContainText("2");

    if (SHOTS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await expect(page.getByText("Riya Thakur").first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/id-list-390x844.png` });
      expect(await hasHorizontalScroll(page)).toBe(false);
      await page.getByText("Riya Thakur").first().click();
      await expect(drawer).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/id-drawer-390x844.png` });
    }
  });
});
