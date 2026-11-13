import { expect, loginUi, test, uniqueEmail, USER_PASSWORD, originHeaders } from "./helpers";

test.describe("3 Account", () => {
  test("register, dashboard, settings, logout, login", async ({ page, baseURL }) => {
    const email = uniqueEmail("acct");

    // Register through the real page (STAGING_AUTO_VERIFY_EMAIL=true on the test server).
    await page.goto("/u/register/");
    await expect(page.locator("h1")).toHaveCount(1);
    await page.locator("#email").fill(email);
    await page.locator("#displayName").fill("Account E2E");
    await page.locator("#password").fill(USER_PASSWORD);
    await page.locator("#dateOfBirth").fill("1990-01-01");
    await page.locator("input[name=acceptedTerms]").check();
    await page.locator("input[name=attestedAdult]").check();
    await page.getByRole("button", { name: "CREATE ACCOUNT" }).click();
    await page.waitForURL(/\/u\/account\/dashboard\/|\/u\/login\/|\/u\/verify-email\/|\/u\/post-insert\//);

    // Log in (works whether or not register signed us in).
    await page.context().clearCookies();
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);

    // Dashboard cards.
    for (const tile of ["ads", "wallet", "coupons", "settings"]) {
      await expect(page.locator(`[data-tk=tile][data-tile=${tile}]`)).toBeVisible();
    }
    await expect(page.locator("h1")).toHaveCount(1);

    // Settings (the profile screen): shows the email, password change sends a reset email.
    await page.goto("/u/account/edit-account/");
    await expect(page.getByText(email, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "CHANGE PASSWORD" }).click();
    await expect(page.getByRole("button", { name: /We have sent you an email/ })).toBeVisible();

    // Other account screens load for a signed-in user.
    for (const path of ["/u/account/ads/", "/u/account/credits/", "/u/account/coupons/", "/u/account/saved/", "/u/account/kyc/"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }

    // Logout ends the session.
    await page.goto("/u/logout/");
    await page.waitForURL(/\/$/);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
    await page.goto("/u/account/dashboard/");
    await expect(page.getByText(/sign in|log in/i).first()).toBeVisible();

    // And the same credentials work again.
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    expect(baseURL).toBeTruthy();
  });

  test("wrong password shows an error, not a session", async ({ page }) => {
    await loginUi(page, "nobody-" + uniqueEmail("x"), "WrongPass1!");
    await expect(page).toHaveURL(/\/u\/login\//);
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
