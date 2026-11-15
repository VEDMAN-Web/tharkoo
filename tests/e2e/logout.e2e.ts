import { expect, becomeSeller, loginUi, newUserApi, signInAdminContext, test } from "./helpers";
import type { Page } from "@playwright/test";

async function logOutFromHeader(page: Page) {
  await page.locator('[data-tk="header-avatar"]').click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await expect(page.locator('[data-tk="header-avatar"]')).toHaveCount(0);
  await expect(page.locator(".tkn-login-link")).toBeAttached();
}

test.describe("H7.24 logout", () => {
  test("a user logs out from the header menu and the panel is gone", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "logout");
    await loginUi(page, email);
    await page.goto("/u/account/dashboard/");
    await expect(page.getByText(/Hello /)).toBeVisible();
    await logOutFromHeader(page);
    await page.goBack();
    await expect(page.getByText(/Hello /)).toHaveCount(0);
    await page.goto("/u/account/");
    await expect(page).toHaveURL(/\/u\/login\//);
  });

  test("a seller logs out from the header menu and the seller panel is gone", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "logoutseller");
    await loginUi(page, email);
    await becomeSeller(page, baseURL!);
    await page.goto("/u/account/");
    await expect(page.getByRole("navigation", { name: "Panel" })).toBeVisible();
    await logOutFromHeader(page);
    await page.goBack();
    await expect(page.getByText(/Hello /)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Panel" })).toHaveCount(0);
    await page.goto("/u/account/");
    await expect(page).toHaveURL(/\/u\/login\//);
  });
  test("hovering and focusing Log out in the avatar menu does not sign out; clicking does", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "hover");
    await loginUi(page, email);
    await page.goto("/u/account/dashboard/");
    await page.locator('[data-tk="header-avatar"]').click();
    const item = page.getByRole("menuitem", { name: "Log out" });
    await item.hover();
    await item.focus();
    await page.waitForTimeout(10000);
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);
    await item.click();
    await page.waitForURL((url) => url.pathname === "/");
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });

  test("hovering and focusing Log out in the admin top bar does not sign out; clicking does", async ({ page, baseURL }) => {
    test.skip(test.info().project.name.startsWith("phone"), "the admin top bar hides Log out on phone");
    await signInAdminContext(page.context(), baseURL!);
    await page.goto("/admin/");
    const out = page.getByRole("button", { name: "Log out" });
    await out.hover();
    await out.focus();
    await page.waitForTimeout(10000);
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);
    await out.click();
    await page.waitForURL((url) => url.pathname === "/");
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });
});
