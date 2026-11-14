import { createHmac, randomInt } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test, uniqueEmail, withLocalDb } from "./helpers";

// Must match SESSION_SECRET in tests/e2e/server.mjs. The mock mail provider below delivers the code by seeding the
// same hash the server stores, so the test can type the code the way an inbox would show it.
const E2E_SESSION_SECRET = "local-only-session-secret-not-real-0001";
const WRONG_LIMIT = 5;

function codeHash(email: string, code: string) {
  return createHmac("sha256", E2E_SESSION_SECRET).update(`email-otp:${email}:${code}`).digest("hex");
}

function freshCode() {
  return String(randomInt(100000, 1000000));
}

/** Stores a live login code for the address, as the mail provider would have sent it. */
async function deliverCode(email: string, code: string) {
  const stored = await withLocalDb(async (db) => {
    await db.collection("email_login_challenges").insertOne({
      email,
      codeHash: codeHash(email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    });
    return true;
  });
  expect(stored, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

/** The mock provider: the send step answers "sent" without any mail leaving the test server. */
async function mockSendOk(page: Page) {
  await page.route("**/api/auth/email/otp/send", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { sent: true } }) }),
  );
}

/** The sheet itself, so buttons with the same name elsewhere on the page are not matched. */
function sheet(page: Page) {
  return page.locator(".tk-si");
}

async function openSheet(page: Page, role: "user" | "seller" = "user") {
  await page.goto(`/u/login/${role === "seller" ? "?role=seller" : ""}`);
  await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
}

/** Role step, then the address step, then the code step once the mock provider has sent a code. */
async function sendCodeTo(page: Page, email: string) {
  await sheet(page).getByRole("button", { name: "Continue" }).click();
  await sheet(page).getByLabel("Email address").fill(email);
  await sheet(page).getByRole("button", { name: "Send code" }).click();
  await expect(sheet(page).getByLabel("6-digit code")).toBeVisible();
}

async function seriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations
    .filter((item) => item.impact === "serious" || item.impact === "critical")
    .map((item) => `${item.id} (${item.impact}) x${item.nodes.length}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("sign-in sheet (H7.2b): runs at 390 and 1440", () => {
  test("shows the sheet on the login page with no password field", async ({ page }) => {
    await openSheet(page);
    await expect(page.getByRole("radiogroup", { name: "I am here to" })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await seriousAxeViolations(page)).toEqual([]);
  });

  test("says when no code can be sent, and never shows the code step", async ({ page }) => {
    await page.route("**/api/auth/email/otp/send", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: "INTERNAL", message: "Login codes cannot be sent" } }),
      }),
    );
    await openSheet(page);
    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await sheet(page).getByLabel("Email address").fill(uniqueEmail("no-mail"));
    await sheet(page).getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Login codes cannot be sent")).toBeVisible();
    await expect(sheet(page).getByLabel("6-digit code")).toHaveCount(0);
  });

  test("a new seller signs up with a code, does the profile once, then reaches the ad form", async ({ page }) => {
    const email = uniqueEmail("seller-signup");
    const code = freshCode();
    await mockSendOk(page);
    await openSheet(page, "seller");
    await sendCodeTo(page, email);
    await deliverCode(email, code);
    await sheet(page).getByLabel("6-digit code").fill(code);
    await sheet(page).getByRole("button", { name: "Log in" }).click();

    await page.waitForURL(/\/u\/seller-profile\//);
    await expect(page.getByRole("heading", { name: "Your seller profile" })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.getByLabel("Name shown on your ads").fill("Asha Traders");
    await page.getByLabel("City").fill("Surat");
    await page.getByLabel("Date of birth").fill("1990-05-01");
    await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
    await page.getByRole("button", { name: "Continue to post your ad" }).click();

    await page.waitForURL(/\/u\/post-insert/);
    expect(await seriousAxeViolations(page)).toEqual([]);
  });

  test("a new user signs up with a code and lands in the user panel", async ({ page }) => {
    const email = uniqueEmail("user-signup");
    const code = freshCode();
    await mockSendOk(page);
    await openSheet(page);
    await sendCodeTo(page, email);
    await deliverCode(email, code);
    await sheet(page).getByLabel("6-digit code").fill(code);
    await sheet(page).getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/u\/account\/saved\//);
  });

  test("five wrong codes lock the right one", async ({ page }) => {
    const email = uniqueEmail("lockout");
    const code = freshCode();
    const wrong = code === "000000" ? "111111" : "000000";
    await mockSendOk(page);
    await openSheet(page);
    await sendCodeTo(page, email);
    await deliverCode(email, code);

    for (let attempt = 0; attempt < WRONG_LIMIT; attempt += 1) {
      await sheet(page).getByLabel("6-digit code").fill(wrong);
      await sheet(page).getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText("That code is not valid. Check it, or ask for a new one.")).toBeVisible();
    }
    await sheet(page).getByLabel("6-digit code").fill(code);
    await sheet(page).getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("That code is not valid. Check it, or ask for a new one.")).toBeVisible();
    await expect(page).toHaveURL(/\/u\/login\//);
  });
});
