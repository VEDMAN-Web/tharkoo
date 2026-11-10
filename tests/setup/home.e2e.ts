import { expect, test } from "@playwright/test";

test("home returns 200", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
