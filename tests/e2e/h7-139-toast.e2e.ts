import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, newUserApi, signInAdminContext, test } from "./helpers";

/** H7.139: the admin undo toast never covers the drawer's sticky footer buttons. */

const SHOTS = process.env.H139_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

test("the undo toast sits above the drawer footer on a phone and beside the drawer on a desktop", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const { api, email } = await newUserApi(baseURL!, "h139");
  await api.dispose();
  const staff = await browser.newContext({ baseURL });
  const page = await staff.newPage();
  await signInAdminContext(staff, baseURL!);
  await page.goto(`/admin/users/?q=${encodeURIComponent(email)}`);
  await page.locator("[data-tk=server-table] tbody tr").first().locator(".adm-k-rowlink").click();
  const drawer = page.locator("[data-tk=drawer]");
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "Add or remove credits" }).click();
  const dialog = page.locator("[data-tk=reason-dialog]");
  await dialog.getByLabel("Number of credits").fill("5");
  await dialog.getByLabel("Goodwill").check();
  await dialog.getByRole("button", { name: "Add credits" }).last().click();
  const toast = page.locator("[data-tk=toast]");
  await expect(toast).toContainText("Added 5 credits to");
  await page.waitForTimeout(300);

  const toastBox = (await toast.boundingBox())!;
  const footerBox = (await drawer.locator(".adm-k-df").boundingBox())!;
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  if (phone) {
    expect(toastBox.y + toastBox.height, `toast bottom ${toastBox.y + toastBox.height} is above the footer top ${footerBox.y}`).toBeLessThanOrEqual(footerBox.y);
  } else {
    const overlap = toastBox.x < footerBox.x + footerBox.width && toastBox.x + toastBox.width > footerBox.x && toastBox.y < footerBox.y + footerBox.height && toastBox.y + toastBox.height > footerBox.y;
    expect(overlap).toBe(false);
  }
  for (const button of await drawer.locator(".adm-k-df button").all()) {
    const box = (await button.boundingBox())!;
    const hidden = box.x < toastBox.x + toastBox.width && box.x + box.width > toastBox.x && box.y < toastBox.y + toastBox.height && box.y + box.height > toastBox.y;
    expect(hidden, `a footer button is covered by the toast`).toBe(false);
  }
  await shot(page, "h7-139-toast");
  await staff.close();
});
