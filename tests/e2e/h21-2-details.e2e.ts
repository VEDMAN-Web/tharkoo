import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newApi, pickCity, registerApi, test, uniqueEmail, USER_PASSWORD } from "./helpers";

/**
 * H21.2: Step 2, Ad details. Field order, the City combobox (type a few letters, the state comes with the city), one interests field with chips,
 * the category's other fields inline, no price, the "Fix N things" summary that takes focus, and the live preview that lights up the part being edited.
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

async function toDetails(page: Page, baseURL: string) {
  const email = uniqueEmail("h212");
  const api = await newApi(baseURL);
  await registerApi(api, baseURL, email);
  await api.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.locator(".tkp-tile", { hasText: "Buy and sell" }).click();
  await page.locator("[data-tk=go-on]").click();
  await expect(page.locator("[data-tk=details-step]")).toBeVisible();
}

test.describe("H21.2 step 2 details", () => {
  test("field order, city combobox, interests, no price, no inner scroll", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await toDetails(page, baseURL!);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Ad details");
    await expect(page.locator("#price")).toHaveCount(0);
    // Order: category row, title, description, city, area, interests.
    const order = await page.locator("[data-tk=details-step] #title, [data-tk=details-step] #text, [data-tk=details-step] #city, [data-tk=details-step] #district, [data-tk=details-step] #interest-input").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(order).toEqual(["title", "text", "city", "district", "interest-input"]);
    await expect(page.locator("[data-tk=details-category]")).toContainText("Buy and sell");
    // Area is off until a city is chosen (the box may start with the account's own city, so clear it first).
    await page.locator("#city").fill("");
    await expect(page.locator("#district")).toBeDisabled();

    // City: type letters, options show the state, keys work, choosing sets the city.
    const city = page.locator("#city");
    await expect(city).toHaveAttribute("role", "combobox");
    await city.fill("mum");
    const options = page.locator("[role=option]");
    await expect(options.first()).toContainText("Mumbai");
    await expect(options.first().locator("small")).not.toHaveText("");
    expect((await options.first().innerText()).toLowerCase().startsWith("mum")).toBe(true);
    await shot(page, "details-city-open", true);
    await city.press("ArrowDown");
    await city.press("Enter");
    await expect(city).toHaveValue(/Mumbai|Mum/);
    await expect(page.locator("#district")).toBeEnabled();
    // A made-up city gives the inline message and no state.
    await city.fill("zzqq");
    await page.locator("#title").focus();
    await expect(page.locator("[data-tk=field-error]").first()).toContainText("No city called");
    await pickCity(page, "Mumbai");

    // Interests: Enter adds a chip, x removes it, five at most.
    const input = page.locator("#interest-input");
    for (const word of ["one", "two", "three", "four", "five"]) {
      await input.fill(word);
      await input.press("Enter");
    }
    await expect(page.locator("[data-tk=interest-chip]")).toHaveCount(5);
    await expect(input).toBeDisabled();
    await page.getByRole("button", { name: "Remove one" }).click();
    await expect(page.locator("[data-tk=interest-chip]")).toHaveCount(4);

    // Only the page scrolls.
    const inner = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *")).filter((node) => { const s = getComputedStyle(node); return s.display !== "none" && (s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1; }).length);
    expect(inner).toBe(0);
    await shot(page, "details");
  });

  test("errors: a summary that takes focus, inline messages, and the preview lights up the field being edited", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone-390";
    await toDetails(page, baseURL!);
    await page.locator("#city").fill("zzqq");
    await page.locator("[data-tk=go-on]").click();
    const summary = page.locator("[data-tk=error-summary]");
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toContainText(/Fix \d things to continue/);
    await expect(summary.locator("a", { hasText: "Add a title for your ad" })).toBeVisible();
    await expect(page.locator("#title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("[data-tk=field-error]").first()).toBeVisible();
    // A link in the summary goes to its field.
    await summary.locator("a", { hasText: "Add a title for your ad" }).click();
    await expect(page.locator("#title")).toBeFocused();
    await shot(page, "details-errors");

    // The preview: the part being edited gets the outline and the "Editing" tag.
    await page.locator("#title").fill("Hair spa at home");
    if (phone) await page.locator("[data-tk=open-preview]").click();
    const card = phone ? page.locator("[data-tk=preview-sheet]") : page.locator("[data-tk=details-preview]");
    await expect(card.locator(".tkd-pv-title")).toContainText("Hair spa at home");
    if (phone) {
      await shot(page, "details-preview-sheet", true);
      await page.keyboard.press("Escape");
    } else {
      await expect(card).toHaveAttribute("data-editing", "title");
      await expect(card.locator(".tkd-pv-title .tkd-pv-tag")).toHaveText("Editing");
      await page.locator("#interest-input").focus();
      await expect(card).toHaveAttribute("data-editing", "tags"); // H21.4: the name is typed in step 4, so the third highlight is the interests
    }
    // The support bubble stays visible on this step.
    await expect(page.locator(".tkn-chat-bubble")).toBeVisible();
    await shot(page, "details-bubble", true);
  });
});
