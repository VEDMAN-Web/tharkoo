import { createHash, randomBytes } from "node:crypto";
import { expect, hasHorizontalScroll, loginApi, newApi, newUserApi, originHeaders, registerApi, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";
import { finalChecks, test } from "./e1-b-helpers";

/**
 * E1-B: Account journeys that no other spec walks end to end (verify link, forgot and reset password,
 * edit the name, ask for account deletion). Every mail is mocked: the test plants the token the mail would carry.
 */

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const NEW_PASSWORD = "BrandNew9!pass";

async function userId(email: string) {
  const id = await withLocalDb(async (db) => String((await db.collection("users").findOne({ email: email.toLowerCase() }))?._id ?? ""));
  expect(id, "the account exists in the test database").toBeTruthy();
  return id as string;
}

test.describe("E1-B account journeys", () => {
  test.afterEach(async ({ page }, info) => {
    if (info.status === "passed") await finalChecks(page);
  });

  test("verify email: the link confirms the address, and only then does the password log in", async ({ page, baseURL }) => {
    const email = uniqueEmail("e1verify");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    // The test server confirms new accounts at once. Put the account back to "not confirmed" and plant the mail's token.
    const { ObjectId } = await import("mongodb");
    const token = randomBytes(24).toString("hex");
    await withLocalDb(async (db) => {
      await db.collection("users").updateOne({ email }, { $unset: { emailVerifiedAt: "" } });
      await db.collection("email_verification_tokens").insertOne({
        userId: new ObjectId(await userId(email)),
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      });
    });
    const before = await api.post("/api/auth/login", { headers: originHeaders(baseURL!, "/u/login/"), data: { email, password: USER_PASSWORD } });
    expect(before.status(), "an unconfirmed account cannot log in").toBe(403);

    await page.goto(`/u/verify-email?token=${token}`);
    await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page.getByText("Email confirmed. You can log in.")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);

    await loginApi(api, baseURL!, email);
    // The same link cannot be used twice.
    await page.goto(`/u/verify-email?token=${token}`);
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page.getByText(/invalid or expired/i)).toBeVisible();
    await api.dispose();
  });

  test("forgot and reset password: ask for a link, choose a new password, the old one stops working", async ({ page, baseURL }) => {
    const email = uniqueEmail("e1reset");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await loginApi(api, baseURL!, email);

    await page.goto("/u/forgot/");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page.getByText("If that email is registered, a reset link is on its way.")).toBeVisible();

    const { ObjectId } = await import("mongodb");
    const token = randomBytes(24).toString("hex");
    await withLocalDb(async (db) =>
      db.collection("password_reset_tokens").insertOne({
        userId: new ObjectId(await userId(email)),
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      }),
    );
    await page.goto(`/u/reset?token=${token}`);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await page.locator("input[name=password]").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
    await page.waitForURL(/\/u\/login\//);

    const fresh = await newApi(baseURL!);
    const old = await fresh.post("/api/auth/login", { headers: originHeaders(baseURL!, "/u/login/"), data: { email, password: USER_PASSWORD } });
    expect(old.status(), "the old password is refused").toBe(401);
    await loginApi(fresh, baseURL!, email, NEW_PASSWORD);
    const still = await api.get("/api/auth/me");
    expect(still.status(), "the session from before the reset was ended").toBe(401);
    await fresh.dispose();
    await api.dispose();
  });

  test("edit account: the name changes from Settings and shows on the panel", async ({ page, baseURL }) => {
    const { email } = await newUserApi(baseURL!, "e1name");
    await loginApiFor(page, baseURL!, email);
    await page.goto("/u/account/edit-account/");
    const row = page.locator('[data-tk="setting-name"]');
    await expect(row).toContainText("E2E");
    await row.getByRole("link", { name: "Change" }).click();
    await page.waitForURL(/\/u\/seller-profile\//);
    const name = `Renamed ${Date.now() % 100000}`;
    await page.locator("input[name=name]").fill(name);
    // Saving the name needs a city too. (Bug E1-B3: without one, the page shows a raw validation message.)
    await page.locator("select[name=city]").selectOption({ label: "Mumbai" });
    await page.getByRole("button", { name: "Save and continue" }).click();
    await page.waitForURL(/\/u\/account\/edit-account\//);
    await expect(page.locator('[data-tk="setting-name"]')).toContainText(name);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("delete account: the request is a support ticket, nothing is deleted, and the ticket is listed", async ({ page, baseURL }) => {
    const { email, api } = await newUserApi(baseURL!, "e1delete");
    await loginApiFor(page, baseURL!, email);
    await page.goto("/u/account/edit-account/");
    await page.getByRole("link", { name: "Delete account" }).click();
    await page.waitForURL(/\/u\/account\/delete\//);
    const request = page.locator('[data-tk="delete-request"]');
    await expect(request).toBeDisabled();
    await page.locator('[data-tk="delete-understood"]').check();
    await request.click();
    await expect(page.getByRole("heading", { name: "Send the request?" })).toBeVisible();
    await page.locator('[data-tk="delete-confirm"]').click();
    await expect(page.locator('[data-tk="delete-sent"]')).toContainText("Nothing has been deleted yet");
    await page.getByRole("link", { name: "See my ticket" }).click();
    await page.waitForURL(/\/u\/account\/support\//);
    await expect(page.getByText("Delete my account").first()).toBeVisible();
    // The account is still there.
    expect((await api.get("/api/auth/me")).status()).toBe(200);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

async function loginApiFor(page: import("@playwright/test").Page, baseURL: string, email: string) {
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password: USER_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
}
