import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, setRoles, signInAdminContext, test } from "./helpers";

/** H8.14 (A14): add or remove credits from the Users drawer, the Credits tab, and Undo. */

const SHOTS = process.env.A14_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function openUser(page: Page, email: string) {
  await page.goto(`/admin/users/?q=${encodeURIComponent(email)}`);
  const row = page.locator("[data-tk=server-table] tbody tr").first();
  await expect(row).toContainText(email.split("@")[0].slice(0, 7));
  await row.locator(".adm-k-rowlink").click();
  const drawer = page.locator("[data-tk=drawer]");
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe("H8.14 staff credits", () => {
  test("add 50 with a reason, see it in the Credits tab, undo it from the toast, and a removal cannot go below 0", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "a14add");
    await api.dispose();
    const staff = await browser.newContext({ baseURL });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const drawer = await openUser(admin, email);

    await drawer.getByRole("tab", { name: "Credits" }).click();
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("0");
    await expect(drawer.locator("[data-tk=credits-empty]")).toBeVisible();
    await expect(drawer.getByText("Staff changes need a reason and can be undone for 7 days while unspent.")).toBeVisible();

    await drawer.getByRole("button", { name: "Add or remove credits" }).click();
    const dialog = admin.locator("[data-tk=reason-dialog]");
    await expect(dialog.getByRole("heading", { name: /^Add or remove credits for / })).toBeVisible();
    await expect(dialog.locator("[data-tk=credits-balance]")).toHaveText("0 credits");
    const cancel = (await dialog.getByRole("button", { name: "Cancel" }).boundingBox())!;
    const confirm = (await dialog.getByRole("button", { name: "Add credits" }).last().boundingBox())!;
    expect(cancel.x).toBeLessThan(confirm.x);

    await dialog.getByRole("button", { name: "Add credits" }).last().click();
    await expect(dialog.getByText("Choose a reason.")).toBeVisible();
    await dialog.getByLabel("Number of credits").fill("abc");
    await expect(dialog.getByText("Enter a whole number of credits, for example 50.")).toBeVisible();
    await dialog.getByLabel("Number of credits").fill("50");
    await expect(dialog.getByText("New balance: 50 credits.")).toBeVisible();
    await dialog.getByLabel("Goodwill").check();
    await dialog.getByLabel("Tell the team more").fill("Slow reply last week");
    await shot(admin, "a14-credits-dialog");
    await dialog.getByRole("button", { name: "Add credits" }).last().click();

    const toast = admin.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast).toContainText("Added 50 credits to");
    await expect(toast).toContainText("New balance 50.");
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("50");
    const line = drawer.locator("[data-tk=credits-line]").first();
    await expect(line).toContainText("+50");
    await expect(line).toContainText("Goodwill: Slow reply last week");
    await expect(line).toContainText("unspent");
    await expect(line.getByRole("button", { name: /^Undo/ })).toBeVisible();
    await shot(admin, "a14-credits-added");

    await toast.locator("[data-tk=toast-undo]").click();
    await expect(admin.locator("[data-tk=toast]")).toContainText("Credit change undone.");
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("0");
    await expect(drawer.locator("[data-tk=credits-line]").filter({ hasText: "+50" })).toContainText("Undone");
    await expect(drawer.locator("[data-tk=credits-line]").filter({ hasText: "-50" })).toContainText("Staff change undone");
    await shot(admin, "a14-credits-undone");

    await drawer.getByRole("button", { name: "Add or remove credits" }).click();
    await dialog.getByLabel("Remove credits").check();
    await dialog.getByLabel("Number of credits").fill("5");
    await expect(dialog.getByText("They have only 0 credits. You cannot remove more than that.")).toBeVisible();
    await dialog.getByLabel("Fixing a mistake").check();
    await dialog.getByRole("button", { name: "Remove credits" }).last().click();
    await expect(dialog).toBeVisible();
    await admin.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("0");
    await staff.close();
  });

  test("support can add credits and undo their own change; a moderator sees no Credits tab and no button", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const target = await newUserApi(baseURL!, "a14target");
    await target.api.dispose();
    const { api, email } = await newUserApi(baseURL!, "a14sup");
    await api.dispose();
    expect(await setRoles(email, ["support"])).toBe(true);
    await loginUi(page, email, undefined, "/admin/users/");
    const drawer = await openUser(page, target.email);
    await drawer.getByRole("tab", { name: "Credits" }).click();
    await drawer.getByRole("button", { name: "Add or remove credits" }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await dialog.getByLabel("Number of credits").fill("3");
    await dialog.getByLabel("Goodwill").check();
    await dialog.getByRole("button", { name: "Add credits" }).last().click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Added 3 credits to");
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("3");
    await drawer.locator("[data-tk=credits-line]").first().getByRole("button", { name: /^Undo/ }).click();
    await expect(drawer.locator("[data-tk=credits-tab-balance]")).toHaveText("0");

    expect(await setRoles(email, ["moderator"])).toBe(true);
    const again = await openUser(page, target.email);
    await expect(again.getByRole("tab", { name: "Credits" })).toHaveCount(0);
    await expect(again.getByRole("button", { name: "Add or remove credits" })).toHaveCount(0);
  });
});
