import type { Page } from "@playwright/test";
import { expect, grantCredits, newUserApi, originHeaders, stubPostingFee, test, USER_PASSWORD } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";
const SIZES: [number, number][] = [[1536, 674], [1366, 768], [1536, 730], [1440, 900]];
const GROUPS = ["dating", "buy-and-sell", "property", "jobs", "vehicles", "education"];

async function draftFor(page: Page, baseURL: string, slug: string, seller: boolean, credits = 100) {
  const user = await newUserApi(baseURL, `fit-${slug}`);
  const login = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email: user.email, password: USER_PASSWORD } });
  expect(login.status()).toBe(200);
  if (credits > 0) await grantCredits(page, credits);
  if (seller) {
    const saved = await page.request.put("/api/auth/seller-profile", {
      headers: originHeaders(baseURL, "/u/seller-profile/"),
      data: { name: "Asha", city: "Mumbai", whatsapp: "", availableNow: false },
    });
    expect(saved.status(), await saved.text()).toBe(200);
  }
  const categories = (await (await user.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await user.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === slug);
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  expect(category, `category ${slug}`).toBeTruthy();
  const created = await page.request.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category!._id, cityId: city.id, title: `Fit check ${slug}`, description: "A friendly description of the ad that is long enough to pass the check." },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  await user.api.dispose();
  return id;
}

async function overflows(page: Page) {
  return page.evaluate(() => {
    const pageExtra = document.documentElement.scrollHeight - window.innerHeight;
    const main = document.querySelector(".tkp-main, .tkp-success");
    const inner: string[] = [];
    if (main) {
      for (const node of Array.from(main.querySelectorAll<HTMLElement>("*")).concat(main as HTMLElement)) {
        const style = getComputedStyle(node);
        if (style.overflowY === "visible" || style.display === "none") continue;
        if (node.scrollHeight - node.clientHeight > 1) inner.push(`${node.tagName.toLowerCase()}.${String(node.className).slice(0, 40)} ${node.scrollHeight}>${node.clientHeight}`);
      }
    }
    const nav = document.querySelector<HTMLElement>(".tkp-nav");
    const aside = document.querySelector<HTMLElement>(".tkp-aside");
    return { pageExtra, inner, navBottom: nav ? nav.getBoundingClientRect().bottom : 0, asideBottom: aside ? aside.getBoundingClientRect().bottom : 0, height: window.innerHeight };
  });
}

test.describe("H7.86 no scrolling on desktop", () => {
  for (const slug of GROUPS) {
    test(`${slug}: every step fits with no page scroll and no inner scroll at the four laptop sizes`, async ({ page, baseURL }, info) => {
      test.skip(info.project.name !== "desktop-1440", "desktop sizes only");
      test.setTimeout(300_000);
      const id = await draftFor(page, baseURL!, slug, true);
      await page.setViewportSize({ width: 1536, height: 674 });
      await page.goto(`/u/post-insert/?draft=${id}&step=2`);
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of");
      const total = Number((((await page.locator("[data-tk=step-of]").innerText()).match(/of (\d)/) ?? [])[1]) || 5);
      const names = total === 6 ? ["1", "2", "more", "3", "4", "5"] : ["1", "2", "3", "4", "5"];
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        for (const name of names) {
          await page.goto(`/u/post-insert/?draft=${id}&step=${name}`);
          await expect(page.locator(".tkp-main[data-step]")).toBeVisible();
          await expect(page.locator(".tkp-step-current")).toHaveCount(1);
          if (name !== "1") await expect(page.locator(".tkp-main")).not.toHaveAttribute("data-step", "category");
          await page.evaluate(() => document.fonts.ready);
          const found = await overflows(page);
          const label = `${slug} step ${name} at ${width}x${height}`;
          expect(found.pageExtra, `${label}: page scroll`).toBeLessThanOrEqual(0);
          expect(found.inner, `${label}: inner scroll`).toEqual([]);
          expect(found.navBottom, `${label}: buttons in view`).toBeLessThanOrEqual(height);
          expect(found.asideBottom, `${label}: preview column in view`).toBeLessThanOrEqual(height);
          if (SHOTS && slug === "dating") await page.screenshot({ path: `${SHOTS}/3-3-${name}-${width}x${height}.png` });
        }
      }
    });
  }

  test("step 5 with no credits (the amber card) fits at the four laptop sizes", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "desktop sizes only");
    test.setTimeout(120_000);
    await stubPostingFee(page);
    const id = await draftFor(page, baseURL!, "dating", true, 0);
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.goto(`/u/post-insert/?draft=${id}&step=5`);
      await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "low");
      const found = await overflows(page);
      expect(found.pageExtra, `amber ${width}x${height}: page scroll`).toBeLessThanOrEqual(0);
      expect(found.inner, `amber ${width}x${height}: inner scroll`).toEqual([]);
      expect(found.navBottom, `amber ${width}x${height}: buttons in view`).toBeLessThanOrEqual(height);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/3-3-amber-${width}x${height}.png` });
    }
  });

  test("a first-time account: About you fits at the four laptop sizes", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "desktop sizes only");
    test.setTimeout(120_000);
    const id = await draftFor(page, baseURL!, "dating", false);
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.goto(`/u/post-insert/?draft=${id}&step=4`);
      await expect(page.locator("[data-tk=about-you]")).toBeVisible();
      const found = await overflows(page);
      expect(found.pageExtra, `about ${width}x${height}: page scroll`).toBeLessThanOrEqual(0);
      expect(found.inner, `about ${width}x${height}: inner scroll`).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/3-3-about-${width}x${height}.png` });
    }
  });
});
