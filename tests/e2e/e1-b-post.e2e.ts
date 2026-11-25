import { expect, grantCredits, hasHorizontalScroll, loginUi, newApi, PNG, registerApi, uniqueEmail, USER_PASSWORD, withLocalDb, pickCity } from "./helpers";
import { finalChecks, test } from "./e1-b-helpers";
import { fillNewPostAd } from "./flows";

/**
 * E1-B: posting journeys that the other specs only touch in parts: a people category (Dating) with its age and adult rules
 * walked to the live ad, and free versus paid posting with the live settings.
 */

const MONEY_KEYS = ["paidPostingOn", "postingFeeCredits", "creditPriceInr", "mockPaymentsOn", "freeAdsPerAccount"] as const;

async function setPosting(values: { free: number; fee: number; paid: boolean }) {
  const saved = await withLocalDb(async (db) => (await db.collection("sites").findOne({ key: "default" })) ?? {});
  await withLocalDb((db) =>
    db.collection("sites").updateOne(
      { key: "default" },
      { $set: { paidPostingOn: values.paid, postingFeeCredits: values.fee, creditPriceInr: 10, mockPaymentsOn: true, freeAdsPerAccount: values.free } },
      { upsert: true },
    ),
  );
  return async () => {
    await withLocalDb(async (db) => {
      for (const key of MONEY_KEYS) {
        if (saved && key in saved) await db.collection("sites").updateOne({ key: "default" }, { $set: { [key]: (saved as Record<string, unknown>)[key] } });
        else await db.collection("sites").updateOne({ key: "default" }, { $unset: { [key]: "" } });
      }
    });
  };
}

async function newPoster(page: import("@playwright/test").Page, baseURL: string, prefix: string, credits: number) {
  const email = uniqueEmail(prefix);
  const api = await newApi(baseURL);
  await registerApi(api, baseURL, email);
  await api.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
  if (credits !== 100) {
    // loginUi gives 100 credits; set the wanted balance by adding or leaving as is.
    if (credits > 100) await grantCredits(page, credits - 100);
  }
  return email;
}

test.describe("E1-B posting journeys", () => {
  test.afterEach(async ({ page }, info) => {
    if (info.status === "passed") await finalChecks(page);
  });

  test("people category: Dating asks for the age (18 or over) and the adult consent, then goes live", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await newPoster(page, baseURL!, "e1people", 100);
    const title = `E1 dating ${Date.now()}`;
    await page.locator(".tkp-tile", { hasText: "Dating" }).click();
    await page.locator("[data-tk=go-on]").click();
    await pickCity(page, "Mumbai");
    await page.locator("#title").fill(title);
    await page.locator("#text").fill("A friendly description with enough words to pass the checks here.");
    await page.getByRole("button", { name: "Coffee", exact: true }).click();

    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 3 of 5");

    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
    await page.locator("[data-tk=go-on]").click();
    await page.locator("#phone").fill("9876543210");
    await page.locator("#nickname").fill("Asha");
    // H21.4: the age is asked in step 4. No age: stays on the step and says what is needed.
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
    await expect(page.locator("[data-tk=field-error]", { hasText: "Enter your age (18 or over)." })).toBeVisible();
    // Under 18: refused with the same words.
    await page.locator("#age").fill("17");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
    await expect(page.locator("[data-tk=field-error]", { hasText: "Enter your age (18 or over)." })).toBeVisible();
    // 18 passes.
    await page.locator("#age").fill("18");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");

    // Without the adult consent the ad does not go live.
    await page.locator("#consent-terms").check();
    // H21.5a: the 18+ tick is shown only until it has been accepted once; this account accepted it at sign-up.
    if (await page.locator("#consent-adult").count()) {
      await page.locator(".tkp-nav button", { hasText: "PUBLISH" }).click();
      await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toHaveCount(0);
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
      await page.locator("#consent-adult").check();
    }
    await page.locator(".tkp-nav button", { hasText: "PUBLISH" }).click();
    await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toBeVisible();

    // The public ad page shows no Call button for a people ad.
    const rows = (((await (await page.request.get("/api/listings/?pageSize=100")).json()).data?.items ?? []) as { title: string; slug?: string }[]);
    const mine = rows.find((row) => row.title.includes(title));
    expect(mine?.slug, "the ad is in the poster's list").toBeTruthy();
    const ad = await page.request.get(`/ad/${mine!.slug}/`);
    expect(ad.status()).toBe(200);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("free then paid: the first ad is free, the next one takes its fee from the credits", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const restore = await setPosting({ free: 1, fee: 20, paid: true });
    try {
      await newPoster(page, baseURL!, "e1paid", 100);
      const balance = async () => (await (await page.request.get("/api/wallet/")).json()).data.balance as number;
      await fillNewPostAd(page, baseURL!, { title: `E1 free ${Date.now()}` });
      expect(await balance(), "the first ad is free").toBe(100);
      await page.goto("/u/post-insert/");
      await fillNewPostAd(page, baseURL!, { title: `E1 paid ${Date.now()}` });
      expect(await balance(), "the second ad costs the fee").toBe(80);
      await page.goto("/u/account/credits/history/");
      await page.getByRole("tab", { name: "Credits used" }).or(page.getByRole("button", { name: "Credits used" })).first().click();
      await expect(page.locator("main")).toContainText("20");
    } finally {
      await restore();
    }
  });

  test("paid posting with no credits: the ad waits and the page leads to recharge", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const restore = await setPosting({ free: 0, fee: 20, paid: true });
    try {
      const email = uniqueEmail("e1broke");
      const api = await newApi(baseURL!);
      await registerApi(api, baseURL!, email);
      await api.dispose();
      const login = await page.request.post("/api/auth/login", { headers: { origin: baseURL!, referer: `${baseURL}/u/login/` }, data: { email, password: USER_PASSWORD } });
      expect(login.ok()).toBe(true);
      await page.request.put("/api/auth/seller-profile", { headers: { origin: baseURL!, referer: `${baseURL}/u/seller-profile/` }, data: { name: "E2E Seller", city: "Mumbai", whatsapp: "", availableNow: false } });
      await page.goto("/u/post-insert/");
      // H21.1: the cost is said in the note under the tiles, not in the lead line.
    await expect(page.locator("[data-tk=post-fee-note]")).toContainText("20 credits");
      await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
      await page.locator("[data-tk=go-on]").click();
      await pickCity(page, "Mumbai");
      const roleHere = (await page.locator("#role").count()) > 0;
      if (roleHere) await page.locator("#role").fill("Office assistant");
      await page.locator("#title").fill(`E1 broke ${Date.now()}`);
      await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
      await page.locator("[data-tk=go-on]").click();
      if (!roleHere) {
        await page.locator("#role").fill("Office assistant");
        await page.locator("[data-tk=go-on]").click();
      }
      await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
      await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
      await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
      await page.locator("[data-tk=go-on]").click();
      await page.locator("#phone").fill("9876543210");
      await page.locator("#nickname").fill("Asha");
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=boost-short]")).toBeVisible();
      await expect(page.locator("[data-tk=cost-posting]")).toHaveText("20 credits");
      expect(await hasHorizontalScroll(page)).toBe(false);
    } finally {
      await restore();
    }
  });
});

