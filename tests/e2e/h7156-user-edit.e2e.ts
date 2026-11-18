import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, setRoles, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.156: user and vendor management in the Users drawer: profile, vendor profile, verified badge, close account, list filters. */

const SHOTS = process.env.H7156_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

type Seeded = { id: string; email: string; name: string };

/** A seller with a live ad, an approved ID check and a phone number, in the test database. */
async function seedSeller(prefix: string): Promise<Seeded> {
  const member = await newUserApi(process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? "4342"}`, prefix);
  await member.api.dispose();
  const suffix = String(Date.now()).slice(-6);
  const seeded = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: member.email.toLowerCase() });
    if (!user) return null;
    const name = `Vendor ${suffix}`;
    await db.collection("users").updateOne({ _id: user._id }, { $set: { displayName: name, verificationStatus: "approved", sellerProfile: { name, city: "Pune", whatsapp: "+919800000001", availableNow: false, completedAt: new Date() } } });
    await db.collection("phone_identities").insertOne({ userId: user._id, phone: `+9198${suffix}01`, createdAt: new Date() });
    await db.collection("listings").insertOne({ ownerId: user._id, title: `Vendor ad ${suffix}`, slug: `vendor-ad-${suffix}`, status: "active", createdAt: new Date() });
    return { id: String(user._id), email: member.email, name };
  });
  expect(seeded).not.toBeNull();
  return seeded!;
}

const userDoc = (id: string) => withLocalDb((db) => db.collection("users").findOne({ email: { $exists: true }, $expr: { $eq: [{ $toString: "$_id" }, id] } }));

test.describe("H7.156 user and vendor management", () => {
  test("edit the profile, the vendor profile and the verified badge, close the account and undo it, and filter the list", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const seller = await seedSeller("h7156a");
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto(`/admin/users/?open=${seller.id}`);
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();

    // Overview: the verified badge card.
    const badge = drawer.locator("[data-tk=badge-card]");
    await expect(badge).toContainText("ID verified");
    await expect(badge.getByRole("link", { name: "Open ID checks" })).toBeVisible();
    await shot(page, "h7156-overview");
    await badge.getByRole("button", { name: "Remove badge..." }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await dialog.getByLabel("Photo no longer matches").check();
    await dialog.getByRole("button", { name: "Remove badge" }).last().click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("verified badge");
    await expect(drawer.locator("[data-tk=badge-card]")).toContainText("No ID check yet");
    await page.locator("[data-tk=toast-undo]").last().click();
    await expect(drawer.locator("[data-tk=badge-card]")).toContainText("ID verified");

    // Profile.
    await drawer.getByRole("tab", { name: "Profile" }).click();
    const form = drawer.locator("[data-tk=profile-tab]");
    await expect(form.locator("[data-tk=profile-email]")).toHaveText(seller.email);
    await expect(form.getByText("The email cannot be changed here")).toBeVisible();
    const newName = `${seller.name} Edited`;
    await form.getByLabel("Name").fill(newName);
    await form.getByLabel("City").fill("Mumbai");
    await form.getByLabel("Phone number").fill("not a phone");
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(form.locator("[data-tk=profile-error]")).toContainText("10-digit mobile number");
    await form.getByLabel("Phone number").fill(`98${String(Date.now()).slice(-8)}`);
    const axe = await new AxeBuilder({ page }).include("[data-tk=drawer]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "h7156-profile");
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Saved the name, city and phone number");
    expect((await userDoc(seller.id))?.displayName).toBe(newName);
    expect((await userDoc(seller.id))?.sellerProfile?.city).toBe("Mumbai");

    // Vendor profile and earnings.
    await drawer.getByRole("tab", { name: "Vendor" }).click();
    const vendor = drawer.locator("[data-tk=vendor-tab]");
    await vendor.getByLabel(/^About/).fill("Home tuition in Pune since 2019.");
    await vendor.getByRole("switch", { name: "Hide this vendor profile" }).click();
    await vendor.getByRole("button", { name: "Save vendor profile" }).click();
    await expect(vendor.locator("[data-tk=vendor-error]")).toContainText("Say why");
    await vendor.getByLabel(/^Reason/).fill("Complaints are under review");
    await vendor.getByRole("button", { name: "Save vendor profile" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("vendor profile");
    await expect(vendor.getByText("Vendor profile hidden")).toBeVisible();
    await expect(vendor.locator("[data-tk=vendor-earnings]")).toContainText("Waiting to be paid out");
    await expect(vendor.getByRole("link", { name: "Open Payouts" })).toBeVisible();
    await shot(page, "h7156-vendor");
    expect((await userDoc(seller.id))?.sellerProfile?.hidden).toBe(true);

    // Close the account with the typed word, then undo.
    await drawer.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Close account..." }).click();
    const close = page.locator("[data-tk=reason-dialog]");
    await close.getByLabel("Fraud or abuse").check();
    await close.getByRole("button", { name: "Close account" }).last().click();
    await expect(close.getByText("Type CLOSE to confirm.", { exact: true })).toBeVisible();
    await shot(page, "h7156-close-dialog");
    await close.getByLabel(/^Type CLOSE/).fill("CLOSE");
    await close.getByRole("button", { name: "Close account" }).last().click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("account closed");
    await expect.poll(async () => (await userDoc(seller.id))?.status).toBe("deleted");
    const owner = await userDoc(seller.id);
    expect(await withLocalDb((db) => db.collection("listings").countDocuments({ ownerId: owner!._id, status: "active" }))).toBe(0);
    await page.locator("[data-tk=toast-undo]").last().click();
    await expect.poll(async () => (await userDoc(seller.id))?.status).toBe("active");
    // The ads come back a moment after the account does, so wait for them.
    await expect.poll(async () => withLocalDb((db) => db.collection("listings").countDocuments({ ownerId: owner!._id, status: "active" }))).toBe(1);

    // The list filters.
    await page.goto(`/admin/users/?q=${encodeURIComponent(seller.email)}&ads=1`);
    await expect(page.locator("[data-tk=filter-chip]", { hasText: "Has live ads" })).toBeVisible();
    await expect(page.locator("[data-tk=server-table] tbody tr").first()).toContainText(seller.name.slice(0, 8));
    await page.goto(`/admin/users/?q=${encodeURIComponent(seller.email)}&credits=1`);
    await expect(page.locator("[data-tk=users-empty]")).toContainText("No users match");
    await staff.close();
  });

  test("support can edit a profile but has no Remove badge or Close account", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const seller = await seedSeller("h7156s");
    const agent = await newUserApi(baseURL!, "h7156agent");
    await agent.api.dispose();
    expect(await setRoles(agent.email, ["support"])).toBe(true);
    await loginUi(page, agent.email, undefined, `/admin/users/?open=${seller.id}`);
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-tk=badge-card]")).toContainText("ID verified");
    await expect(drawer.getByRole("button", { name: "Remove badge..." })).toHaveCount(0);
    await drawer.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Close account..." })).toHaveCount(0);
    await drawer.getByRole("button", { name: "More" }).click();
    await drawer.getByRole("tab", { name: "Profile" }).click();
    await drawer.getByLabel("Name").fill(`${seller.name} By Support`);
    await drawer.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Saved the name");
    await shot(page, "h7156-support");
  });
});
