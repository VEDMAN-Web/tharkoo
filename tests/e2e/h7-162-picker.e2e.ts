import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.162: the shared picture pop-up. Opened here from the default social share image on SEO settings. */

const SHOTS = process.env.H7162_SHOTS ?? "";
const TAG = `h7162-${Date.now() % 100000}`;
const PICTURES = Array.from({ length: 9 }, (_, index) => ({
  alt: `${TAG} picture ${index + 1} with a long description that must stay on one line`,
  url: `/placeholders/${index % 2 ? "dating" : "buy-and-sell"}/0${(index % 3) + 1}.webp`,
}));

async function seed() {
  const done = await withLocalDb(async (db) => {
    for (const [index, picture] of PICTURES.entries()) {
      await db.collection("site_media").insertOne({ url: picture.url, objectKey: `${TAG}-${index}`, alt: picture.alt, width: 1200, height: 800, bytes: 90_000, contentType: "image/webp", tags: [TAG], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() });
    }
    return true;
  });
  expect(done, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

async function openPicker(page: Page) {
  await page.goto("/admin/seo/settings/");
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: /Choose image|Change image/ }).last();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe("H7.162 picture pop-up", () => {
  test.beforeAll(async () => {
    await seed();
  });

  test("library: plain 3:2 tiles in 4, 3 or 2 columns, one line of description, Used hint, sticky top, 80vh at most", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const { dialog } = await openPicker(page);
    await expect(dialog.getByRole("heading", { name: "Choose a picture for: Default social share image" })).toBeVisible();
    await dialog.getByLabel("Search images").fill(TAG);
    const tiles = dialog.locator(".adm-pk-tile");
    await expect(tiles).toHaveCount(PICTURES.length);

    const viewport = page.viewportSize()!;
    const columns = viewport.width >= 1024 ? 4 : viewport.width >= 640 ? 3 : 2;
    const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.filter((box) => box.top === boxes[0].top).map((box) => Math.round(box.left))).size).toBe(columns);
    const thumb = (await tiles.first().locator(".adm-pk-thumb").boundingBox())!;
    expect(thumb.width / thumb.height).toBeGreaterThan(1.45);
    expect(thumb.width / thumb.height).toBeLessThan(1.55);
    expect(thumb.height).toBeGreaterThan(50);
    expect(await tiles.first().locator(".adm-pk-desc").evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
    await expect(tiles.first().locator(".adm-pk-used")).toHaveText("Not used");

    const panel = (await dialog.boundingBox())!;
    expect(panel.height).toBeLessThanOrEqual(viewport.height * 0.8 + 1);
    await shot(page, "picker-library");
    const top = dialog.locator(".adm-pk-top");
    const before = (await top.boundingBox())!.y;
    await dialog.locator(".adm-pk-body").evaluate((node) => node.scrollTo(0, node.scrollHeight));
    expect((await top.boundingBox())!.y).toBe(before);

    const serious = (await new AxeBuilder({ page }).include('[data-tk="picker"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("Tab stays inside, Esc closes and focus goes back to the button", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const { trigger, dialog } = await openPicker(page);
    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("choosing a tile uses it, and it is marked as the chosen one when the pop-up opens again", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const { dialog } = await openPicker(page);
    await dialog.getByLabel("Search images").fill(TAG);
    await dialog.getByTitle(PICTURES[2].alt).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change image" }).last()).toBeVisible();
    await page.getByRole("button", { name: "Change image" }).last().click();
    await page.getByRole("dialog").getByLabel("Search images").fill(TAG);
    await expect(page.getByRole("dialog").getByTitle(PICTURES[2].alt)).toHaveAttribute("aria-pressed", "true");
  });

  test("upload tab: drop zone, preview with name, size and rule, description box, button waits for both", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const { dialog } = await openPicker(page);
    await dialog.getByRole("tab", { name: "Upload new" }).click();
    await expect(dialog.getByText("Drag a picture here, or click to choose")).toBeVisible();
    await expect(dialog.locator('[data-tk="picker-rule"]')).toContainText("up to 8 MB");
    const upload = dialog.getByRole("button", { name: "Upload and use" });
    await expect(upload).toBeDisabled();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==", "base64");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "kitchen.png", mimeType: "image/png", buffer: png });
    const chosen = dialog.locator('[data-tk="picker-chosen"]');
    await expect(chosen).toContainText("kitchen.png");
    await expect(chosen).toContainText("1 KB");
    await expect(chosen.locator("img")).toBeVisible();
    const alt = dialog.getByLabel(/^Describe the picture/);
    await expect(alt).toHaveAttribute("placeholder", /^For example/);
    await expect(upload).toBeDisabled();
    await alt.fill("A kitchen with a green door");
    await expect(upload).toBeEnabled();
    await shot(page, "picker-upload");
    const serious = (await new AxeBuilder({ page }).include('[data-tk="picker"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("a file of the wrong type is refused with the reason", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const { dialog } = await openPicker(page);
    await dialog.getByRole("tab", { name: "Upload new" }).click();
    await dialog.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(dialog.getByRole("alert")).toContainText("JPG, PNG or WEBP");
    await expect(dialog.getByRole("button", { name: "Upload and use" })).toBeDisabled();
  });
});
