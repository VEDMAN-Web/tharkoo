import { mkdirSync } from "node:fs";
import { withFooterAdmin } from "./footer-admin";
import { expect, hasHorizontalScroll, test } from "./helpers";

/**
 * H17.14a: Terms and Privacy show the approved text with an effective date, the footer has Terms / Privacy / Grievance Officer,
 * and the footer draws no WhatsApp or Telegram row (and no stand-in number) while the admin screen has none.
 * Set SHOTS_DIR to also save a screenshot of each page for the report.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: import("@playwright/test").Page, name: string, width: number) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${width}.png`, fullPage: true });
}

test.describe("H17.14a Terms and Privacy", () => {
  test("Terms: new title, effective date, approved sections, no old wording, no sideways scroll", async ({ page }) => {
    await page.goto("/terms/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Terms and Conditions");
    await expect(page.getByText("Effective date 19 November 2026")).toBeVisible();
    const doc = page.locator('[data-tk="legal-doc"]');
    await expect(doc.getByText("1. Who we are.")).toBeVisible();
    await expect(doc.getByText("17. General.")).toBeVisible();
    await expect(doc.locator("ol li")).toHaveCount(10);
    const text = await page.locator("main").innerText();
    for (const old of ["A free weekly limit applies", "Status of these terms", "Tharkoo is a classifieds board for people in India"]) expect(text).not.toContain(old);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "terms", page.viewportSize()?.width ?? 0);
  });

  test("Privacy: new title, effective date, headings, and the table scrolls in its own box without moving the page", async ({ page }) => {
    await page.goto("/privacy/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Privacy Policy");
    await expect(page.getByText("Effective date 19 November 2026")).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. What we collect" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Who sees your data" })).toBeVisible();
    const box = page.locator(".tkl-scroll");
    await expect(box).toHaveCount(1);
    await expect(box.locator("tbody tr")).toHaveCount(7);
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("Status of this note");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const fits = await box.evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth + 1);
    expect(fits, "the table box stays inside the screen").toBe(true);
    await shot(page, "privacy", page.viewportSize()?.width ?? 0);
  });
});

test.describe("H17.14a footer", () => {
  test("the bottom row has Terms, Privacy and Grievance Officer, each tappable and pointing at its page", async ({ page }) => {
    await page.goto("/");
    const legal = page.locator('[data-tk="footer"] nav[aria-label="Legal"]');
    const links = {
      "Terms and Conditions": "/terms/",
      "Privacy Policy": "/privacy/",
      "Grievance Officer": "/grievance/",
    };
    for (const [label, href] of Object.entries(links)) {
      const link = legal.getByRole("link", { name: label, exact: true });
      await expect(link, label).toBeVisible();
      await expect(link, label).toHaveAttribute("href", href);
      const box = await link.boundingBox();
      expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(24);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.locator('[data-tk="footer"]').scrollIntoViewIfNeeded();
    await shot(page, "footer", page.viewportSize()?.width ?? 0);
  });

  test("no WhatsApp or Telegram row or icon, and no stand-in number, while the admin screen has none", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-tk="footer"]');
    await expect(footer.locator(".tkn-contacts")).toContainText("Email");
    await expect(footer.locator(".tkn-contacts")).not.toContainText("WhatsApp");
    await expect(footer.locator(".tkn-contacts")).not.toContainText("Telegram");
    await expect(footer.getByLabel("Tharkoo on WhatsApp")).toHaveCount(0);
    await expect(footer.getByLabel("Tharkoo on Telegram")).toHaveCount(0);
    expect(await footer.innerText()).not.toContain("912345678");
  });

  test("/grievance-officer/ is a permanent redirect to the Grievance Officer page", async ({ request }) => {
    const response = await request.get("/grievance-officer/", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toMatch(/\/cms\/grievance\/$/);
  });
});

test.describe("H17.14a footer with admin values", () => {
  test("with a WhatsApp number and a Telegram handle on the admin screen, their rows and tiles show again", async ({ page }) => {
    await withFooterAdmin(page, "/", async () => {
      const footer = page.locator('[data-tk="footer"]');
      await expect(footer.getByRole("link", { name: /^WhatsApp/ }).first()).toHaveAttribute("href", /wa\.me\/919000011111/);
      await expect(footer.getByRole("link", { name: /^Telegram/ }).first()).toHaveAttribute("href", /t\.me\/tharkoo_test/);
      await expect(footer.locator(".tkn-contacts")).toContainText("+91 90000 11111");
    });
  });
});

test.describe("H17.14a tablet width", () => {
  test("Terms, Privacy and the footer fit at 768 px without sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const path of ["/terms/", "/privacy/"]) {
      await page.goto(path);
      expect(await hasHorizontalScroll(page), path).toBe(false);
      await shot(page, path.replaceAll("/", ""), 768);
    }
    await page.locator('[data-tk="footer"]').scrollIntoViewIfNeeded();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "footer", 768);
  });
});
