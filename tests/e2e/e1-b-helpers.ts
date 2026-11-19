import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test as base } from "./helpers";

/**
 * E1-B: every journey runs with a watcher for script errors and console errors (a refused sign-in, a missing page and
 * a rate limit are answers the journeys make on purpose and do not count), and ends with `finalChecks`.
 */
export const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/Failed to load resource.*\b(400|401|403|404|409|410|429)\b/.test(text)) return;
        problems.push(`console: ${text.slice(0, 200)}`);
      });
      await use(problems);
      expect(problems, "no script or console errors during the journey").toEqual([]);
    },
    { auto: true },
  ],
});

/** One h1, no sideways scroll, and no serious or critical accessibility problem on the page the journey ends on. */
export async function finalChecks(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await hasHorizontalScroll(page), "no sideways scroll").toBe(false);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

export { expect };
