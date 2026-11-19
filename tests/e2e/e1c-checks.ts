import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll } from "./helpers";

/** E1-C: the checks every admin journey makes on each page it lands on (Opus E1 plan: console, h1, scroll, a11y). */

const IGNORED = [/Failed to load resource.*(403|404|410)/i, /favicon/i, /ERR_BLOCKED_BY_CLIENT/i];

export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 200)}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!IGNORED.some((pattern) => pattern.test(text))) errors.push(`console: ${text.slice(0, 200)}`);
  });
  return errors;
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** What is wrong with the page: not exactly one h1, sideways scroll, serious accessibility problems. Empty means healthy. */
export async function pageProblems(page: Page, label: string, withAxe = true): Promise<string[]> {
  const problems: string[] = [];
  const h1 = await page.locator("h1").count();
  if (h1 !== 1) problems.push(`${label}: ${h1} h1 headings`);
  if (await hasHorizontalScroll(page)) problems.push(`${label}: sideways scroll`);
  if (withAxe) for (const item of await serious(page)) problems.push(`${label}: a11y ${item}`);
  return problems;
}

/** One <h1>, no sideways scroll, no serious accessibility problem. */
export async function expectPageHealthy(page: Page, label: string) {
  expect(await pageProblems(page, label), `${label}: page health`).toEqual([]);
}
