import { appendFileSync, mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, expect, newApi, registerApi, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";
import { expectPageHealthy, watchConsole } from "./e1c-checks";

/**
 * E1-C: one admin write per screen, and each one must leave an audit entry that says WHO (actor and role), WHAT (action and
 * a summary or label) and WHEN (a time that falls inside the write). The table goes to .shots/e1/audit-table.md.
 */

const TABLE = ".shots/e1/audit-table.md";

type Entry = { action?: string; actorId?: unknown; actorRole?: string; actorType?: string; summary?: string; targetLabel?: string; targetType?: string; createdAt?: Date };

async function adminId() {
  const row = await withLocalDb((db) => db.collection("users").findOne({ email: ADMIN_EMAIL.toLowerCase() }, { projection: { _id: 1 } }));
  expect(row, "the admin account exists").toBeTruthy();
  return String(row!._id);
}

async function auditSince(since: Date): Promise<Entry[]> {
  const rows = await withLocalDb((db) => db.collection("audit_events").find({ createdAt: { $gte: since } }).sort({ createdAt: 1 }).toArray());
  return (rows ?? []) as Entry[];
}

/** After a write: at least one new entry by this admin, with an action, a role, a readable label and a time inside the write. */
async function expectAudited(screen: string, write: string, since: Date, adminKey: string) {
  await expect.poll(async () => (await auditSince(since)).length, { timeout: 15_000, message: `${screen}: an audit entry after "${write}"` }).toBeGreaterThan(0);
  const entries = await auditSince(since);
  const mine = entries.filter((entry) => String(entry.actorId) === adminKey);
  expect(mine.length, `${screen}: an entry whose actor is the admin (${entries.map((entry) => `${entry.action}/${entry.actorType}`).join(", ")})`).toBeGreaterThan(0);
  const entry = mine[mine.length - 1];
  expect(entry.action, `${screen}: the action is named`).toBeTruthy();
  expect(entry.actorRole, `${screen}: the role is kept`).toBeTruthy();
  expect(entry.summary || entry.targetLabel, `${screen}: says what changed`).toBeTruthy();
  expect(entry.createdAt && entry.createdAt.getTime() >= since.getTime() - 1000 && entry.createdAt.getTime() <= Date.now() + 5000, `${screen}: the time is inside the write`).toBe(true);
  mkdirSync(".shots/e1", { recursive: true });
  appendFileSync(TABLE, `| ${screen} | ${write} | ${entry.action} | ${entry.actorRole} | ${entry.summary || entry.targetLabel} | ${entry.createdAt?.toISOString()} |\n`);
}

const toast = (page: Page) => page.locator('[data-tk="toast"]');

test.describe("E1-C audit log: one write per screen", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the writes are the same on a phone; the screens fit a phone in their own specs");
  });

  test("prices: free ads per account, a recharge pack and a coupon", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    await page.goto("/admin/prices/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "prices");

    const free = page.locator("#price-free-ads");
    const original = await free.inputValue();
    let since = new Date();
    await free.fill(String(Number(original) + 1));
    await page.getByRole("group", { name: "Save posting fee, credit price and free ads" }).getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page)).toContainText("saved");
    await expectAudited("Prices & plans", `free ads per account ${original} to ${Number(original) + 1}`, since, admin);
    await free.fill(original);
    await page.getByRole("group", { name: "Save posting fee, credit price and free ads" }).getByRole("button", { name: "Save changes" }).click();

    const stamp = String(Date.now()).slice(-6);
    since = new Date();
    await page.locator("[data-tk=packs]").getByRole("button", { name: "New pack" }).click();
    const drawer = page.locator("[data-tk=drawer]");
    await drawer.locator("#pack-credits").fill(String(1000 + (Date.now() % 8000)));
    await drawer.getByLabel("Free credits on top").fill("3");
    await drawer.getByLabel("Price (₹)").fill("999");
    await drawer.getByRole("button", { name: "Add pack" }).click();
    await expect(toast(page)).toContainText("Pack added.");
    await expectAudited("Prices & plans, recharge packs", "a pack of 333 credits added", since, admin);

    since = new Date();
    await page.locator("[data-tk=coupons]").getByRole("button", { name: "New coupon" }).click();
    await drawer.getByLabel("Code").fill(`E1C-${stamp}`);
    await drawer.locator("#coupon-amount").fill("10");
    await drawer.getByRole("button", { name: "Add coupon" }).click();
    await expect(toast(page)).toContainText(`Coupon E1C-${stamp} added.`);
    await expectAudited("Prices & plans, coupons", `coupon E1C-${stamp} added`, since, admin);
    expect(errors, "no console errors").toEqual([]);
  });

  test("site text: a text changed on the admin screen shows on the public Home page and is audited", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    await page.goto("/admin/ui-text/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "site text");
    await page.getByRole("tab", { name: /^Home page/ }).click();
    const box = page.getByLabel("Search all states", { exact: true });
    const original = await box.inputValue();
    const wording = `Pick a state E1C${String(Date.now()).slice(-4)}`;
    const since = new Date();
    await box.fill(wording);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved 1 text.")).toBeVisible();
    await expectAudited("Site text", `Search all states changed to "${wording}"`, since, admin);

    await expect
      .poll(async () => {
        const html = await (await fetch(`${baseURL}/`)).text();
        return html.includes(wording);
      }, { timeout: 90_000, message: "the new wording is on the public Home page" })
      .toBe(true);
    await box.fill(original);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved 1 text.")).toBeVisible();
    expect(errors, "no console errors").toEqual([]);
  });

  test("users: extra free ads on one account", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    const member = uniqueEmail("e1caudit");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, member);
    await api.dispose();

    await page.goto(`/admin/users/?q=${encodeURIComponent(member)}`, { waitUntil: "networkidle" });
    await expectPageHealthy(page, "users");
    const found = page.locator('[data-tk="server-table"] tbody tr');
    await expect(found).toHaveCount(1);
    await found.first().locator(".adm-k-rowlink").click();
    const extra = page.locator("#user-extra-free");
    await expect(page.locator("[data-tk=drawer]")).toBeVisible();
    await expect(extra).toBeVisible();
    const since = new Date();
    const next = (await extra.inputValue()) === "2" ? "3" : "2";
    await extra.fill(next);
    await page.getByRole("button", { name: "Save extra free ads" }).click();
    await expectAudited("Users", `extra free ads set to ${next}`, since, admin);
    expect(errors, "no console errors").toEqual([]);
  });

  test("page builder: a published headline", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();

    await page.goto("/admin/page-builder/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-tk="home-builder"]')).toBeVisible();
    const stamp = String(Date.now()).slice(-6);
    const since = new Date();
    await page.getByRole("textbox", { name: /Headline \(H1/ }).fill(`E1C headline ${stamp}`);
    await expect(page.locator('[data-tk="save-bar"]')).toHaveAttribute("data-dirty", "no", { timeout: 30_000 });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish now" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Published as version");
    await expectAudited("Page builder", "Home headline published", since, admin);

    expect(errors, "no console errors").toEqual([]);
  });

  test("cities: a new city leaves an audit entry with who, what and when", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    await page.goto("/admin/locations/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "cities");
    const since = new Date();
    await page.getByRole("button", { name: "New place" }).click();
    const dialog = page.getByRole("dialog");
    const name = `E1C Town ${String(Date.now()).slice(-5)}`;
    await dialog.locator("#new-place-kind").selectOption("city");
    await dialog.getByLabel("Name").fill(name);
    await dialog.locator("#new-place-parent").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "Create place" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 20_000 });
    await expectAudited("Cities & areas", `city ${name} added`, since, admin);
    expect(errors, "no console errors").toEqual([]);
  });

  test("categories: a new category leaves an audit entry with who, what and when", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    await page.goto("/admin/categories/", { waitUntil: "networkidle" });
    await expectPageHealthy(page, "categories");
    const since = new Date();
    const stamp = String(Date.now()).slice(-6);
    await page.getByRole("button", { name: "New category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`E1C Cat ${stamp}`);
    await dialog.getByLabel(/^Kind/).selectOption("goods");
    await dialog.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("heading", { name: `E1C Cat ${stamp}` })).toBeVisible({ timeout: 20_000 });
    await expectAudited("Categories", `category E1C Cat ${stamp} added`, since, admin);
    expect(errors, "no console errors").toEqual([]);
  });

  test("SEO center: a saved title template leaves an audit entry with who, what and when", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    page.on("dialog", (dialog) => void dialog.accept());
    const errors = watchConsole(page);
    await signInAdminContext(context, baseURL!);
    const admin = await adminId();
    const stamp = String(Date.now()).slice(-6);
    await page.goto("/admin/seo/templates/", { waitUntil: "networkidle" });
    const since = new Date();
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ label: "Category hub" });
    await selects.nth(1).selectOption({ label: "Dating only" });
    await page.getByLabel("Title", { exact: true }).fill(`E1C${stamp} {category} ads in {city} | {site}`);
    await page.getByLabel("Description", { exact: true }).fill("Browse {category} notices in {city} on {site}. Updated daily with clear photos and honest details.");
    await page.getByRole("button", { name: /Save/ }).first().click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
    await expectAudited("SEO center", "a category page title template saved", since, admin);
    await page.getByRole("button", { name: "Delete this category template" }).click();
    expect(errors, "no console errors").toEqual([]);
  });
});
