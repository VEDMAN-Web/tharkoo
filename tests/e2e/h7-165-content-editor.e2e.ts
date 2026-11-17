import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, expect, loginUi, newApi, registerApi, setRoles, test, uniqueEmail, withLocalDb } from "./helpers";

/** H7.165: the Content editor role, and the Team & roles list with Superadmin last. */

const SHOTS = process.env.H7165_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

async function signInAs(page: Page, baseURL: string, role: string) {
  const email = uniqueEmail(`h7165${role}`);
  const api = await newApi(baseURL);
  await registerApi(api, baseURL, email);
  await api.dispose();
  const promoted = await setRoles(email, [role]);
  test.skip(!promoted, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
  await loginUi(page, email, undefined, "/admin/");
}

test.describe("H7.165 Content editor", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a content editor saves a category picture and cannot open Orders & credits or Users", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const alt = `H7165 picture ${Date.now() % 100000}`;
    await withLocalDb((db) => db.collection("site_media").insertOne({ url: "/placeholders/dating/01.webp", objectKey: `h7165-${Date.now()}`, alt, width: 1200, height: 800, bytes: 90_000, contentType: "image/webp", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, baseURL!, "content_editor");
    expect(await page.locator(".adm-nav .adm-link-label").allTextContents()).toEqual(["Dashboard", "History & undo", "Page builder", "Content studio", "Media library", "Menus & site text", "Categories & fields", "Cities & areas"]);
    for (const path of ["/admin/finance/", "/admin/users/", "/admin/settings/", "/admin/team/", "/admin/prices/", "/admin/seo/"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(403);
    }

    await page.goto("/admin/categories/");
    await page.waitForLoadState("networkidle");
    const row = page.locator("[data-tk=pictures-row]").nth(1);
    const name = (await row.locator("strong").first().textContent()) ?? "";
    await row.getByRole("button", { name: "Edit pictures" }).click();
    const cardBox = row.locator('[data-slot="Card photo"]');
    await cardBox.getByRole("button", { name: "Choose image" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search images").fill(alt);
    await dialog.getByTitle(alt).click();
    await cardBox.getByLabel(/^Describe the picture/).fill("A flat with a balcony");
    await row.getByRole("button", { name: "Save pictures" }).click();
    await expect(row.getByText(`Saved the pictures of ${name}.`)).toBeVisible();
    const saved = await withLocalDb((db) => db.collection("categories").findOne({ name }, { projection: { photo: 1 } }));
    expect(saved?.photo?.alt).toBe("A flat with a balcony");
    await row.getByRole("button", { name: "Undo" }).click();
    await expect(row.getByText("Undone. The old pictures are back.")).toBeVisible();
  });

  test("Menus & site text opens the Site text screen only: no Menus and footer tab", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, baseURL!, "content_editor");
    await page.goto("/admin/menus/");
    await expect(page).toHaveURL(/\/admin\/ui-text\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Site text" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menus and footer" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Menus and site text" }).getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Menus and site text" }).getByRole("link", { name: "Site text" })).toBeVisible();
  });

  test("Team & roles lists Content editor, Superadmin is last with a one line warning, at 1440 and 390", async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin/team/");
    await expect(page.locator("[data-tk=team-guide]")).toContainText("Content editor");
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/team/");
      await page.getByRole("button", { name: "Invite staff" }).click();
      const drawer = page.locator("[data-tk=drawer]");
      const names = await drawer.locator(".adm-tm-choice strong").allTextContents();
      expect(names.at(-1)).toBe("Superadmin");
      expect(names).toContain("Content editor");
      await expect(drawer.locator("[data-tk=superadmin-warning]")).toContainText("as few people as you can");
      await drawer.getByLabel(/^Content editor/).scrollIntoViewIfNeeded();
      await shot(page, "team-role-list");
      await drawer.locator("[data-tk=superadmin-warning]").scrollIntoViewIfNeeded();
      await shot(page, "team-role-list-end");
    }
  });
});
