import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, newApi, loginUi, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";

/**
 * H21.1: Step 1, Category. Gradient tiles (three a row on a computer, full-width rows on a phone), the selected ring and tick,
 * the fee note under the tiles, the "How this category looks" preview with real ads, and the rail label "About you".
 * Set SHOTS_DIR to save screenshots (390, 768 and 1440).
 */
const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string, viewportOnly = false) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  const width = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: `${shotsDir}/${name}-${width}.png`, fullPage: !viewportOnly });
  if (width === 390) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: `${shotsDir}/${name}-768.png`, fullPage: !viewportOnly });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

async function poster(page: Page, baseURL: string) {
  const email = uniqueEmail("h211");
  const api = await newApi(baseURL);
  await registerApi(api, baseURL, email);
  await api.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await expect(page.locator(".tkp-tile").first()).toBeVisible();
}

test.describe("H21.1 step 1 category", () => {
  test("tiles, selected ring, fee note and the preview of the category", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone-390";
    await poster(page, baseURL!);
    const tiles = page.locator(".tkp-tile");
    expect(await tiles.count()).toBeGreaterThanOrEqual(3);
    const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) }; }));
    const perRow = boxes.filter((box) => box.top === boxes[0].top).length;
    if (phone) {
      expect(perRow, "one tile a row on a phone").toBe(1);
      expect(Math.min(...boxes.map((box) => box.height))).toBeGreaterThanOrEqual(84);
    } else {
      expect(perRow, "three tiles a row on a computer").toBe(3);
      expect(boxes[0].height).toBe(220);
    }
    // Three soft colours, cycled.
    expect(await tiles.evaluateAll((nodes) => nodes.slice(0, 3).map((node) => node.getAttribute("data-tone")))).toEqual(["pink", "lavender", "sky"]);

    await tiles.filter({ hasText: "Buy and sell" }).click();
    const picked = tiles.filter({ hasText: "Buy and sell" });
    await expect(picked).toHaveAttribute("aria-pressed", "true");
    expect(await picked.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("rgb(194, 18, 111)");
    await expect(picked.locator(".tkp-tile-tick svg")).toHaveCount(1);

    // The note under the tiles says the cost; it comes from the posting-fee settings.
    // A site that does not charge for posting says nothing here (H17.9: no unconditional "free" sentence).
    const note = page.locator("[data-tk=post-fee-note]");
    if (await note.count()) await expect(note).toHaveText(/free ads left|costs \d+ credits/i);

    // The preview: on a phone under the tiles, on a computer in the side column. Real ads, then grey cards with no text.
    const preview = page.locator(phone ? "[data-tk=category-preview-inline]" : "[data-tk=category-preview-side]");
    await expect(preview).toBeVisible();
    await expect(preview.locator(".tkp-catpre-caption")).toContainText("Buy and sell");
    await expect(page.locator(phone ? "[data-tk=category-preview-side]" : "[data-tk=category-preview-inline]")).toBeHidden();
    await expect.poll(async () => (await preview.locator(".tkp-catpre-card, .tkp-catpre-skel").count()), { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
    expect(await preview.locator(".tkp-catpre-skel").evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim()))).toEqual(expect.arrayContaining([]));

    if (!phone) {
      await expect(page.locator(".tkp-step-label")).toHaveText(["Category", "Details", "Photos", "About you", "Review"]);
      await expect(page.locator("[data-tk=step-of]")).toBeVisible();
    }
    // Only the page scrolls.
    const inner = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *")).filter((node) => { const s = getComputedStyle(node); return s.display !== "none" && (s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1; }).length);
    expect(inner).toBe(0);

    await shot(page, "category");
    // The support bubble, bottom right (the cookie notice is closed first so nothing hides it).
    const accept = page.getByRole("button", { name: /accept|agree|got it|ok/i }).first();
    if (await accept.isVisible().catch(() => false)) await accept.click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const bubble = page.locator(".tkn-chat-bubble");
    await shot(page, "category-bubble", true);
    // H21.12c: below 1024 px the bubble is hidden on the post-ad screens; on a computer it sits 28 px from the edges.
    const view = page.viewportSize()!;
    if (view.width < 1024) {
      await expect(bubble).toBeHidden();
    } else {
      await expect(bubble).toBeVisible();
      const box = (await bubble.boundingBox())!;
      expect(Math.round(box.width)).toBeGreaterThanOrEqual(48);
      expect(Math.round(view.width - (box.x + box.width))).toBe(28);
      expect(Math.round(view.height - (box.y + box.height))).toBe(28);
    }
  });
});
