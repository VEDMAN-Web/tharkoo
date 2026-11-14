import { createHmac } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { createLiveAd } from "./flows";
import {
  expect,
  firstAdPath,
  hasHorizontalScroll,
  loginUi,
  newApi,
  newUserApi,
  originHeaders,
  registerApi,
  setListingExpiry,
  test,
  uniqueEmail,
  WEBHOOK_SECRET,
} from "./helpers";

/** Coin balance of the signed-in client (GET /api/wallet/). */
async function coinBalance(api: APIRequestContext) {
  const res = await api.get("/api/wallet/");
  expect(res.status()).toBe(200);
  return (await res.json()).data.balance as number;
}

/** Sends a payment-provider event to the coin webhook. Signed like the provider does, unless `sign` is false. */
async function sendCoinEvent(baseURL: string, event: Record<string, unknown>, { sign = true } = {}) {
  // A fresh client with no cookies: the provider sends none, and it may send no Origin header.
  const api = await newApi(baseURL);
  const raw = JSON.stringify(event);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sign) {
    const timestamp = Math.floor(Date.now() / 1000);
    headers["x-payment-timestamp"] = String(timestamp);
    headers["x-payment-signature"] = createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest("hex");
  }
  const res = await api.post("/api/payments/coins/webhook", { headers, data: raw });
  // Read the body before the context is disposed, or the response is gone.
  const result = { status: res.status(), text: await res.text() };
  await api.dispose();
  return result;
}

/** Fills step 1 of the post-ad form (the same fields the advertiser suite uses). */
async function fillAdInformation(page: Page, title: string) {
  await page.locator("#category").selectOption({ label: "Jobs" });
  await page.locator("#city").selectOption({ label: "Mumbai" });
  await page.locator("#nickname").fill("Asha");
  await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
  await page.locator("#phone").fill("9876543210");
  await page.locator("#consent-terms").check();
  await page.locator("#consent-adult").check();
}

test.describe("H6.2 categories and sub-category chips", () => {
  test("categories page has one h1 and links to the category pages", async ({ page }) => {
    await page.goto("/categories/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('a[href="/dating/"]').first()).toBeAttached();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("category page chips open a sub-category x city page", async ({ page }) => {
    await page.goto("/dating/");
    const section = page.locator("[data-tk=subcategory-chips]");
    const chips = await section.locator("a.tk-pill").count();
    test.skip(chips === 0, "The seed has no sub-category with live ads in this category, so there are no chips to open.");
    await expect(section.locator("h2")).toHaveCount(1);
    const chip = section.locator("a.tk-pill").first();
    const href = (await chip.getAttribute("href")) as string;
    expect(href).toMatch(/^\/dating\/[^/]+\/[^/]+\/?$/);
    await chip.click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === href.replace(/\/$/, ""));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("H6.3 video rule on the post form", () => {
  test("the photos step states the video limits", async ({ page, baseURL }) => {
    const email = uniqueEmail("videorule");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    await loginUi(page, email, undefined, "/u/post-insert/");
    await page.waitForURL(/\/u\/post-insert\//);
    await fillAdInformation(page, `E2E video rule ${Date.now()}`);
    await page.locator("[data-tk=go-on]").click();
    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    await expect(page.getByText("Videos: up to 2, max 10 MB and 30 seconds each.", { exact: true })).toBeVisible();
  });
});

test.describe("H6.4 Chat now sign-in gate", () => {
  test("a signed-out visitor is asked to sign in", async ({ page }) => {
    await page.goto(await firstAdPath(page));
    const chat = page.locator("[data-tk=chat]");
    await chat.waitFor();
    await chat.click();
    const note = page.getByRole("status").filter({ hasText: "Sign in to chat with the advertiser." });
    await expect(note).toBeVisible();
    await expect(note.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /^\/u\/login\/\?next=/);
    await expect(page.locator("[data-tk=chat-panel]")).toHaveCount(0);
  });

  test("a signed-in visitor gets the chat panel", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "chatter");
    await api.dispose();
    await loginUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    await page.goto(await firstAdPath(page));
    await page.locator("[data-tk=chat]").click();
    await expect(page.locator("[data-tk=chat-panel]")).toBeVisible();
  });

  test("starting a chat needs a session (API)", async ({ baseURL }) => {
    const anon = await newApi(baseURL!);
    const res = await anon.post("/api/chat/conversations", {
      headers: originHeaders(baseURL!, "/dating/"),
      data: { listingId: "000000000000000000000000" },
    });
    expect(res.status()).toBe(401);
    await anon.dispose();
  });
});

test.describe("H6.6a coins: purchase through the signed mock webhook", () => {
  test("a signed webhook credits the coins once, and a forged one credits nothing", async ({ baseURL }) => {
    const base = baseURL!;
    const { api } = await newUserApi(base, "coins");
    const packsRes = await api.get("/api/wallet/coins");
    expect(packsRes.status()).toBe(200);
    const packs = ((await packsRes.json()).data.packs ?? []) as { id: string }[];
    expect(packs.length, "at least one coin pack is seeded").toBeGreaterThan(0);

    const start = await api.post("/api/wallet/coins/checkout", {
      headers: originHeaders(base, "/u/account/credits/"),
      data: { packId: packs[0].id, idempotencyKey: `coin-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}` },
    });
    expect(start.status(), await start.text()).toBe(200);
    const purchase = (await start.json()).data as { id: string; providerPaymentId: string; amount: number; coins: number; status: string };
    expect(purchase.status).toBe("pending");
    expect(await coinBalance(api)).toBe(0);

    const event = {
      eventId: `evt_${purchase.providerPaymentId}`,
      providerPaymentId: purchase.providerPaymentId,
      status: "succeeded",
      amount: purchase.amount,
      currency: "INR",
    };
    // Without a signature the webhook is refused and the balance does not move.
    const forged = await sendCoinEvent(base, event, { sign: false });
    expect(forged.status, forged.text).toBe(400);
    expect(await coinBalance(api)).toBe(0);

    const paid = await sendCoinEvent(base, event);
    expect(paid.status, paid.text).toBe(200);
    expect(await coinBalance(api)).toBe(purchase.coins);

    // A provider retry of the same event credits nothing more.
    const replay = await sendCoinEvent(base, event);
    expect(replay.status, replay.text).toBe(200);
    expect(await coinBalance(api)).toBe(purchase.coins);

    const history = await api.get("/api/wallet/coins/purchases");
    const rows = ((await history.json()).data.items ?? []) as { id: string; status: string }[];
    expect(rows.find((row) => row.id === purchase.id)?.status).toBe("succeeded");
    await api.dispose();
  });
});

test.describe("H6.5 live video tours", () => {
  test("tour endpoints refuse a signed-out caller", async ({ request, baseURL }) => {
    const list = await request.get("/api/tours/");
    expect(list.status()).toBe(401);
    const asked = await request.post("/api/tours/request/", {
      headers: originHeaders(baseURL!, "/"),
      data: { listingId: "000000000000000000000000" },
    });
    expect(asked.status()).toBe(401);
  });

  test("a signed-in user lists tours, and an unknown ad gets a clean error", async ({ baseURL }) => {
    const { api } = await newUserApi(baseURL!, "tour");
    const list = await api.get("/api/tours/");
    expect(list.status()).toBe(200);
    const asked = await api.post("/api/tours/request/", {
      headers: originHeaders(baseURL!, "/"),
      data: { listingId: "000000000000000000000000" },
    });
    expect(asked.status()).toBeGreaterThanOrEqual(400);
    expect(asked.status()).toBeLessThan(500);
    await api.dispose();
  });

  test("live tour request from the ad page (UI)", async () => {
    test.skip(
      true,
      "Lane B's live tour UI is not on main yet: no tour components under src/components and no tour button on the ad page. The API is covered above.",
    );
  });
});

test.describe("H6.7 ads live 72 hours", () => {
  test("an ad past its expiry answers 410", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "expiry");
    const slug = ad.adHref.split("/").filter(Boolean)[1];

    const live = await page.request.get(ad.adHref, { maxRedirects: 0 });
    expect(live.status()).toBe(200);

    const moved = await setListingExpiry(slug, new Date(Date.now() - 60_000));
    expect(moved, "the in-memory test database is reachable").toBe(true);

    const gone = await page.request.get(ad.adHref, { maxRedirects: 0 });
    expect(gone.status()).toBe(410);
    expect(await gone.text()).toMatch(/removed/i);
  });
});
