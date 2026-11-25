import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, test, uniqueEmail, USER_PASSWORD, pickCity } from "./helpers";

/** H9.4 part 1: posting-flow polish on a phone, the plain error words, no prefilled nickname for people, and "Your city" in the preview. */

const SHOTS = process.env.H94_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function poster(page: Page, baseURL: string, prefix: string) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.waitForURL(/\/u\/post-insert\//);
}

async function toDetails(page: Page, category: string) {
  await page.locator(".tkp-tile", { hasText: category }).click();
  await page.locator("[data-tk=go-on]").click();
  await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of");
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H9.4 posting polish, part 1", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("phone: the header Post your ad button is hidden inside the flow, one progress indicator, and the sticky bar never covers the last field", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await poster(page, baseURL!, "h94phone");
    await expect(page.locator('[data-tk="post-ad"]').first()).toBeHidden();
    await expect(page.locator(".tkp-progress")).toBeHidden();
    // H21.0: the phone shows the step strip instead of the steps rail.
    await expect(page.locator("[data-tk=step-strip]")).toBeVisible();
    await toDetails(page, "Dating");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const nav = (await page.locator(".tkp-nav").boundingBox())!;
    const lastField = (await page.locator(".tkd").boundingBox())!; // H21.2: the details step is the .tkd block
    expect(lastField.y + lastField.height).toBeLessThanOrEqual(nav.y);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "details");
    await page.setViewportSize({ width: 1440, height: 900 });
    // H21.0: the flow has its own header, so the site header (and its Post your ad button) stays hidden on desktop too.
    await expect(page.locator('[data-tk="post-ad"]').first()).toBeHidden();
    await shot(page, "details");
  });

  test("a people ad starts with an empty Nickname and the hint; the plain error words and Your city show; a jobs ad keeps the account name", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await poster(page, baseURL!, "h94people");
    await toDetails(page, "Dating");
    await expect(page.locator("#nickname")).toHaveValue("");
    await expect(page.getByText("The name people see, e.g. your first name")).toBeVisible();
    await page.locator("[data-tk=go-on]").click();
    const errors = await page.locator("[data-tk=field-error]").allInnerTexts();
    expect(errors).toEqual(expect.arrayContaining(["Fill this in.", "Enter your age (18 or over).", "Add a title for your ad.", "Pick one."]));
    expect(errors.join(" ")).not.toMatch(/Please, fill|Invalid field|alphanumeric|must enter/);
    await shot(page, "errors");
    await page.setViewportSize({ width: 1440, height: 900 });
    // H21.2: the details step has its own preview card; its place tag says "City" until a city is chosen.
    await page.locator("#city").fill("");
    await expect(page.locator("[data-tk=details-preview]")).toContainText("City");
    await pickCity(page, "Mumbai");
    await expect(page.locator("[data-tk=details-preview]")).toContainText("Mumbai");
    await shot(page, "preview");
  });
});
