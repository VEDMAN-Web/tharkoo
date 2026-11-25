import { mkdirSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, loginUi, newUserApi, originHeaders, test, USER_PASSWORD } from "./helpers";

/**
 * H21.4: Step 4, About you. The name on the ads (and the age for people ads) now live here, with the phone number (country code in front),
 * WhatsApp and Telegram as switches, the "we remember these" note, filling from the last ad, and a preview that lights up the "Posted by" line.
 * Set SHOTS_DIR to save screenshots (390, 768, 1440).
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

async function draft(api: APIRequestContext, baseURL: string, title: string, contact?: Record<string, unknown>) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const created = await api.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category._id, cityId: city.id, title, description: "A friendly description of the ad that is long enough." },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  if (contact) {
    const patched = await api.patch(`/api/listings/${id}`, { headers: originHeaders(baseURL, "/u/post-insert/"), data: { stage: "details", contact } });
    expect(patched.status(), await patched.text()).toBeLessThan(300);
  }
  return id;
}

test.describe("H21.4 step 4 about you", () => {
  test("fields, switches, errors, preview highlight and the support bubble", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone-390";
    const owner = await newUserApi(baseURL!, "h214");
    const id = await draft(owner.api, baseURL!, `About check ${Date.now()}`);
    await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${id}&step=4`);
    await expect(page.locator("[data-tk=contact-fields]")).toBeVisible();
    await expect(page.locator("[data-tk=step-title]")).toHaveText("About you");
    await expect(page.locator("[data-tk=step-help]")).toHaveText("How people will see you and reach you.");
    await expect(page.locator("[data-tk=about-note]")).toContainText("We remember these");
    if (!phone) await expect(page.locator(".tkp-step-label")).toHaveText(["Category", "Details", "Photos", "About you", "Review"]);

    // Order: name, phone, then "Also reach me on". No city here.
    const order = await page.locator("[data-tk=contact-fields] #nickname, [data-tk=contact-fields] #phone, [data-tk=contact-fields] [data-tk=whatsapp-options], [data-tk=contact-fields] [data-tk=telegram-option]").evaluateAll((nodes) => nodes.map((node) => node.id || node.getAttribute("data-tk")));
    expect(order).toEqual(["nickname", "phone", "whatsapp-options", "telegram-option"]);
    await expect(page.locator("#city, #about-city")).toHaveCount(0);
    await expect(page.locator("#nickname")).toHaveAttribute("autocomplete", "nickname");
    await expect(page.locator("#phone")).toHaveAttribute("inputmode", "tel");
    await expect(page.locator(".tka-pre").first()).toHaveText("+91");
    await expect(page.locator("[data-tk=phone-hint]")).toHaveText("Shown on your ad so people can call you.");
    await expect(page.locator("[data-tk=nickname-hint]")).toHaveText("A first name or nickname is fine.");

    // The name counts up to 20.
    await page.locator("#nickname").fill("Asha Walks Every Morning Long");
    await expect(page.locator("#nickname")).toHaveValue("Asha Walks Every Mor");
    await expect(page.locator(".tka-count").first()).toHaveText("20 / 20");
    await page.locator("#nickname").fill("");

    // Errors: Continue with the name and the phone empty.
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=field-error]").first()).toBeVisible();
    await expect(page.locator("#nickname")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#phone")).toHaveAttribute("aria-invalid", "true");
    await shot(page, "about-errors");

    // Switches: WhatsApp shows "same number" (own number box when unticked); Telegram shows an @ box.
    const wa = page.getByRole("switch", { name: "WhatsApp" });
    await wa.click();
    await expect(wa).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#whatsapp-same")).toBeVisible();
    await page.locator("#whatsapp-same").uncheck();
    await expect(page.locator("#whatsapp-number")).toBeVisible();
    await page.locator("#whatsapp-same").check();
    await expect(page.locator("#whatsapp-number")).toHaveCount(0);
    const tg = page.getByRole("switch", { name: "Telegram" });
    await tg.click();
    await expect(page.locator("#telegram")).toBeVisible();
    await expect(page.locator(".tka-pre", { hasText: "@" })).toBeVisible();
    for (const sw of [wa, tg]) {
      const box = (await sw.boundingBox())!;
      expect(Math.round(box.width)).toBe(52);
      expect(Math.round(box.height)).toBe(30);
    }
    await page.locator("#nickname").fill("Asha");
    await page.locator("#phone").fill("98765 43210");
    await page.locator("#telegram").fill("asha_walks");

    // The preview: the "Posted by" line is outlined with the Editing tag; on a phone it opens from the Preview button.
    await page.locator("#nickname").focus();
    if (phone) {
      await page.locator("[data-tk=open-preview]").click();
      await expect(page.locator("[data-tk=preview-sheet] .tkd-pv-by")).toContainText("Asha");
      await shot(page, "about-preview-sheet", true);
      await page.keyboard.press("Escape");
    } else {
      const card = page.locator("[data-tk=details-preview]");
      await expect(card).toHaveAttribute("data-editing", "name");
      await expect(card.locator(".tkd-pv-by .tkd-pv-tag")).toHaveText("Editing");
      await expect(card.locator(".tkd-pv-by")).toContainText("Asha");
    }

    // Only the page scrolls, and the bubble is visible.
    const inner = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *")).filter((node) => { const s = getComputedStyle(node); return s.display !== "none" && (s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1; }).length);
    expect(inner).toBe(0);
    await shot(page, "about");
    await expect(page.locator(".tkn-chat-bubble")).toBeVisible();
    await shot(page, "about-bubble", true);
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 5 of 5");
  });

  test("a new ad is filled in from the account's last ad", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const owner = await newUserApi(baseURL!, "h214last");
    await draft(owner.api, baseURL!, `Last ad ${Date.now()}`, { phone: "+919876543210", telegram: "asha_walks" });
    const second = await draft(owner.api, baseURL!, `Second ad ${Date.now()}`);
    await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${second}&step=4`);
    await expect(page.locator("[data-tk=contact-fields]")).toBeVisible();
    await expect(page.locator("#phone")).toHaveValue("9876543210", { timeout: 15_000 });
    await expect(page.getByRole("switch", { name: "Telegram" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#telegram")).toHaveValue("asha_walks");
  });
});
