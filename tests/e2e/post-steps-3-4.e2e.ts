import AxeBuilder from "@axe-core/playwright";
import { ObjectId } from "mongodb";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, loginUi, newUserApi, originHeaders, PNG, test, USER_PASSWORD, withLocalDb } from "./helpers";

async function draftAd(api: APIRequestContext, base: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title, description: "A friendly weekend walk and a long coffee in the morning." },
    });
    if (res.status() === 201) return ((await res.json()).data as { id: string }).id;
  }
  throw new Error("No category accepted a draft ad");
}

async function openPhotos(page: Page, baseURL: string, prefix: string) {
  const owner = await newUserApi(baseURL, prefix);
  const id = await draftAd(owner.api, baseURL, `Photos ${Date.now()}`);
  const promoted = await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(id) }, { $set: { badges: ["featured"] } }));
  expect(promoted?.modifiedCount).toBe(1);
  await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${id}&step=photos`);
  await page.waitForURL(/step=photos/);
  await expect(page.locator("[data-tk=photo-count]")).toContainText(/0 of \d+ photos/);
  return { id, owner };
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

function onPhone(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 1024;
}

async function upload(page: Page, count: number) {
  const files = Array.from({ length: count }, (_, index) => ({ name: `p${index}.png`, mimeType: "image/png", buffer: PNG }));
  await page.locator("[data-tk=photo-input]").setInputFiles(files);
  await expect(page.locator("[data-tk=photo-tile]")).toHaveCount(count, { timeout: 30_000 });
}

test.describe("H7.85 post an ad, steps 3 and 4", () => {
  test("photos: new buttons, camera or gallery, one help line in dating words, cover and reorder", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { owner } = await openPhotos(page, baseURL!, "photos34");
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Photos");
    await expect(page.getByText(/Add clear photos of yourself/)).toHaveCount(1);
    await expect(page.getByText(/item or place/)).toHaveCount(0);
    await expect(page.locator("[data-tk=photo-input]")).toHaveAttribute("accept", "image/*");
    await expect(page.locator("[data-tk=camera-input]")).toHaveAttribute("capture", "environment");
    // FIX-1: Dating is a people category, which never holds a video, so there is no Add video button here.
    await expect(page.locator("label.tkp-btn", { hasText: "Add video" })).toHaveCount(0);
    for (const name of ["Add photos"]) {
      const button = page.locator("label.tkp-btn", { hasText: name });
      await expect(button).toBeVisible();
      expect(await button.evaluate((node) => getComputedStyle(node).textTransform)).toBe("none");
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText("ADD PHOTOS", { exact: true })).toHaveCount(0);
    await upload(page, 3);
    await expect(page.locator("[data-tk=photo-tile]").first().locator("[data-tk=photo-cover]")).toHaveCount(1);
    const preview = page.locator(onPhone(page) ? "[data-tk=preview-sheet]" : "[data-tk=post-preview]");
    if (onPhone(page)) await page.locator("[data-tk=open-preview]").click();
    await expect(preview.locator(".tkn-ls-photo img").first()).not.toHaveAttribute("src", /placeholders/);
    if (onPhone(page)) await page.keyboard.press("Escape");
    for (const selector of [".tkp-mini", ".tkp-btn"]) {
      const boxes = await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent).map((node) => node.getBoundingClientRect().height));
      expect(Math.min(...boxes), selector).toBeGreaterThanOrEqual(44);
    }
    await page.locator("[data-tk=photo-tile]").nth(1).getByRole("button", { name: "Make cover" }).click();
    await expect(page.locator("[data-tk=photo-tile]").nth(0).locator("[data-tk=photo-cover]")).toHaveCount(1);
    await page.locator("[data-tk=photo-tile]").nth(2).getByRole("button", { name: /Remove/ }).click();
    await expect(page.locator("[data-tk=photo-tile]")).toHaveCount(2);
    await owner.api.dispose();
  });

  test("Continue from photos goes to contact, Back comes back, and the preview keeps the cover", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { owner } = await openPhotos(page, baseURL!, "contact34");
    await upload(page, 1);
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
    await expect(page.locator("#phone")).toHaveAttribute("inputmode", "tel");
    await page.locator("#phone").fill("12345");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator(".tkp-main [data-tk=field-error]").first()).toBeVisible();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
    const preview = page.locator(onPhone(page) ? "[data-tk=preview-sheet]" : "[data-tk=post-preview]");
    if (onPhone(page)) await page.locator("[data-tk=open-preview]").click();
    await expect(preview.locator(".tkn-ls-photo img").first()).not.toHaveAttribute("src", /placeholders/);
    if (onPhone(page)) await page.keyboard.press("Escape");
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
    await owner.api.dispose();
  });

  test("every common size: steps 3 and 4 have no sideways scroll and the bar never covers the end", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { id, owner } = await openPhotos(page, baseURL!, "sizes34");
    await upload(page, 2);
    const sizes: [number, number][] = [[360, 740], [390, 844], [768, 1024], [1366, 768], [1536, 730]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const step of ["photos", "4"]) {
        await page.goto(`/u/post-insert/?draft=${id}&step=${step}`);
        await expect(page.locator(".tkp-nav")).toBeVisible();
        expect(await overflow(page), `${width} step ${step}`).toBeLessThanOrEqual(0);
        const nav = (await page.locator(".tkp-nav").boundingBox())!;
        if (width < 1024) {
          expect(Math.round(nav.y + nav.height), `${width} bar at bottom`).toBe(height);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(300);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const lastBottom = await page.evaluate(() => {
            const shown = [...document.querySelectorAll(".tkp-scroll > *")].filter((node) => node.getClientRects().length > 0);
            return shown[shown.length - 1].getBoundingClientRect().bottom;
          });
          const bar = (await page.locator(".tkp-nav").boundingBox())!;
          expect(lastBottom, `${width} step ${step} end above bar`).toBeLessThanOrEqual(bar.y + 1);
        } else {
          await page.evaluate(() => window.scrollTo(0, 0));
          const top = (await page.locator(".tkp-nav").boundingBox())!;
          expect(top.y + top.height - height, `${width}x${height} step ${step} Continue in view`).toBeLessThanOrEqual(1);
        }
      }
    }
    await owner.api.dispose();
  });

  test("steps 3 and 4 pass axe with no serious or critical issue", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { id, owner } = await openPhotos(page, baseURL!, "axe34");
    await upload(page, 2);
    const run = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
    expect(await run()).toEqual([]);
    await page.goto(`/u/post-insert/?draft=${id}&step=4`);
    await expect(page.locator("#phone")).toBeVisible();
    expect(await run()).toEqual([]);
    await owner.api.dispose();
  });
});

async function startAd(page: Page, baseURL: string, prefix: string, city: string) {
  const { api, email } = await newUserApi(baseURL, prefix);
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  const saved = await page.request.put("/api/auth/seller-profile", {
    headers: originHeaders(baseURL, "/u/seller-profile/"),
    data: { name: "E2E Poster", city, whatsapp: "", availableNow: false },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  await page.goto("/u/post-insert/");
  await expect(page.locator(".tkp-tile").first()).toBeVisible();
  return api;
}

test.describe("H7.85 preview and city", () => {
  test("before any photo the preview shows a pink placeholder, not a stock photo, and no photo count", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const api = await startAd(page, baseURL!, "nophoto", "Mumbai");
    await page.locator(".tkp-tile", { hasText: "Dating" }).click();
    await page.locator("[data-tk=go-on]").click();
    if (onPhone(page)) await page.locator("[data-tk=open-preview]").click();
    const card = page.locator("[data-tk=post-preview]").last();
    await expect(card).toHaveAttribute("data-photo", "none");
    const text = await card.locator(".tkn-ls-photo").evaluate((node) => getComputedStyle(node, "::after").content);
    expect(text).toContain("Your photos appear here");
    await expect(card.locator(".tkn-ls-count")).toBeHidden();
    await expect(card.locator(".tkn-ls-photo img").first()).toBeHidden();
    await api.dispose();
  });

  test("the city starts empty, or is the city on the account", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const none = await startAd(page, baseURL!, "citynone", "Nowhere Town");
    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("#city")).toHaveValue("");
    await expect(page.locator("#city option:checked")).toHaveText("Select city");
    await none.dispose();
    const home = await startAd(page, baseURL!, "cityhome", "Mumbai");
    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("#city option:checked")).toHaveText("Mumbai");
    await home.dispose();
  });

  test("a people ad shows the nickname and age under the title, others do not", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const api = await startAd(page, baseURL!, "byline", "Mumbai");
    await page.locator(".tkp-tile", { hasText: "Dating" }).click();
    await page.locator("[data-tk=go-on]").click();
    await page.locator("#nickname").fill("Asha");
    await page.locator("#age").fill("29");
    await page.locator("#title").fill("Coffee and a walk");
    if (onPhone(page)) await page.locator("[data-tk=open-preview]").click();
    await expect(page.locator("[data-tk=post-preview] .tkn-ls-by").last()).toHaveText("Asha, 29");
    await api.dispose();
  });
});

test.describe("H7.85 desktop fit", () => {
  test("step 1 shows all 11 tiles with no inner scroll and no page scroll at 1366x768, 1536x730 and 1536x674, and Preview shows only under 1024 px", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const api = await startAd(page, baseURL!, "fit", "Mumbai");
    const cases: [number, number][] = [[1366, 768], [1536, 730], [1536, 674], [1440, 900], [1024, 768], [768, 1024]];
    for (const [width, height] of cases) {
      await page.setViewportSize({ width, height });
      await page.goto("/u/post-insert/");
      await expect(page.locator(".tkp-tile")).toHaveCount(11);
      const preview = page.locator("[data-tk=open-preview]");
      if (width >= 1024) {
        await expect(preview, `${width} preview button`).toBeHidden();
        const fit = await page.evaluate(() => {
          const scroll = document.querySelector(".tkp-scroll") as HTMLElement;
          return { inner: scroll.scrollHeight - scroll.clientHeight, page: document.documentElement.scrollHeight - window.innerHeight };
        });
        expect(fit.inner, `${width}x${height} inner scroll`).toBeLessThanOrEqual(1);
        expect(fit.page, `${width}x${height} page scroll`).toBeLessThanOrEqual(1);
        const last = (await page.locator(".tkp-tile").last().boundingBox())!;
        const nav = (await page.locator(".tkp-nav").boundingBox())!;
        expect(last.y + last.height, `${width} last tile above the bar`).toBeLessThanOrEqual(nav.y + 1);
        if (width >= 1366) expect(last.height, "tile height").toBeGreaterThanOrEqual(56);
      } else {
        await expect(preview, `${width} preview button`).toBeVisible();
      }
    }
    await api.dispose();
  });
});
