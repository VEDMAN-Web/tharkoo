import { createHmac, randomInt } from "node:crypto";
import { expect, test, uniqueEmail, withLocalDb } from "./helpers";

const E2E_SESSION_SECRET = "local-only-session-secret-not-real-0001";

async function deliverCode(email: string, code: string) {
  const hash = createHmac("sha256", E2E_SESSION_SECRET).update(`email-otp:${email}:${code}`).digest("hex");
  const stored = await withLocalDb(async (db) => {
    await db.collection("email_login_challenges").insertOne({
      email,
      codeHash: hash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    });
    return true;
  });
  expect(stored, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

test.describe("H7.61 header after a pop-up sign-in", () => {
  test("the header shows the account at once on the same page, with no navigation", async ({ page }) => {
    const email = uniqueEmail("popup");
    const code = String(randomInt(100000, 1000000));
    await page.route("**/api/auth/email/otp/send", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { sent: true } }) }),
    );
    await page.goto("/");
    await expect(page.locator('[data-tk="header-avatar"]')).toHaveCount(0);
    const sheet = page.locator(".tk-si");
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk:open-sign-in", { detail: { next: null } })));
      await expect(sheet).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await sheet.getByLabel("Email", { exact: true }).fill(email);
    await sheet.getByRole("button", { name: "Send me a code" }).click();
    await expect(sheet.getByRole("group", { name: "6-digit code" })).toBeVisible();
    await deliverCode(email, code);
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    for (const [index, digit] of [...code].entries()) {
      await sheet.getByLabel(`Digit ${index + 1} of 6`).fill(digit);
    }
    await expect(page.locator('[data-tk="header-avatar"]')).toBeVisible();
    await expect(page.locator(".tkn-login-link")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(navigations).toEqual([]);
  });
});
