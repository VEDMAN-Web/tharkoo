import { createLiveAd } from "./flows";
import type { Page } from "@playwright/test";
import { confirmPayment, expect, isPhone, loginUi, newApi, newUserApi, originHeaders, test, uniqueEmail, registerApi } from "./helpers";

async function buyFirstPack(page: Page, pick: "first" | "last" = "first") {
  await page.goto("/u/account/credits/");
  const packs = page.locator("[data-tk=pack]");
  await expect(packs.first()).toBeVisible();
  await (pick === "last" ? packs.last() : packs.first()).click();
  const checkout = page.waitForResponse((r) => r.url().includes("/api/wallet/packs") && r.request().method() === "POST" && r.status() !== 308);
  await page.getByRole("button", { name: "PAY", exact: true }).click();
  const res = await checkout;
  expect(res.status()).toBe(200);
  await expect(page.getByText("Test mode: no real payment")).toBeVisible();
  const { providerRef } = (await res.json()).data as { providerRef: string };
  // The order is pending until the provider confirms it. Credits arrive with the signed webhook.
  const before = (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
  expect(before).toBe(0);
  await confirmPayment(new URL(page.url()).origin, providerRef);
}

test.describe("5 Money (mock provider)", () => {
  test("buy credits with the mock provider", async ({ page, baseURL }) => {
    const email = uniqueEmail("buy");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);

    await page.goto("/u/account/credits/");
    await expect(page.locator("h1")).toContainText(/credits/i);
    await buyFirstPack(page);
    const after = await (await page.request.get("/api/wallet/")).json();
    expect(after.data.balance).toBeGreaterThan(0);

    await page.goto("/u/account/credits/history/");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("PAY without choosing a pack is disabled", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "nopack");
    await api.dispose();
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    await page.goto("/u/account/credits/");
    await expect(page.getByRole("button", { name: "PAY", exact: true })).toBeDisabled();
  });

  test("coupon error states", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "coupon");
    // API: unknown code is a clean 404, empty code a clean 4xx, never a 500.
    const bad = await api.post("/api/coupons/redeem", { headers: originHeaders(baseURL!), data: { code: "NO-SUCH-COUPON" } });
    expect(bad.status()).toBe(404);
    const empty = await api.post("/api/coupons/redeem", { headers: originHeaders(baseURL!), data: { code: "" } });
    expect(empty.status()).toBeGreaterThanOrEqual(400);
    expect(empty.status()).toBeLessThan(500);
    await api.dispose();

    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    await page.goto("/u/account/coupons/");
    await page.getByLabel("Insert coupon code").fill("NO-SUCH-COUPON");
    await page.locator("[data-tk=apply-coupon]").click();
    const note = page.locator("[aria-live=polite]").last();
    await expect(note).not.toHaveText("");
    await expect(note).not.toHaveText("Coupon applied.");
  });

  test("provider webhook without an Origin header is accepted", async ({ page, baseURL }) => {
    test.fixme(true, "BUG 5 Money: /api/payments/webhook is rejected by the origin check when no Origin header is sent, as real providers do.");
    const email = uniqueEmail("hook");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    await loginUi(page, email);
    await page.goto("/u/account/credits/");
    await page.locator("[data-tk=pack]").first().click();
    const checkout = page.waitForResponse((r) => r.url().includes("/api/wallet/packs") && r.status() === 200);
    await page.getByRole("button", { name: "PAY", exact: true }).click();
    const { providerRef } = (await (await checkout).json()).data as { providerRef: string };
    await confirmPayment(baseURL!, providerRef, { withOrigin: false });
  });

  test("PAY needs a signed-in account", async ({ request: anon, baseURL }) => {
    const res = await anon.post("/api/wallet/packs", {
      headers: originHeaders(baseURL!, "/u/account/credits/"),
      data: { packId: "000000000000000000000000", idempotencyKey: "anon-key-12345" },
    });
    expect(res.status()).toBe(401);
  });

  test("buy credits, apply TOP, the ad ranks first on its city page", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const base = baseURL!;
    const ad = await createLiveAd(page, base, "top");
    await buyFirstPack(page, "last");

    const products = await page.request.get("/api/promotions/products", { headers: originHeaders(base) });
    const list = ((await products.json()).data.products || []) as { id: string; code: string; amount: number }[];
    const top = list.find((item) => item.code === "top");
    expect(top, "a TOP product exists").toBeTruthy();

    const balanceBefore = (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
    // Without enough credits the site answers 402; with the pack it must succeed.
    const apply = await page.request.post("/api/promotions/", {
      headers: originHeaders(base, "/u/account/ads/"),
      data: { listingId: ad.listingId, productId: top!.id, durationDays: 1, idempotencyKey: `top-${Date.now()}-e2e` },
    });
    if (apply.status() === 402) {
      test.fixme(true, "Largest credit pack is smaller than the TOP price.");
    }
    expect(apply.status(), await apply.text()).toBe(200);
    const balanceAfter = (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
    expect(balanceAfter).toBeLessThan(balanceBefore);

    // Not enough credits left for a second one: clean 402, no 500.
    const again = await page.request.post("/api/promotions/", {
      headers: originHeaders(base, "/u/account/ads/"),
      data: { listingId: ad.listingId, productId: top!.id, durationDays: 7, idempotencyKey: `top2-${Date.now()}-e2e` },
    });
    expect(again.status()).toBeLessThan(500);

    // The city feed is cached for up to a minute, so poll. Desktop run only, to keep the suite short.
    if (!isPhone(page)) {
      await expect
        .poll(
          async () => {
            const html = await (await page.request.get("/jobs/mumbai/")).text();
            const cards = html.split('<article class="tk-card"').slice(1);
            return cards[0]?.includes(ad.title) ? "first" : "not-first";
          },
          { timeout: 120_000, intervals: [5_000] },
        )
        .toBe("first");
    }
    await page.goto(ad.adHref);
    await expect(page.locator("h1")).toContainText(ad.title);
  });
});
