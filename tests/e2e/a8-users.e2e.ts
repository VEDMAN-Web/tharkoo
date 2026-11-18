import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, setRoles, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.8 (A8): the Users screen at /admin/users/. */

const SHOTS = process.env.A8_SHOTS ?? "";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function admin(page: Page, baseURL: string) {
  await signInAdminContext(page.context(), baseURL);
}

/** A user with a linked phone number, and a name the search can start with. */
async function seedUser(baseURL: string, prefix: string, phone: string, baseName: string) {
  const name = `${baseName} ${Date.now().toString(36)}`;
  const { api, email } = await newUserApi(baseURL, prefix);
  await api.dispose();
  const id = await withLocalDb(async (db) => {
    const user = await db.collection("users").findOneAndUpdate({ email: email.toLowerCase() }, { $set: { displayName: name } }, { returnDocument: "after" });
    await db.collection("phone_identities").insertOne({ userId: user!._id, phone, createdAt: new Date() });
    await db.collection("sessions").deleteMany({ userId: user!._id });
    await db.collection("sessions").insertOne({ userId: user!._id, tokenHash: `a8-${new ObjectId()}`, expiresAt: new Date(Date.now() + 1e7), createdAt: new Date(Date.now() - 41 * 60_000) });
    return String(user!._id);
  });
  return { email, id: id!, name, phone };
}

function rowFor(page: Page, text: string) {
  return page.locator("[data-tk=server-table] tbody tr", { hasText: text });
}

test.describe("H8.8 admin Users", () => {
  test("lists real users with tabs and counts, not ads", async ({ page, baseURL }) => {
    const person = await seedUser(baseURL!, "a8list", `+9198${String(Date.now()).slice(-8)}`, "Zed Listperson");
    await admin(page, baseURL!);
    await page.goto("/admin/users/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("[data-tk=users-screen]")).toBeVisible();
    for (const label of ["All", "Sellers", "ID waiting", "Banned", "Staff"]) await expect(page.getByRole("tab", { name: new RegExp(`^${label}`) })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
    await expect(rowFor(page, person.name)).toBeVisible();
    await expect(rowFor(page, person.name)).toContainText("41 min ago");
    await expect(rowFor(page, person.name)).toContainText("0 ads");
    expect(await page.locator("[data-tk=server-table] tbody tr").first().innerText()).not.toContain(person.email);
    await shot(page, "a8-users-list");
  });

  test("finds a user by phone, by exact email, by name start and by nothing, and opens the drawer with the address kept", async ({ page, baseURL }) => {
    const stamp = String(Date.now()).slice(-8);
    const person = await seedUser(baseURL!, "a8find", `+9197${stamp}`, "Quentin Findable");
    await admin(page, baseURL!);
    await page.goto("/admin/users/");
    const search = page.getByRole("searchbox", { name: "Search users" });
    await search.fill(`97${stamp}`);
    await expect(page).toHaveURL(/q=97/);
    await expect(page.locator("[data-tk=server-table] tbody tr")).toHaveCount(1);
    await expect(rowFor(page, person.name)).toBeVisible();
    await rowFor(page, person.name).locator(".adm-k-rowlink").click();
    await expect(page).toHaveURL(/open=/);
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: person.name })).toBeVisible();
    await expect(drawer).toContainText(person.email);
    await expect(drawer).toContainText(`+9197${stamp}`);
    await expect(drawer.locator("[data-tk=user-balance]")).toHaveText("0");
    await drawer.getByRole("tab", { name: /Ads/ }).click();
    await expect(drawer).toContainText("No ads yet.");
    await drawer.getByRole("tab", { name: /Tickets/ }).click();
    await expect(drawer).toContainText("No support tickets.");
    await shot(page, "a8-users-drawer");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(page).not.toHaveURL(/open=/);
    await expect(page).toHaveURL(/q=97/);

    await search.fill(person.email);
    await expect(page.locator("[data-tk=server-table] tbody tr")).toHaveCount(1);
    await search.fill(person.name.slice(0, 8));
    await expect(rowFor(page, person.name)).toBeVisible();
    await search.fill("zzzznobody");
    const empty = page.locator("[data-tk=users-empty]");
    await expect(empty).toContainText('No users match "zzzznobody"');
    await shot(page, "a8-users-empty");
    await empty.getByRole("button", { name: "Clear search" }).click();
    await expect(page.locator("[data-tk=users-empty]")).toHaveCount(0);
    await expect(search).toHaveValue("");
  });

  test("the Banned tab lists a banned user and the Staff tab lists staff only", async ({ page, baseURL }) => {
    const person = await seedUser(baseURL!, "a8ban", `+9196${String(Date.now()).slice(-8)}`, "Bea Banned");
    await withLocalDb((db) => db.collection("users").updateOne({ _id: new ObjectId(person.id) }, { $set: { status: "suspended" } }));
    await admin(page, baseURL!);
    await page.goto("/admin/users/?tab=banned");
    await expect(page.getByRole("tab", { name: /^Banned/ })).toHaveAttribute("aria-selected", "true");
    await expect(rowFor(page, person.name)).toContainText("Banned");
    await page.getByRole("tab", { name: /^Staff/ }).click();
    await expect(page).toHaveURL(/tab=staff/);
    await expect(rowFor(page, person.name)).toHaveCount(0);
    const rows = page.locator("[data-tk=server-table] tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toMatch(/superadmin|admin|moderator|trust and safety|support|finance|seo editor|blog editor|content editor/);
  });

  test("support reads the screen and the drawer has no action buttons; finance is told it has no access", async ({ page, baseURL, browser }) => {
    const person = await seedUser(baseURL!, "a8role", `+9195${String(Date.now()).slice(-8)}`, "Rita Readonly");
    const { api, email } = await newUserApi(baseURL!, "a8sup");
    await api.dispose();
    expect(await setRoles(email, ["support"])).toBe(true);
    await loginUi(page, email, undefined, "/admin/users/");
    await page.goto(`/admin/users/?open=${person.id}`);
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    expect(await drawer.locator("button").allInnerTexts()).toEqual(expect.not.arrayContaining(["Ban user...", "Add or remove credits"]));
    await expect(drawer.getByRole("button", { name: /^Ban/ })).toHaveCount(0);

    const other = await browser.newContext({ baseURL });
    const page2 = await other.newPage();
    const fin = await newUserApi(baseURL!, "a8fin");
    await fin.api.dispose();
    expect(await setRoles(fin.email, ["finance"])).toBe(true);
    await loginUi(page2, fin.email, undefined, "/admin/users/");
    const refused = await page2.goto("/admin/users/");
    expect(refused?.status()).toBe(403);
    await expect(page2.getByText("Your staff role does not open this screen.")).toBeVisible();
    await expect(page2.locator("[data-tk=users-screen]")).toHaveCount(0);
    await other.close();
  });

  test("the screen has no sideways scroll, big enough targets, no tiny text and no serious axe problems; a phone shows cards and a full screen drawer", async ({ page, baseURL }) => {
    const person = await seedUser(baseURL!, "a8sizes", `+9194${String(Date.now()).slice(-8)}`, "Sam Sizes");
    await admin(page, baseURL!);
    await page.goto("/admin/users/");
    await expect(rowFor(page, person.name)).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const least = isPhone(page) ? 44 : 24;
    const small = await page.locator("[data-tk=users-screen] button:visible, [data-tk=users-screen] a:visible, [data-tk=users-screen] input:visible, [data-tk=users-screen] select:visible").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { text: (node.textContent || node.getAttribute("aria-label") || node.tagName).trim().slice(0, 28), height: box.height };
      }),
    );
    for (const item of small) expect(item.height, item.text).toBeGreaterThanOrEqual(least - 0.5);
    const tiny = await page.locator("[data-tk=users-screen] *").evaluateAll((nodes) =>
      nodes
        .filter((node) => Array.from(node.childNodes).some((child) => child.nodeType === 3 && (child.textContent || "").trim()) && node.getBoundingClientRect().width > 0)
        .map((node) => ({ text: (node.textContent || "").trim().slice(0, 24), font: parseFloat(getComputedStyle(node).fontSize) }))
        .filter((item) => item.font < 12),
    );
    expect(tiny).toEqual([]);
    if (isPhone(page)) {
      await expect(page.locator("[data-tk=server-table] thead")).toBeHidden();
      await expect(rowFor(page, person.name).locator("td", { hasText: "unknown" })).toBeHidden();
    }
    const found = await new AxeBuilder({ page }).include("[data-tk=users-screen]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await rowFor(page, person.name).locator(".adm-k-rowlink").click();
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    const view = page.viewportSize()!;
    if (view.width < 600) expect(Math.round(box.width)).toBe(view.width);
    else expect(Math.round(box.width)).toBe(460);
    expect(person.id).toBeTruthy();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "a8-users-open");
  });
});
