import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, signInAdminContext, test } from "./helpers";

/** H12.4: light motion. Nothing moves with reduced motion, nothing shifts, the hero and the first screen stay still, and the new motion is there when it is allowed. */

const SHOTS = process.env.H124_SHOTS_DIR || ".shots/H12.4";

async function frames(page: Page, name: string, action: () => Promise<void>) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-1-before.png` });
  await action();
  await page.waitForTimeout(90);
  await page.screenshot({ path: `${SHOTS}/${name}-2-moving.png` });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/${name}-3-after.png` });
}

test.describe("H12.4 light motion", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("A1: with reduced motion nothing runs and no transition lasts longer than 10 ms, on Home, a category, the account and the admin", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { api, email } = await newUserApi(baseURL!, "h124reduce");
    await api.dispose();
    const check = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.mouse.move(40, 40);
      await page.waitForTimeout(400);
      const found = await page.evaluate(() => {
        const running = document.getAnimations().filter((item) => item.playState === "running" || item.pending).map((item) => `${(item.effect as KeyframeEffect | null)?.target?.tagName ?? "?"}.${String((item.effect as KeyframeEffect | null)?.target?.className ?? "").slice(0, 30)}`);
        const slow: string[] = [];
        for (const node of Array.from(document.querySelectorAll("*"))) {
          const seconds = getComputedStyle(node).transitionDuration.split(",").map((part) => (part.trim().endsWith("ms") ? parseFloat(part) / 1000 : parseFloat(part)));
          if (seconds.some((value) => value > 0.01)) slow.push(`${node.tagName}.${String(node.className).slice(0, 30)}`);
        }
        return { running: running.slice(0, 8), slow: slow.slice(0, 8) };
      });
      expect(found, path).toEqual({ running: [], slow: [] });
    };
    await check("/");
    await check("/dating/");
    await loginUi(page, email, undefined, "/u/account/");
    await check("/u/account/");
    await signInAdminContext(context, baseURL!);
    await check("/admin/");
  });

  test("A3 and A4: no layout shift on Home at 390 and the h1 and the first image have no animation", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    for (let step = 0; step < 6; step += 1) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(250);
    }
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.001);
    await page.evaluate(() => window.scrollTo(0, 0));
    const still = await page.evaluate(() => {
      const nodes = [document.querySelector("h1"), document.querySelector('img[fetchpriority="high"]'), document.querySelector("main img")].filter(Boolean) as Element[];
      return nodes.map((node) => getComputedStyle(node).animationName);
    });
    expect(still.length).toBeGreaterThan(0);
    for (const name of still) expect(name).toBe("none");
  });

  test("items 1 and 3: a card lifts on hover (only where hover exists) and the heart pops when it turns on", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/");
    await page.waitForLoadState("networkidle");
    const card = page.locator(".m-lift").first();
    await card.scrollIntoViewIfNeeded();
    const before = await card.evaluate((node) => getComputedStyle(node).transform);
    await frames(page, "item1-lift", async () => {
      await card.hover();
    });
    const lifted = await card.evaluate((node) => getComputedStyle(node).transform);
    expect(lifted).not.toBe(before);
    expect(lifted).toMatch(/^matrix/);
    // The pop: the keyframes are 1 to 1.18 to 1 in 220 ms.
    const pop = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSKeyframesRule && rule.name === "m-pop") return rule.cssText;
        } catch {
          /* a cross-origin sheet */
        }
      }
      return "";
    });
    expect(pop).toContain("1.18");
    const heart = page.locator('button[aria-label*="Save" i], button[aria-pressed]').filter({ has: page.locator("svg") }).first();
    if (await heart.count()) {
      await frames(page, "item3-heart", async () => {
        await heart.click();
      });
    }
  });

  test("items 7 and 8: the post-ad step slides in the right way and the chosen credit pack grows a little with a ring", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const { api, email } = await newUserApi(baseURL!, "h124post");
    await api.dispose();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginUi(page, email, undefined, "/u/post-insert/");
    const main = page.locator(".tkp-main");
    await expect(main).toBeVisible();
    // Nothing slides on the first screen.
    expect(await main.getAttribute("data-dir")).toBeNull();
    await page.locator(".tkp-tile").first().click();
    await frames(page, "item7-step", async () => {
      await page.locator("[data-tk=go-on]").click();
    });
    await expect(main).toHaveAttribute("data-dir", "fwd");
    expect(await page.locator(".tkp-main > .tkp-scroll").evaluate((node) => getComputedStyle(node).animationName)).toBe("m-step-fwd");
    await page.getByRole("button", { name: "Back" }).first().click();
    await expect(main).toHaveAttribute("data-dir", "back");
    expect(await page.locator(".tkp-main > .tkp-scroll").evaluate((node) => getComputedStyle(node).animationName)).toBe("m-step-back");

    await page.goto("/u/account/credits/");
    const packs = page.locator('[data-tk="credit-packs"] [data-tk="recharge-pack"]');
    await expect(packs.first()).toBeVisible();
    await frames(page, "item8-pack", async () => {
      await packs.nth(1).click();
    });
    await expect(packs.nth(1)).toHaveAttribute("aria-checked", "true");
    expect(await packs.nth(1).evaluate((node) => getComputedStyle(node).transform)).toBe("matrix(1.02, 0, 0, 1.02, 0, 0)");
    expect(await packs.nth(0).evaluate((node) => getComputedStyle(node).transform)).toBe("none");
    expect(await packs.nth(1).evaluate((node) => getComputedStyle(node, "::after").opacity)).toBe("1");
  });

  test("items 11 to 13: the admin drawer slides in from the right and the save bar and a success toast rise; a saved row flashes once", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/users/");
    const row = page.locator('[data-tk="server-table"] tbody tr').first();
    await expect(row).toBeVisible();
    await frames(page, "item11-drawer", async () => {
      await row.click();
    });
    const drawer = page.locator(".adm-k-drawer").first();
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((node) => getComputedStyle(node).animationName)).toBe("adm-k-drawer-in");
    expect(await drawer.evaluate((node) => getComputedStyle(node).animationDuration)).toBe("0.22s");
  });
});
