import { expect, becomeSeller, loginUi, newUserApi, test } from "./helpers";

const SLOW_MS = 3000;

function onPhone() {
  return test.info().project.name.startsWith("phone");
}

test.describe("H7.60 phone menu and header", () => {
  test("the phone menu shows My account and a POST Log out while signed in", async ({ page, baseURL }) => {
    test.skip(!onPhone(), "the menu button only shows on a phone");
    const { email } = await newUserApi(baseURL!, "drawer");
    await loginUi(page, email, undefined, "/");
    await page.locator('[data-tk="menu-button"]').click();
    const drawer = page.locator('[data-tk="drawer"]');
    await expect(drawer.getByRole("link", { name: "My account" })).toHaveAttribute("href", "/u/account/");
    await expect(drawer.getByRole("link", { name: "Log in" })).toHaveCount(0);
    await expect(drawer.locator('a[href*="/u/logout"]')).toHaveCount(0);
    const logout = page.waitForResponse((response) => response.url().endsWith("/api/auth/logout") && response.request().method() === "POST");
    await drawer.getByRole("button", { name: "Log out" }).click();
    await logout;
    await page.waitForLoadState("load");
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await page.locator('[data-tk="menu-button"]').click();
    await expect(page.locator('[data-tk="drawer"]').getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.locator('[data-tk="drawer"]').getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("the header never says Log in while the account loads", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "slowhead");
    await loginUi(page, email, undefined, "/");
    await page.route("**/api/auth/me", async (route) => {
      await new Promise((done) => setTimeout(done, SLOW_MS));
      await route.continue();
    });
    await page.goto("/");
    await expect(page.locator('[data-tk="header-avatar"]')).toBeVisible();
    await expect(page.locator(".tkn-login-link")).toHaveCount(0);
    await expect(page.locator('[data-tk="header-avatar"] .tkn-skel')).toBeVisible();
    await expect(page.locator('[data-tk="header-avatar"] .tkn-avatar-circle:not(.tkn-skel)')).toBeVisible({ timeout: SLOW_MS * 3 });
    await expect(page.locator(".tkn-login-link")).toHaveCount(0);
  });

  test("the seller panel shows skeletons, not 0% or - coins, until the data arrives, and each account call runs once", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "slowpanel");
    await loginUi(page, email, undefined, "/");
    await becomeSeller(page, baseURL!);
    await page.waitForLoadState("networkidle");
    const calls = { me: 0, wallet: 0 };
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/api/auth/me") calls.me += 1;
      if (path === "/api/wallet") calls.wallet += 1;
    });
    await page.route("**/api/wallet", async (route) => {
      await new Promise((done) => setTimeout(done, SLOW_MS));
      await route.continue();
    });
    await page.goto("/u/account/");
    const profile = page.getByRole("heading", { name: "Your profile" });
    await expect(profile).toBeVisible();
    await expect(page.getByText(/\d+% complete/)).toHaveCount(0);
    await expect(page.getByText("- coins")).toHaveCount(0);
    await expect(page.locator(".tkv-wallet-value .tkn-skel")).toBeVisible();
    await expect(page.locator(".tkv-wallet-value")).toContainText(/\d+ coins/, { timeout: SLOW_MS * 3 });
    await expect(page.getByText(/\d+% complete/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(calls).toEqual({ me: 1, wallet: 1 });
  });

  test("the phone panel menu marks the open page in pink and the site chat bubble stays off the panel", async ({ page, baseURL }) => {
    test.skip(!onPhone(), "phone layout only");
    const { email } = await newUserApi(baseURL!, "pill");
    await loginUi(page, email);
    const pill = page.locator(".up-nav-link-on");
    await expect(pill).toBeVisible();
    const style = await pill.evaluate((node) => {
      const css = getComputedStyle(node);
      return { image: css.backgroundImage, color: css.color };
    });
    expect(style.image).toContain("linear-gradient");
    expect(style.color).toBe("rgb(255, 255, 255)");
    await expect(page.locator(".tkn-chat-bubble")).toBeHidden();
    await page.goto("/");
    await expect(page.locator(".tkn-chat-bubble")).toBeVisible();
  });
});
