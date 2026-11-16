import { expect, loginUi, registerApi, test, uniqueEmail, originHeaders } from "./helpers";

test.describe("3 Account", () => {
  test("sign up, dashboard, settings, logout, login", async ({ page, baseURL }) => {
    const email = uniqueEmail("acct");

    await registerApi(page.request, baseURL!, email);
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);

    // Dashboard menu: the user panel links to coins and settings.
    const menu = page.getByRole("navigation", { name: "My account" });
    await expect(menu.getByRole("link", { name: "Coins and payments" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);

    await page.goto("/u/account/edit-account/");
    await expect(page.getByRole("region", { name: "Settings" }).getByText(email, { exact: false })).toBeVisible();
    await expect(page.getByText("Text message codes are coming soon")).toBeVisible();

    // Other account screens load for a signed-in user.
    for (const path of ["/u/account/ads/", "/u/account/credits/", "/u/account/coupons/", "/u/account/saved/", "/u/account/kyc/"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }

    // Logout ends the session.
    await page.goto("/u/logout/");
    await page.waitForURL((url) => url.pathname === "/");
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
    await page.goto("/u/account/dashboard/");
    await expect(page.getByRole("heading", { name: /log in/i }).first()).toBeVisible();

    // And the same credentials work again.
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    expect(baseURL).toBeTruthy();
  });

  test("wrong password is refused and makes no session", async ({ page, baseURL }) => {
    // The login page is a code sheet now (H7.2), so the wrong password is tried against the password API directly.
    const res = await page.request.post("/api/auth/login", {
      headers: originHeaders(baseURL!, "/u/login/"),
      data: { email: "nobody-" + uniqueEmail("x"), password: "WrongPass1!" },
    });
    expect(res.ok()).toBe(false);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });

  test("21 wrong passwords are rate limited with 429 (LOGIN_MAX is 20)", async ({ request, baseURL }) => {
    const email = uniqueEmail("lock");
    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      const res = await request.post("/api/auth/login", { headers: originHeaders(baseURL!, "/u/login/"), data: { email, password: "WrongPass1!" } });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  test("signed-out visitor is sent to log in", async ({ page }) => {
    await page.goto("/u/post-insert/");
    await page.waitForURL(/\/u\/login\//);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/u/post-insert/");
  });
});
