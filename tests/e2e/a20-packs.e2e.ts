import { mkdirSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, setRoles, signInAdminContext, test } from "./helpers";

/** H8.20 (A20): recharge packs and coupons on Prices & plans. */

const SHOTS = process.env.A20_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

/** How many packs people can buy right now (what the Recharge sheet offers). */
/** The server lives for both screen sizes, so each run uses its own numbers and code. */
const RUN = Date.now() % 100_000;
const PACK_CREDITS = 200 + (RUN % 700);
const PACK_EACH = (1000 / (PACK_CREDITS + 7)).toFixed(2);
const COUPON_CODE = `E2E-W${RUN}`;

async function offeredPacks(api: APIRequestContext): Promise<number> {
  const res = await api.get("/api/payments/packs");
  expect(res.status()).toBe(200);
  const body = await res.json();
  return (body.data ?? body).allPacks;
}

test.describe("H8.20 recharge packs and coupons", () => {
  test("add a pack (hidden at first), show it, see its price per credit, hide it again, and undo", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const user = await newUserApi(baseURL!, "a20pack");
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/prices/");
    await expect(page.locator("h1")).toHaveCount(1);
    const packs = page.locator("[data-tk=packs]");
    await expect(packs.getByRole("heading", { name: "Recharge packs" })).toBeVisible();
    const before = await offeredPacks(user.api);
    const rows = packs.locator("[data-tk=pack-row]");
    const count = await rows.count();
    expect(count).toBeGreaterThan(2);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "a20-packs");

    await packs.getByRole("button", { name: "New pack" }).click();
    const drawer = page.locator("[data-tk=drawer]");
    await drawer.locator("#pack-credits").fill("abc");
    await drawer.getByRole("button", { name: "Add pack" }).click();
    await expect(drawer.getByRole("alert")).toContainText("Credits is a whole number");
    await drawer.locator("#pack-credits").fill(String(PACK_CREDITS));
    await drawer.getByLabel("Free credits on top").fill("7");
    await drawer.getByLabel("Price (₹)").fill("1000");
    await expect(drawer.getByText(`₹${PACK_EACH} for each credit`)).toBeVisible();
    await shot(page, "a20-pack-drawer", false);
    await drawer.getByRole("button", { name: "Add pack" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Pack added.");
    const mine = rows.filter({ hasText: `${PACK_CREDITS} credits + 7 free` });
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText("₹1,000");
    await expect(mine).toContainText(`₹${PACK_EACH}`);
    await expect(mine).toContainText("Hidden");
    expect(await offeredPacks(user.api)).toBe(before);

    await mine.getByRole("button", { name: "Edit" }).click();
    await drawer.getByRole("switch").click();
    await drawer.getByRole("button", { name: "Save pack" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Pack saved.");
    await expect(mine).toContainText("Shown");
    expect(await offeredPacks(user.api)).toBe(before + 1);

    await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(mine).toContainText("Hidden");
    expect(await offeredPacks(user.api)).toBe(before);
    await user.api.dispose();
    await staff.close();
  });

  test("add a coupon in capitals, refuse a repeat and a blocked code, switch it off, and undo", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/prices/");
    const coupons = page.locator("[data-tk=coupons]");
    await expect(coupons.getByRole("heading", { name: "Coupons" })).toBeVisible();
    await shot(page, "a20-coupons");

    await coupons.getByRole("button", { name: "New coupon" }).click();
    const drawer = page.locator("[data-tk=drawer]");
    await drawer.getByLabel("Code").fill("no");
    await drawer.locator("#coupon-amount").fill("10");
    await drawer.getByRole("button", { name: "Add coupon" }).click();
    await expect(drawer.getByRole("alert")).toContainText("3 to 20 letters");
    await drawer.getByLabel("Code").fill(COUPON_CODE.toLowerCase());
    await drawer.getByLabel("Starts on").fill("2026-12-01");
    await drawer.getByLabel("Ends on").fill("2026-11-01");
    await drawer.getByRole("button", { name: "Add coupon" }).click();
    await expect(drawer.getByRole("alert")).toContainText("The end must be after the start.");
    await drawer.getByLabel("Ends on").fill("2026-12-31");
    await drawer.getByLabel("Most times it can be used").fill("50");
    await shot(page, "a20-coupon-drawer", false);
    await drawer.getByRole("button", { name: "Add coupon" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText(`Coupon ${COUPON_CODE} added.`);
    const row = coupons.locator(`[data-tk=coupon-row][data-code="${COUPON_CODE}"]`);
    await expect(row).toContainText("10% off");
    await expect(row).toContainText("1 Dec 2026 to 31 Dec 2026");
    await expect(row).toContainText("0 of 50 used, 1 each");
    await expect(row).toContainText("On");

    await coupons.getByRole("button", { name: "New coupon" }).click();
    await drawer.getByLabel("Code").fill(COUPON_CODE.replace("E2E-W", "E2E-w"));
    await drawer.locator("#coupon-amount").fill("5");
    await drawer.getByRole("button", { name: "Add coupon" }).click();
    await expect(drawer.getByRole("alert")).toContainText("already exists");
    await drawer.getByRole("button", { name: "Cancel" }).click();

    await row.getByRole("button", { name: "Edit" }).click();
    await expect(drawer.getByLabel("Code")).toHaveCount(0);
    await drawer.getByRole("switch").click();
    await drawer.getByRole("button", { name: "Save coupon" }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("saved.");
    await expect(row).toContainText("Off");
    await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(row).toContainText("On");
    await staff.close();
  });

  test("finance can look at packs and coupons but has no Edit, New pack or New coupon", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "a20fin");
    await api.dispose();
    expect(await setRoles(email, ["finance"])).toBe(true);
    await loginUi(page, email, undefined, "/admin/prices/");
    await expect(page.locator("[data-tk=packs]")).toBeVisible();
    await expect(page.locator("[data-tk=coupons]")).toBeVisible();
    await expect(page.getByRole("button", { name: "New pack" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New coupon" })).toHaveCount(0);
    await expect(page.locator("[data-tk=packs]").getByRole("button", { name: "Edit" })).toHaveCount(0);
  });
});
