import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, freshIp, hasHorizontalScroll, isPhone, signInAdminContext, test } from "./helpers";

const DAYTIME = new Date("2026-11-16T12:00:00+05:30");
const NIGHT = new Date("2026-11-16T03:00:00+05:30");
const unique = (name: string) => `${name}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;

async function openChat(page: Page, at: Date = DAYTIME) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshIp() });
  await page.clock.setFixedTime(at);
  await page.goto("/");
  await page.locator(".tkn-chat-bubble").click();
  const panel = page.locator('[data-tk="support-chat"]');
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("H7.64 support chat", () => {
  test("the status follows the support hours and never claims online at night", async ({ page }) => {
    let panel = await openChat(page, DAYTIME);
    await expect(panel.locator('[data-tk="chat-status"]')).toHaveText("Online now · usually replies in minutes");
    await expect(panel.locator('[data-tk="chat-status"]')).toHaveAttribute("data-online", "yes");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.clock.setFixedTime(NIGHT);
    await page.locator(".tkn-chat-bubble").click();
    panel = page.locator('[data-tk="support-chat"]');
    await expect(panel.locator('[data-tk="chat-status"]')).toHaveText("We're offline · we reply from 9 am");
    await expect(panel.locator('[data-tk="chat-status"]')).toHaveAttribute("data-online", "no");
  });

  test("a quick reply is sent as a message and shows help articles and Talk to a person", async ({ page }) => {
    const panel = await openChat(page);
    await expect(panel.locator("#tkn-chat-input")).toBeVisible();
    await expect(panel.locator('[data-tk="chat-guest"]')).toHaveCount(0);
    await panel.getByRole("button", { name: "Help with my ad" }).click();
    await expect(panel.locator(".tkn-bubble-you", { hasText: "Help with my ad" })).toBeVisible();
    const cards = panel.locator('[data-tk="chat-articles"] .tkn-art');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThanOrEqual(3);
    await expect(panel.locator('[data-tk="chat-talk"]')).toBeVisible();
    await expect(panel.locator('[data-tk="chat-guest"]')).toHaveCount(0);
  });

  test("Talk to a person asks for a name and an email under the message and opens one ticket", async ({ page }) => {
    const panel = await openChat(page);
    await panel.getByRole("button", { name: "Report a problem" }).click();
    await panel.locator('[data-tk="chat-talk"]').click();
    const form = panel.locator('[data-tk="chat-guest"]');
    await expect(form).toBeVisible();
    await form.getByLabel("Your name").fill("Asha");
    const asha = unique("asha");
    await form.getByLabel("Email or phone").fill(asha);
    const created = page.waitForResponse((res) => res.url().includes("/api/support/guest/tickets") && res.request().method() === "POST" && res.status() !== 308);
    await form.getByRole("button", { name: "Send to support" }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ name: "Asha", email: asha, topic: "report_problem" });
    await expect(panel.getByText("Thanks, we'll reply here and by email.")).toBeVisible();
    await expect(form).toHaveCount(0);
  });

  test("a typed question asks for contact details, then creates the ticket", async ({ page }) => {
    const panel = await openChat(page);
    await panel.locator("#tkn-chat-input").fill("How do I renew my ad after 72 hours?");
    await panel.getByRole("button", { name: "Send" }).click();
    await expect(panel.locator(".tkn-bubble-you", { hasText: "How do I renew my ad" })).toBeVisible();
    const form = panel.locator('[data-tk="chat-guest"]');
    await expect(form).toBeVisible();
    await form.getByLabel("Your name").fill("Ravi");
    await form.getByLabel("Email or phone").fill(unique("ravi"));
    const created = page.waitForResponse((res) => res.url().includes("/api/support/guest/tickets") && res.request().method() === "POST" && res.status() !== 308);
    await form.getByRole("button", { name: "Send to support" }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().body).toContain("How do I renew my ad after 72 hours?");
    await expect(panel.getByText("Thanks, we'll reply here and by email.")).toBeVisible();
  });

  test("a signed-in visitor opens the ticket straight from Talk to a person, with no contact form", async ({ page, context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
    await context.addCookies([{ name: "tk-in", value: "1", url: baseURL! }]);
    const panel = await openChat(page);
    await panel.getByRole("button", { name: "Coins and payments" }).click();
    await expect(panel.locator('[data-tk="chat-talk"]')).toBeVisible();
    const created = page.waitForResponse((res) => res.url().includes("/api/support/tickets") && res.request().method() === "POST" && res.status() !== 308);
    await panel.locator('[data-tk="chat-talk"]').click();
    const response = await created;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ body: "Coins and payments" });
    await expect(panel.getByText("Thanks, we'll reply here and by email.")).toBeVisible();
    await expect(panel.locator('[data-tk="chat-guest"]')).toHaveCount(0);
  });

  test("the panel sits clear of the header and the up-arrow hides while it is open", async ({ page }) => {
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 700 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(page.locator(".tkn-top")).toBeVisible();
    await page.locator(".tkn-chat-bubble").click();
    const panel = page.locator('[data-tk="support-chat"]');
    await expect(panel).toBeVisible();
    await expect(page.locator(".tkn-top")).toHaveCount(0);
    const box = (await panel.boundingBox())!;
    const view = page.viewportSize()!;
    const header = (await page.locator(".tkn-header").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    if (isPhone(page)) {
      expect(box.x).toBe(0);
      expect(Math.round(box.width)).toBe(view.width);
      expect(Math.round(box.y + box.height)).toBe(view.height);
    } else {
      expect(Math.round(box.width)).toBe(380);
      expect(box.height).toBeLessThanOrEqual(620);
    }
    const close = (await panel.getByRole("button", { name: "Close chat" }).boundingBox())!;
    expect(close.width).toBeGreaterThanOrEqual(isPhone(page) ? 44 : 40);
    expect(close.height).toBeGreaterThanOrEqual(isPhone(page) ? 44 : 40);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("on a phone the sheet never covers the site header, even at the top of Home with the contact form open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone-390", "phones only");
    const panel = await openChat(page);
    await panel.getByRole("button", { name: "Help with my ad" }).click();
    await expect(panel.locator('[data-tk="chat-articles"] .tkn-art').first()).toBeVisible();
    await panel.locator("#tkn-chat-input").fill("How do I renew my ad after 72 hours?");
    await panel.getByRole("button", { name: "Send" }).click();
    await expect(panel.locator('[data-tk="chat-guest"]')).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const box = (await panel.boundingBox())!;
    const header = (await page.locator(".tkn-header").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
    await expect(panel.locator(".tkn-chat-body")).toHaveCSS("overflow-y", "auto");
  });

  test("the open panel passes axe with no serious or critical issues", async ({ page }) => {
    await openChat(page);
    await page.locator('[data-tk="support-chat"]').getByRole("button", { name: "Help with my ad" }).click();
    await expect(page.locator('[data-tk="chat-articles"] .tkn-art').first()).toBeVisible();
    const result = await new AxeBuilder({ page }).include('[data-tk="support-chat"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });
});
