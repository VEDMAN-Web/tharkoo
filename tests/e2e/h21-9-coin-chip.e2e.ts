import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, grantCredits, isPhone, loginUi, newUserApi, test } from "./helpers";

/** H21.9: the header coin chip's accessible name starts with the text people see on it. */

const SHOTS = ".shots/H21.9";

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1440, height: 120 } });
}

test.describe("H21.9 header coin chip", () => {
  test("the chip name starts with its visible text and axe finds no label mismatch", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "chipname");
    await api.dispose();
    await loginUi(page, email);
    await grantCredits(page, 30);
    await page.goto("/");
    if (isPhone(page)) {
      await expect(page.locator("[data-tk=header-coins]")).toHaveCount(0);
      await shot(page, "header");
      return;
    }
    const chip = page.locator("[data-tk=header-coins]");
    await expect(chip).toBeVisible();
    const visible = ((await chip.innerText()) ?? "").replace(/\s+/g, " ").trim();
    const name = (await chip.getAttribute("aria-label")) ?? "";
    expect(name.toLowerCase().startsWith(visible.toLowerCase()), `"${name}" starts with "${visible}"`).toBe(true);
    const result = await new AxeBuilder({ page }).include(".tkn-coin-chip").withRules(["label-content-name-mismatch"]).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
    await shot(page, "header");
    // The Buy button in the tooltip still opens the recharge sheet.
    await chip.click();
    await expect(page.locator("[data-tk=header-coins-buy]")).toBeVisible();
  });
});
