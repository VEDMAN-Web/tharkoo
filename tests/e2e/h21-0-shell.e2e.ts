import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, grantCredits, hasHorizontalScroll, loginUi, newApi, newUserApi, originHeaders, registerApi, setIdCheckSwitch, test, uniqueEmail, USER_PASSWORD } from "./helpers";
import { fillNewPostAd } from "./flows";

/**
 * H21.0: the shared shell of the post-ad flow: its own header with the live ad-credit pill, the progress line with the step widths,
 * the steps rail on a computer, the support bubble in the right place, and no inner scroll box anywhere. Set SHOTS_DIR to save screenshots.
 */
const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: true });
  const size = page.viewportSize();
  if (size && size.width === 390) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: `${shotsDir}/${name}-768.png`, fullPage: true });
    await page.setViewportSize(size);
  }
}

async function draft(page: Page, baseURL: string) {
  const user = await newUserApi(baseURL, "h210");
  const login = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email: user.email, password: USER_PASSWORD } });
  expect(login.status()).toBe(200);
  await grantCredits(page, 100);
  const categories = (await (await user.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await user.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const created = await page.request.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category._id, cityId: city.id, title: "Shell check ad", description: "A friendly description of the ad that is long enough to pass the check." },
  });
  expect(created.status(), await created.text()).toBe(201);
  await user.api.dispose();
  return ((await created.json()).data as { id: string }).id;
}

const STEP_PERCENT: Record<string, number> = { "1": 16, "2": 36, "3": 56, "4": 76, "5": 94 };

test.describe("H21.0 post-ad shell", () => {
  test("header, progress line, rail, bubble and one scrolling page", async ({ page, baseURL }, info) => {
    test.setTimeout(240_000);
    const id = await draft(page, baseURL!);
    const phone = info.project.name === "phone-390";
    for (const step of ["1", "2", "3", "4", "5"]) {
      await page.goto(`/u/post-insert/?draft=${id}&step=${step}`);
      await expect(page.locator("[data-tk=post-shell]")).toBeVisible();
      // The site header and footer give way to the flow's own header.
      await expect(page.locator(".tkn-header")).toBeHidden();
      await expect(page.locator("[data-tk=post-header]")).toBeVisible();
      await expect(page.locator("[data-tk=header-credit-pill]")).toBeVisible();
      await expect(page.locator("[data-tk=header-credit-balance]")).toHaveText(/\d/);
      const bar = page.locator("[data-tk=post-progress]");
      await expect(bar).toHaveAttribute("aria-valuenow", String(STEP_PERCENT[step]));
      expect(await page.locator("[data-tk=post-progress] > div").evaluate((node) => (node as HTMLElement).style.width)).toBe(`${STEP_PERCENT[step]}%`);
      // The step slides in for a moment; give it time to settle before measuring.
      await expect.poll(() => hasHorizontalScroll(page), { message: `step ${step}: sideways scroll`, timeout: 5_000 }).toBe(false);
      // Only the page scrolls: nothing inside the step card is a scroll box.
      const inner = await page.evaluate(() => {
        const found: string[] = [];
        for (const node of Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *"))) {
          const style = getComputedStyle(node);
          if (style.display === "none") continue;
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1) found.push(`${node.tagName}.${String(node.className).slice(0, 30)}`);
        }
        return found;
      });
      expect(inner, `step ${step}: inner scroll`).toEqual([]);
      if (phone) {
        await expect(page.locator("[data-tk=step-strip]")).toContainText(`Step ${step} of`);
        await expect(page.locator(".tkp-rail")).toBeHidden();
      } else {
        await expect(page.locator(".tkp-rail")).toBeVisible();
        await expect(page.locator(".tkp-step-current")).toHaveCount(1);
        await expect(page.locator("[data-tk=post-help]")).toBeVisible();
      }
      // The support bubble sits clear of the bottom bar on a phone, 28 px from the edges on a computer.
      const bubble = page.locator(".tkn-chat-bubble");
      if (await bubble.isVisible()) {
        const box = (await bubble.boundingBox())!;
        const view = page.viewportSize()!;
        if (phone) {
          expect(view.height - (box.y + box.height)).toBeGreaterThanOrEqual(90);
          expect(view.width - (box.x + box.width)).toBeLessThanOrEqual(20);
        } else {
          expect(Math.round(view.width - (box.x + box.width))).toBe(28);
        }
      }
      await shot(page, `step-${step}`);
    }
  });

  test("the credit pill opens Buy credits for ad credits only", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const id = await draft(page, baseURL!);
    await page.goto(`/u/post-insert/?draft=${id}&step=2`);
    await expect(async () => {
      await page.locator("[data-tk=header-credit-pill]").click();
      await expect(page.locator("[data-tk=credit-packs]")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.locator("[data-tk=wallet-tab-call]")).toHaveCount(0);
  });

  test("the Done screen fills the progress line and keeps the shell", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail("h210done");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await api.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    await page.waitForURL(/\/u\/post-insert\//);
    await fillNewPostAd(page, baseURL!, { title: `H21 shell done ${Date.now()}` });
    await expect(page.locator("[data-tk=post-progress]")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.locator("[data-tk=header-credit-pill]")).toBeVisible();
    await shot(page, "done");
  });

  test("the Verify ID screen has the header and no progress line", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await setIdCheckSwitch(baseURL!, true);
    try {
      const email = uniqueEmail("h210id");
      const api = await newApi(baseURL!);
      await registerApi(api, baseURL!, email);
      await api.dispose();
      await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
      await expect(page.locator("[data-tk=id-check-first]")).toBeVisible();
      await expect(page.locator("[data-tk=post-header]")).toBeVisible();
      await expect(page.locator("[data-tk=post-progress]")).toHaveCount(0);
      await shot(page, "verify-id");
    } finally {
      await setIdCheckSwitch(baseURL!, false);
    }
  });
});
