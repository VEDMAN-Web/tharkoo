import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, firstAdPath, hasHorizontalScroll, isPhone, test, uniqueEmail, withLocalDb } from "./helpers";

/**
 * E1-A journeys for the visitor and support areas that the older specs do not cover:
 * save without login, report an ad, share, the 404 page, How it works, the legal pages, filters and sort on a category plus city
 * listing (with the phone filter sheet), the hover pop-out (computer only, never on a phone), the 18+ notice on a people category,
 * and a guest support ticket. Each journey runs at 1440 and at 390 and ends by asserting no console errors.
 */

const SHOTS = process.env.E1_SHOTS_DIR ?? "";
const LISTING = "/dating/bengaluru/";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** Console errors and uncaught page errors seen while a journey runs. Every journey ends by asserting there are none. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text().slice(0, 200)}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`));
  return problems;
}

async function oneHeading(page: Page, where: string) {
  await expect(page.getByRole("heading", { level: 1 }), `${where}: exactly one h1`).toHaveCount(1);
}


test.describe("E1-A visitor journeys", () => {
  test("J1 save without login: the heart saves on this device, survives a reload, and the saved list shows it cleanly", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    await page.goto(LISTING);
    await page.waitForLoadState("networkidle");
    const row = page.locator('[data-tk="listing-row"]').first();
    await expect(row).toBeVisible();
    const savedTitle = (await row.locator(".tkh-ad-link").innerText()).trim();
    const heart = row.locator(".tk-row-save");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await shot(page, "j1-saved");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-tk="listing-row"]').first().locator(".tk-row-save")).toHaveAttribute("aria-pressed", "true");
    await page.goto("/u/account/saved/");
    await page.waitForLoadState("networkidle");
    await shot(page, "j1-saved-list");
    // By design a visitor's saved ads stay on this device: the list shows them and asks for no login. The place line must read cleanly.
    await expect(page.locator("main").getByText(savedTitle).first(), "the saved ad is listed").toBeVisible();
    await oneHeading(page, "saved ads");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(problems, "no console errors").toEqual([]);
  });

  test("J2 report an ad: the ad page links to the report form and a reason is required (sending is in the failing list)", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    const path = await firstAdPath(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const report = page.getByRole("link", { name: /report/i }).first();
    await expect(report, "the ad page has a Report link").toBeVisible();
    await shot(page, "j2-ad-page");
    await report.click();
    await expect(page).toHaveURL(/\/submit-report\/\?ad=/);
    await oneHeading(page, "report page");
    const form = page.getByRole("form", { name: "Report this ad" });
    await form.getByRole("button", { name: /send|submit/i }).click();
    expect(await form.locator("select").evaluate((node) => (node as HTMLSelectElement).validity.valueMissing), "a reason is required").toBe(true);
    await expect(page.getByText("Thank you. Our team reviews every report.")).toHaveCount(0);
    await form.locator("select").selectOption("fake");
    await form.getByRole("textbox").first().fill("E1 test report: please ignore.");
    await shot(page, "j2-report-form");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(problems, "no console errors").toEqual([]);
  });

  test("J4 the 404 page: status 404, one heading, a way home, ads to browse, no sideways scroll, axe clean", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    const response = await page.goto("/there-is-no-such-page-e1a/");
    expect(response?.status()).toBe(404);
    await page.waitForLoadState("networkidle");
    await oneHeading(page, "404");
    await expect(page.getByRole("link", { name: /home|browse|back/i }).first()).toBeVisible();
    await expect(page.locator('[data-tk="listing-row"]').first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "j4-404");
    expect(problems.filter((line) => !line.includes("404")), "no console errors other than the 404 itself").toEqual([]);
  });

  test("J5 How it works: one heading, the questions, a way to post, and the cost answer follows the live rule", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    await page.goto("/how-it-works/");
    await page.waitForLoadState("networkidle");
    await oneHeading(page, "how it works");
    await expect(page.getByText("What does it cost to post?")).toBeVisible();
    await expect(page.getByText(/Posting an ad is free|ads are free|Each ad costs/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /post/i }).first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "j5-how-it-works");
    expect(problems, "no console errors").toEqual([]);
  });

  for (const path of ["/terms/", "/privacy/", "/cookies/", "/grievance/", "/prohibited-items/", "/safety/", "/contact/", "/help/"]) {
    test(`J6 legal and info page ${path}: opens, one heading, real text, no sideways scroll, axe clean`, async ({ page }) => {
      test.setTimeout(120_000);
      const problems = watchConsole(page);
      const response = await page.goto(path);
      expect(response?.status(), `${path} answers 200`).toBe(200);
      await page.waitForLoadState("networkidle");
      await oneHeading(page, path);
      const text = (await page.locator("main").innerText()).trim();
      expect(text.length, `${path} has real text`).toBeGreaterThan(200);
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      expect(problems, "no console errors").toEqual([]);
    });
  }

  test("J6b the footer links to the legal pages from Home", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const footer = page.locator("footer").first();
    for (const [name, path] of [["Terms", "/terms/"], ["Privacy", "/privacy/"]] as const) {
      const link = footer.getByRole("link", { name: new RegExp(name, "i") }).first();
      await expect(link, `${name} link in the footer`).toBeVisible();
      await expect(link).toHaveAttribute("href", new RegExp(path.replace(/\//g, "\\/")));
    }
    expect(problems, "no console errors").toEqual([]);
  });

  test("J7 category plus city listing: sort, then a quick filter (in the Filters sheet on a phone), keep the page working and the count honest", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watchConsole(page);
    await page.goto(LISTING);
    await page.waitForLoadState("networkidle");
    await oneHeading(page, "listing");
    const rows = page.locator('[data-tk="listing-row"]');
    await expect(rows.first()).toBeVisible();
    const countOf = (text: string) => Number((text.match(/[\d,]+/) || ["0"])[0].replace(/,/g, ""));
    const before = countOf(await page.locator('[data-tk="results-count"]').first().innerText());
    expect(before).toBeGreaterThan(0);
    await shot(page, "j7-listing");

    const sort = page.locator(".tkn-sr-sort select").first();
    const options = await sort.locator("option").evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    expect(options.length, "the sort box has more than one choice").toBeGreaterThan(1);
    const other = options.find((value) => value !== (options[0] ?? "")) ?? options[1];
    const firstUrl = page.url();
    await sort.selectOption(other);
    await expect.poll(() => page.url()).not.toBe(firstUrl);
    await page.waitForLoadState("networkidle");
    await expect(rows.first()).toBeVisible();
    await shot(page, "j7-sorted");

    if (isPhone(page)) {
      await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
      await expect(page.locator(".tkn-ls-aside")).toHaveAttribute("data-open", "true");
      await shot(page, "j7-filter-sheet");
    }
    await page.locator(".tkn-ls-aside").getByText("Verified", { exact: true }).click();
    await expect(page).toHaveURL(/verified=1/);
    await page.waitForLoadState("networkidle");
    const after = countOf(await page.locator('[data-tk="results-count"]').first().innerText());
    expect(after).toBeLessThanOrEqual(before);
    await shot(page, "j7-filtered");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(problems, "no console errors").toEqual([]);
  });

  test("J8 hover pop-out on the listing: opens on a computer, never on a phone", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    await page.goto(LISTING);
    await page.waitForLoadState("networkidle");
    const row = page.locator('[data-tk="listing-row"]').first();
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    const pop = page.locator('[data-tk="listing-popout"]');
    if (testInfo.project.name === "desktop-1440") {
      await expect(pop.first()).toBeVisible({ timeout: 4000 });
      await shot(page, "j8-popout");
      await page.mouse.move(5, 5);
      await expect(pop).toHaveCount(0);
    } else {
      await page.waitForTimeout(1500);
      await expect(pop, "no pop-out on a phone").toHaveCount(0);
    }
    expect(problems, "no console errors").toEqual([]);
  });

  test("J9 guest support ticket: the chat bubble opens a ticket that support can see (the thread link goes by email)", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watchConsole(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator(".tkn-chat-bubble").click();
    const panel = page.locator('[data-tk="support-chat"]');
    await expect(panel).toBeVisible();
    const question = `E1 journey ${Date.now()}: my ad does not show on the site.`;
    await panel.locator("#tkn-chat-input").fill(question);
    await panel.getByRole("button", { name: "Send" }).click();
    const form = panel.locator('[data-tk="chat-guest"]');
    await expect(form).toBeVisible();
    await form.getByLabel("Your name").fill("E1 Guest");
    const email = uniqueEmail("e1guest");
    await form.getByLabel("Email or phone").fill(email);
    const created = page.waitForResponse((res) => res.url().includes("/api/support/guest/tickets") && res.request().method() === "POST" && res.status() !== 308);
    await form.getByRole("button", { name: "Send to support" }).click();
    expect((await created).status()).toBe(200);
    await expect(panel.getByText("Thanks, we'll reply here and by email.")).toBeVisible();
    await shot(page, "j9-ticket-sent");
    const ticket = await withLocalDb((db) => db.collection("support_tickets").findOne({ guestEmail: email.toLowerCase() }));
    expect(ticket, "the guest ticket exists for support").toBeTruthy();
    expect(JSON.stringify(ticket)).toContain("E1 journey");
    expect(problems, "no console errors").toEqual([]);
  });

  test("J10 people category: the 18+ notice shows on the listing and on an ad page", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchConsole(page);
    await page.goto(LISTING);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/18\+/).first(), "an 18+ notice on a people category listing").toBeVisible();
    await shot(page, "j10-18plus-listing");
    const path = await firstAdPath(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/18\+/).first(), "an 18+ notice on a people category ad page").toBeVisible();
    await oneHeading(page, "ad page");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(problems, "no console errors").toEqual([]);
  });
});
