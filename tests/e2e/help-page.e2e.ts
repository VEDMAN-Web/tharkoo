import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

test.describe("H7.71 help page", () => {
  test("the popular list and the contact card start on the same line, headings are bold", async ({ page }) => {
    await page.goto("/help/");
    const list = page.locator(".h714-help-list");
    const card = page.locator(".h714-help-card");
    await expect(list).toBeVisible();
    await expect(card).toBeVisible();
    const listBox = (await list.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    if (isPhone(page)) {
      expect(cardBox.y).toBeGreaterThan(listBox.y + listBox.height - 1);
      expect(Math.round(listBox.width)).toBe(Math.round(cardBox.width));
    } else {
      expect(Math.abs(listBox.y - cardBox.y)).toBeLessThanOrEqual(1);
      expect(listBox.width / cardBox.width).toBeGreaterThan(1.8);
      expect(listBox.width / cardBox.width).toBeLessThan(2.2);
    }
    const heading = page.getByRole("heading", { name: "Popular articles" });
    expect(await heading.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
    const team = page.getByRole("heading", { name: "Talk to our team" });
    expect(await team.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
    const headingBox = (await heading.boundingBox())!;
    expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(listBox.y);
  });

  test("the contact card has three full-width buttons and a ghost link, with the honest support hours", async ({ page }) => {
    await page.goto("/help/");
    const card = page.locator(".h714-help-card");
    await expect(card).toContainText("Support hours 9 am to 9 pm. We reply by chat or email.");
    await expect(card).not.toContainText("10 minutes");
    const cardBox = (await card.boundingBox())!;
    for (const name of ["Chat with us", "WhatsApp", "Telegram", "Send us a message"]) {
      const button = card.getByRole("link", { name });
      const box = (await button.boundingBox())!;
      expect(box.height, `${name} is 52 px`).toBeGreaterThanOrEqual(52);
      expect(box.width, `${name} is full width`).toBeGreaterThan(cardBox.width - 52);
    }
    const wa = card.getByRole("link", { name: "WhatsApp" });
    await expect(wa.locator("svg")).toHaveCount(1);
    const style = await wa.evaluate((node) => {
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, border: css.borderTopColor, width: css.borderTopWidth, color: css.color };
    });
    expect(style.background).toBe("rgb(255, 255, 255)");
    expect(style.border).toBe("rgb(37, 211, 102)");
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(1);
    expect(await card.getByRole("link").last().innerText()).toBe("Send us a message");
  });

  test("hovering WhatsApp fills the button green with white text", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "hover needs a pointer");
    await page.goto("/help/");
    const wa = page.locator(".h714-help-card").getByRole("link", { name: "WhatsApp" });
    await wa.hover();
    await expect.poll(() => wa.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(21, 128, 61)");
    expect(await wa.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 255, 255)");
  });

  test("every article row is at least 44 px tall and nothing scrolls sideways", async ({ page }) => {
    await page.goto("/help/");
    const heights = await page.locator(".h714-help-list a").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the help page passes axe with no serious or critical issues", async ({ page }) => {
    await page.goto("/help/");
    const result = await new AxeBuilder({ page }).include(".h714-help").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });
});
