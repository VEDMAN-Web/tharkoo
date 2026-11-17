import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ADMIN_EMAIL, expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, setRoles, signInAdminContext, test, uniqueEmail, withLocalDb } from "./helpers";

/** H8.46 (A46): Team and roles. Staff list, invite, change roles with Undo, remove access, own account locked. */

const SHOTS = process.env.A46_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

const rowOf = (page: Page, email: string) => page.locator("[data-tk=team-row]", { hasText: email });

async function rolesInDb(email: string): Promise<string[]> {
  const found = await withLocalDb((db) => db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { roles: 1 } }));
  return ((found?.roles as string[] | undefined) ?? []).slice().sort();
}

test.describe("H8.46 team and roles", () => {
  test("a superadmin sees the team and the role guide, changes a role and undoes it, invites someone and removes access", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const member = await newUserApi(baseURL!, "a46mod");
    await member.api.dispose();
    expect(await setRoles(member.email, ["user", "moderator"])).toBe(true);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);

    await page.goto("/admin/team/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Team & roles" })).toBeVisible();
    await expect(page.locator("[data-tk=team-guide]")).toContainText("Blog editor (new)");
    await expect(page.locator("[data-tk=team-guide]")).toContainText("Cannot publish");
    await expect(page.getByRole("button", { name: "Invite staff" })).toBeVisible();
    if (isPhone(page)) {
      await page.locator("#adm-content").getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("menuitem", { name: "Full audit log" })).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByRole("link", { name: "Full audit log" })).toBeVisible();
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a46-team-list");

    // Your own row is locked.
    const self = rowOf(page, ADMIN_EMAIL);
    await expect(self).toContainText("(you)");
    await self.click();
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer.locator("[data-tk=team-self]")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Save roles" })).toBeDisabled();
    await drawer.getByRole("button", { name: "Cancel" }).click();
    await expect(drawer).toHaveCount(0);

    // Change a role, then Undo.
    const row = rowOf(page, member.email);
    await expect(row).toContainText("Moderator");
    await row.click();
    await drawer.getByLabel(/^Moderator/).uncheck();
    await drawer.getByLabel(/^Support/).check();
    await shot(page, "a46-team-change", false);
    await drawer.getByRole("button", { name: "Save roles" }).click();
    const toast = page.locator("[data-tk=toast]");
    await expect(toast).toContainText("Roles of");
    await expect(rowOf(page, member.email)).toContainText("Support");
    expect(await rolesInDb(member.email)).toEqual(["support", "user"]);
    await toast.locator("[data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("The role change undone");
    await expect(rowOf(page, member.email)).toContainText("Moderator");
    expect(await rolesInDb(member.email)).toEqual(["moderator", "user"]);

    // Invite a blog editor.
    const invited = uniqueEmail("a46invite");
    await page.getByRole("button", { name: "Invite staff" }).click();
    await drawer.getByLabel(/^Name/).fill("Kavya Invited");
    await drawer.getByLabel(/^Email/).fill(invited);
    await drawer.getByLabel(/^Blog editor/).check();
    await shot(page, "a46-team-invite", false);
    await drawer.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText(`Invite sent to ${invited}`);
    const invitedRow = rowOf(page, invited);
    await expect(invitedRow).toContainText("Blog editor");
    await expect(invitedRow).toContainText("Invited");
    expect(await rolesInDb(invited)).toEqual(["blog_editor"]);
    await shot(page, "a46-team-after-invite");

    // An email with an account already is refused with a plain message.
    await page.getByRole("button", { name: "Invite staff" }).click();
    await drawer.getByLabel(/^Name/).fill("Again");
    await drawer.getByLabel(/^Email/).fill(invited);
    await drawer.getByLabel(/^Support/).check();
    await drawer.getByRole("button", { name: "Send invite" }).click();
    await expect(drawer.locator("[data-tk=team-error]")).toContainText("already has an account");
    await drawer.getByRole("button", { name: "Cancel" }).click();

    // Remove access.
    await rowOf(page, invited).click();
    await drawer.getByRole("button", { name: "Remove access..." }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await dialog.getByLabel("Left the team").check();
    await dialog.getByRole("button", { name: "Remove access" }).last().click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("no longer has staff access");
    await expect(rowOf(page, invited)).toHaveCount(0);
    expect(await rolesInDb(invited)).toEqual(["user"]);
    await staff.close();
  });

  test("a moderator cannot open Team and roles", async ({ page, baseURL }) => {
    const member = await newUserApi(baseURL!, "a46noaccess");
    await member.api.dispose();
    expect(await setRoles(member.email, ["moderator"])).toBe(true);
    await loginUi(page, member.email, undefined, "/admin/");
    const response = await page.goto("/admin/team/");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
    await expect(page.locator("[data-tk=team]")).toHaveCount(0);
  });
});
