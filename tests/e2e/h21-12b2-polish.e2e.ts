import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, test, USER_PASSWORD } from "./helpers";

/** H21.12b2: no focus box round the step heading, and the (i) pop-up of every option card stays inside the screen. */

const SHOTS = ".shots/H21.12b2";
const SIZES = [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;

async function draftAtStep4(page: Page, baseURL: string) {
  const owner = await newUserApi(baseURL, "h2112b2");
  const categories = (await (await owner.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await owner.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const created = await owner.api.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category._id, cityId: city.id, title: "Study table in good condition", description: "A friendly description of the ad that is long enough." },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  await loginUi(page, owner.email, USER_PASSWORD);
  await page.goto(`/u/post-insert/?draft=${id}&step=4`);
  await expect(page.locator("[data-tk=step-of]")).toContainText("Step 4 of 5");
  // The saved draft is read into the form after the page draws: typing before that would be overwritten.
  await page.waitForLoadState("networkidle");
}

const outline = (page: Page, selector: string) => page.locator(selector).first().evaluate((node) => getComputedStyle(node).outlineStyle);

test("the step heading takes the focus without a ring, and each option's pop-up stays on the screen", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop-1440", "sets its own sizes");
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  await draftAtStep4(page, baseURL!);
  await page.locator("#phone").fill("9876543210");
  await page.locator("#nickname").fill("Asha");
  await expect(page.locator("#phone")).toHaveValue(/98765/);
  // A keyboard step change, the case where a browser draws the ring on whatever takes the focus.
  await page.locator("[data-tk=go-on]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
  await expect(page.locator("[data-tk=step-title]")).toBeFocused();
  expect(await outline(page, "[data-tk=step-title]"), "no ring on the heading").toBe("none");
  // Real controls keep their ring. The app puts the focus on the heading twice (at once and again 120 ms later, after the
  // new step has drawn), so the Tab comes after that, as a person's would.
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, ring: getComputedStyle(document.activeElement!).outlineStyle }));
  expect(focused.tag).not.toBe("H1");
  expect(focused.ring, `ring on ${focused.tag}`).not.toBe("none");

  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await expect(page.locator("[data-tk=review-step]")).toBeVisible();
    const rows = page.locator("[data-tk=boost-choice] [data-tk=plan-row]");
    await expect(rows).toHaveCount(3);
    // The heading focused as the app focuses it after a step change: no ring at this width either.
    await page.locator("[data-tk=step-title]").evaluate((node: HTMLElement) => {
      node.setAttribute("tabindex", "-1");
      node.focus({ focusVisible: true } as FocusOptions);
    });
    await page.waitForTimeout(600);
    await expect(page.locator("[data-tk=step-title]")).toBeFocused();
    expect(await outline(page, "[data-tk=step-title]"), `no ring on the heading at ${width}`).toBe("none");
    await page.screenshot({ path: `${SHOTS}/review-heading-${width}.png` });
    for (let index = 0; index < 3; index += 1) {
      const row = rows.nth(index);
      const button = row.locator(".upl-info");
      await button.evaluate((node) => node.scrollIntoView({ block: "center" }));
      await button.click();
      const pop = row.locator(".upl-pop");
      await expect(pop).toBeVisible();
      const box = (await pop.boundingBox())!;
      expect(box.x, `left edge, card ${index} at ${width}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `right edge, card ${index} at ${width}`).toBeLessThanOrEqual(width);
      // Nothing is painted over it: its four inner corners and middle belong to the pop-up.
      const covered = await pop.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const points = [[r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6], [r.left + r.width / 2, r.top + r.height / 2]];
        return points.filter(([x, y]) => y < window.innerHeight && !node.contains(document.elementFromPoint(x, y))).length;
      });
      expect(covered, `covered points, card ${index} at ${width}`).toBe(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await page.screenshot({ path: `${SHOTS}/info-card${index + 1}-${width}.png` });
      await page.keyboard.press("Escape");
      await expect(pop).toBeHidden();
    }
  }
});
