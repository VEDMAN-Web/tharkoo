import type { Page } from "@playwright/test";
import { expect, PNG, signInAdminContext, test } from "./helpers";

const POLL = { timeout: 90_000, intervals: [3_000] };

function block(page: Page, type: string) {
  return page.locator("li.lay-block").filter({ has: page.locator(".lay-type", { hasText: new RegExp(`^${type}$`) }) });
}

async function publish(page: Page, note: string) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish" });
  await dialog.getByLabel("Note (optional)").fill(note);
  await dialog.getByRole("button", { name: "Publish now" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("6 Admin: home page editor", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
  });

  test("change hero text and image, reorder, hide, publish, see it on /, restore", async ({ page, request }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const heading = `E2E hero ${stamp}`;
    const alt = `E2E hero picture ${stamp}`;

    await page.goto("/admin/homepage/");
    await expect(page.locator("li.lay-block").first()).toBeVisible();
    const original = (await (await request.get("/")).text()).match(/<h1[^>]*>([^<]*)</)?.[1] ?? "";

    // A baseline version to restore later.
    await publish(page, "e2e baseline");
    await expect(page.getByText("Live page matches the saved draft")).toBeVisible();

    // Hero: new heading and a new image from the media library (uploaded in the picker).
    const hero = block(page, "hero");
    await hero.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Heading").first().fill(heading);
    await hero.getByRole("button", { name: /Choose image|Change image/ }).first().click();
    const picker = page.getByRole("dialog").last();
    await picker.getByRole("button", { name: "Upload new" }).click();
    await picker.locator("input[type=file]").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: PNG });
    await picker.getByLabel(/Alt text/).fill(alt);
    await picker.getByRole("button", { name: "Upload and use" }).click();
    await expect(page.getByText(alt).first()).toBeVisible();

    // Reorder: move the category cards above the hero. Hide: switch the hero's neighbour off, then on again.
    // Start from hero first, so the move below is a real change whatever an earlier run left behind.
    const order = async () => page.locator(".lay-block-title .lay-type").allTextContents();
    if ((await order()).indexOf("hero") > 0) await page.getByRole("button", { name: "Move Hero up" }).click();
    await page.getByRole("button", { name: "Move Category cards up" }).click();
    const titles = await page.locator(".lay-block-title .lay-type").allTextContents();
    expect(titles.indexOf("categoryGrid")).toBeLessThan(titles.indexOf("hero"));
    const cards = block(page, "categoryGrid");
    await cards.getByRole("switch", { name: "Visible" }).click();
    await expect(cards.locator(".lay-type", { hasText: "hidden" })).toBeVisible();
    await cards.getByRole("switch", { name: "Visible" }).click();
    await expect(cards.locator(".lay-type", { hasText: "hidden" })).toHaveCount(0);

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await publish(page, "e2e change");

    // Visible on the public home page.
    await expect
      .poll(async () => {
        const html = await (await request.get("/")).text();
        return html.includes(heading) && html.includes(alt);
      }, POLL)
      .toBe(true);

    // Restore the baseline: copy it into the draft and publish it again.
    await page.getByRole("button", { name: "Revisions" }).click();
    const drawer = page.getByRole("dialog", { name: "Revisions" });
    const baseline = drawer.locator("li.lay-rev").filter({ hasText: "e2e baseline" }).first();
    await baseline.getByRole("button", { name: "Restore" }).click();
    await baseline.getByRole("button", { name: /Yes, restore/ }).click();
    // Restore copies the version into the draft; the drawer may close itself.
    await page.waitForTimeout(500);
    if (await drawer.isVisible()) await drawer.getByRole("button", { name: "Close" }).click();
    await publish(page, "e2e restored");
    await expect
      .poll(async () => {
        const html = await (await request.get("/")).text();
        return !html.includes(heading);
      }, POLL)
      .toBe(true);
    const restored = (await (await request.get("/")).text()).match(/<h1[^>]*>([^<]*)</)?.[1] ?? "";
    expect(restored).toBe(original);
  });

  test("a hidden block is not on the public page", async ({ page, request }) => {
    test.setTimeout(240_000);
    await page.goto("/admin/homepage/");
    await publish(page, "e2e before hide");
    const cards = block(page, "categoryGrid");
    await cards.getByRole("switch", { name: "Visible" }).click();
    await publish(page, "e2e hidden cards");
    await expect.poll(async () => ((await (await request.get("/")).text()).match(/data-tk="home-card"/g) || []).length, POLL).toBe(0);
    await cards.getByRole("switch", { name: "Visible" }).click();
    await publish(page, "e2e cards back");
    await expect.poll(async () => ((await (await request.get("/")).text()).match(/data-tk="home-card"/g) || []).length, POLL).toBeGreaterThan(0);
  });
});
