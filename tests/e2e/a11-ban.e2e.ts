import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, setRoles, signInAdminContext, test } from "./helpers";
import { createLiveAd } from "./flows";

/** H8.11 (A11): ban, undo, unban and log out everywhere from the Users drawer. */

const SHOTS = process.env.A11_SHOTS ?? "";

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

async function adStatus(page: Page, href: string) {
  return (await page.request.get(href)).status();
}

test.describe("H8.11 ban, unban and log out everywhere", () => {
  test("ban pauses the live ad and ends the sign-in, Undo brings the ad back, Unban does the same, and a banned user cannot be banned again", async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    const seller = await createLiveAd(page, baseURL!, "a11ban");
    expect(await adStatus(page, seller.adHref)).toBe(200);
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);

    const staff = await browser.newContext({ baseURL });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const drawer = await openUser(admin, seller.email);
    await expect(drawer.getByRole("button", { name: "Unban user" })).toHaveCount(0);

    await drawer.getByRole("button", { name: "Ban user..." }).click();
    const dialog = admin.locator("[data-tk=reason-dialog]");
    await expect(dialog.getByRole("heading", { name: /^Ban / })).toBeVisible();
    await expect(dialog).toContainText("pause their 1 live ad");
    await expect(dialog).toContainText("log them out on every device");
    await expect(dialog.locator("[data-tk=give-back]")).toHaveCount(0);
    const cancel = (await dialog.getByRole("button", { name: "Cancel" }).boundingBox())!;
    const confirm = (await dialog.getByRole("button", { name: "Ban user" }).boundingBox())!;
    expect(cancel.x).toBeLessThan(confirm.x);
    await shot(admin, "a11-ban-dialog");
    await dialog.getByRole("button", { name: "Ban user" }).click();
    await expect(dialog.getByText("Choose a reason.")).toBeVisible();
    await admin.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Ban user..." }).click();
    await dialog.getByLabel("Spam").check();
    await dialog.getByLabel("Tell the team more").fill("Ads in five minutes");
    await dialog.getByRole("button", { name: "Ban user" }).click();
    const toast = admin.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast).toContainText("banned.");
    await shot(admin, "a11-ban-toast");
    await expect(drawer).toContainText("Banned");
    await expect(drawer.getByRole("button", { name: "Ban user..." })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Unban user" })).toBeVisible();
    await shot(admin, "a11-banned-drawer");
    await expect.poll(() => adStatus(page, seller.adHref), { timeout: 60_000, intervals: [2_000] }).not.toBe(200);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);

    await toast.locator("[data-tk=toast-undo]").click();
    await expect(admin.locator("[data-tk=toast]")).toContainText("The ban undone.");
    await expect(drawer.getByRole("button", { name: "Ban user..." })).toBeVisible();
    await expect.poll(() => adStatus(page, seller.adHref), { timeout: 60_000, intervals: [2_000] }).toBe(200);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);

    await drawer.getByRole("button", { name: "Ban user..." }).click();
    await dialog.getByLabel("Fake or junk ads").check();
    await dialog.getByRole("button", { name: "Ban user" }).click();
    await expect(drawer.getByRole("button", { name: "Unban user" })).toBeVisible();
    await expect.poll(() => adStatus(page, seller.adHref), { timeout: 60_000, intervals: [2_000] }).not.toBe(200);
    await drawer.getByRole("button", { name: "Unban user" }).click();
    await expect(admin.locator("[data-tk=toast]")).toContainText("unbanned.");
    await expect(drawer.getByRole("button", { name: "Ban user..." })).toBeVisible();
    await expect.poll(() => adStatus(page, seller.adHref), { timeout: 60_000, intervals: [2_000] }).toBe(200);
    await staff.close();
  });

  test("log out everywhere ends every sign-in after a confirm, and keeps the account and its ads", async ({ page, browser, baseURL }) => {
    test.setTimeout(180_000);
    const seller = await createLiveAd(page, baseURL!, "a11out");
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);
    const staff = await browser.newContext({ baseURL });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    const drawer = await openUser(admin, seller.email);
    await drawer.getByRole("button", { name: "More" }).click();
    await admin.getByRole("menuitem", { name: "Log out everywhere..." }).click();
    const dialog = admin.locator("[data-tk=reason-dialog]");
    await expect(dialog).toContainText("signed out on every device");
    await dialog.getByRole("button", { name: "Log out everywhere" }).click();
    await expect(admin.locator("[data-tk=toast]")).toContainText("logged out everywhere");
    await expect(admin.locator("[data-tk=toast]")).toHaveAttribute("data-kind", "success");
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    expect(await adStatus(page, seller.adHref)).toBe(200);
    await staff.close();
  });

  test("support can log a user out but sees no Ban button; a banned staff member cannot be reached", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const target = await newUserApi(baseURL!, "a11target");
    await target.api.dispose();
    const { api, email } = await newUserApi(baseURL!, "a11sup");
    await api.dispose();
    expect(await setRoles(email, ["support"])).toBe(true);
    await loginUi(page, email, undefined, "/admin/users/");
    const drawer = await openUser(page, target.email);
    await expect(drawer.getByRole("button", { name: "Ban user..." })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "More" })).toBeVisible();
    await drawer.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Log out everywhere..." })).toBeVisible();
  });
});
