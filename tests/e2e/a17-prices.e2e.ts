import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, setRoles, signInAdminContext, test } from "./helpers";

/** H8.17 (A17): Prices & plans, part 1. */

const SHOTS = process.env.A17_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

async function publicProducts(page: Page): Promise<{ code: string; amount: number }[]> {
  const res = await page.request.get("/api/promotions/products");
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.products ?? body.data?.products ?? [];
}

const row = (page: Page, code: string) => page.locator(`[data-tk="plan-row"][data-code="${code}"]`);

test.describe("H8.17 Prices & plans", () => {
  test("an admin changes the Bump price, buyers see it at once, and Undo puts it back", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/prices/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Prices & plans" })).toBeVisible();
    await expect(page.locator("[data-tk=plans-table]")).toBeVisible();
    await expect(row(page, "bump")).toContainText("49 credits");
    await expect(row(page, "bump")).toContainText("about ₹490");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a17-prices");

    await row(page, "bump").getByRole("button", { name: "Edit" }).click();
    const drawer = page.locator("[data-tk=drawer]");
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Price (credits)").fill("abc");
    await drawer.getByRole("button", { name: "Save plan" }).click();
    await expect(drawer.getByRole("alert")).toContainText("whole number of credits");
    await drawer.getByLabel("Price (credits)").fill("59");
    await expect(drawer.getByText("about ₹590")).toBeVisible();
    await shot(page, "a17-plan-drawer", false);
    await drawer.getByRole("button", { name: "Save plan" }).click();

    const toast = page.locator("[data-tk=toast]");
    await expect(toast).toHaveAttribute("data-kind", "undo");
    await expect(toast).toContainText("Bump saved.");
    await expect(row(page, "bump")).toContainText("59 credits");
    expect((await publicProducts(page)).find((item) => item.code === "bump")?.amount).toBe(59);
    await shot(page, "a17-plan-saved");

    await toast.locator("[data-tk=toast-undo]").click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Change undone.");
    await expect(row(page, "bump")).toContainText("49 credits");
    expect((await publicProducts(page)).find((item) => item.code === "bump")?.amount).toBe(49);
    await staff.close();
  });

  test("Move up and Move down reorder the plans for buyers too, and Undo restores the order", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/prices/");
    const codes = async () => page.locator('[data-tk="plan-row"]').evaluateAll((rows) => rows.map((item) => item.getAttribute("data-code")));
    const before = await codes();
    expect(before.length).toBeGreaterThan(2);
    const target = before[1] as string;
    await page.getByRole("button", { name: new RegExp(`^Move .* up$`) }).nth(1).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("moved up");
    await expect.poll(codes).toEqual([target, ...before.filter((code) => code !== target)]);
    expect((await publicProducts(page)).map((item) => item.code).indexOf(target)).toBe(0);
    await page.locator("[data-tk=toast] [data-tk=toast-undo]").click();
    await expect.poll(codes).toEqual(before);
    await staff.close();
  });

  test("the test payments switch asks to confirm when turned off, and shows the figure honestly", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/prices/");
    const money = page.locator("[data-tk=money-settings]");
    await expect(page.locator("[data-tk=prices-screen]").getByText("Test payments are ON.")).toBeVisible();
    await money.getByRole("switch", { name: "Test payments: On" }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await expect(dialog.getByRole("heading", { name: "Turn off test payments?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(money.getByRole("switch", { name: "Test payments: On" })).toHaveAttribute("aria-checked", "true");
    await money.getByLabel("Posting fee (credits)").fill("x");
    await money.getByRole("button", { name: "Save changes" }).click();
    await expect(money.getByRole("alert")).toContainText("whole number of credits");
    await page.goto("/admin/settings/money/");
    await expect(page.getByRole("link", { name: "Open Prices & plans" })).toBeVisible();
    await staff.close();
  });

  test("finance can look but not change", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const { api, email } = await newUserApi(baseURL!, "a17fin");
    await api.dispose();
    expect(await setRoles(email, ["finance"])).toBe(true);
    await loginUi(page, email, undefined, "/admin/prices/");
    await expect(page.getByRole("heading", { level: 1, name: "Prices & plans" })).toBeVisible();
    await expect(page.getByText("only admins can change them")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.locator("[data-tk=money-settings]").getByRole("switch").first()).toBeDisabled();

  });
});
