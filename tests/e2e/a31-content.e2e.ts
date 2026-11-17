import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, setRoles, signInAdminContext, test } from "./helpers";

/** H8.31 (A31): the content studio editor. Create a post, write, save the draft, search panel, address change, publish. */

const SHOTS = process.env.A31_SHOTS ?? "";

async function shot(page: Page, name: string, fullPage = true) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage });
}

const stamp = () => `${Date.now()}`.slice(-7);

async function startPost(page: Page, title: string) {
  await page.getByRole("button", { name: "New post" }).click();
  const drawer = page.locator("[data-tk=drawer]");
  await drawer.getByLabel(/^Title/).fill(title);
  await drawer.getByRole("button", { name: "Start writing" }).click();
  await expect(page.locator("[data-tk=editor]")).toBeVisible();
}

test.describe("H8.31 content editor", () => {
  test("create a post, write with the toolbar, save the draft, fill the search panel, change the address, publish and take it off", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/content/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Content studio" })).toBeVisible();
    for (const tab of ["Blog", "Help"]) await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "a31-list-empty");

    const id = stamp();
    const first = `surat-flat-checklist-${id}`;
    const second = `${first}-b`;
    const title = `Renting a flat in Surat ${id}`;
    await startPost(page, title);
    await expect(page.locator("[data-tk=content-row]", { hasText: title })).toBeAttached();
    await page.getByLabel(/^Short summary/).fill("What to check before you pay a deposit: papers, the area, the owner and the money.");

    const toolbar = page.getByRole("toolbar", { name: "Text tools" });
    await toolbar.getByRole("button", { name: "Heading", exact: true }).click();
    await page.getByLabel("Heading 1", { exact: true }).fill("Before you visit");
    await toolbar.getByRole("button", { name: "Paragraph" }).click();
    const paragraph = page.getByLabel("Paragraph 2", { exact: true });
    await paragraph.fill("Make a short list of what you need: rent, deposit, floor, parking. Then look at the ads in Surat.");
    await paragraph.focus();
    await paragraph.selectText();
    await toolbar.getByRole("button", { name: "Bold" }).click();
    await expect(paragraph).toHaveValue(/^\*\*Make a short list/);
    await toolbar.getByRole("button", { name: "List" }).click();
    await page.getByLabel(/^List 3/).fill("Rent\nDeposit\nParking");
    await shot(page, "a31-editor");

    // Moving a block down and back, and removing one.
    await page.getByRole("button", { name: "Move heading 1 down" }).click();
    await expect(page.locator("[data-tk=body-node]").first()).toHaveAttribute("data-type", "p");
    await page.getByRole("button", { name: "Move heading 2 up" }).click();
    await expect(page.locator("[data-tk=body-node]").first()).toHaveAttribute("data-type", "h2");

    // The search panel.
    await page.getByLabel("SEO title").fill("Renting a flat in Surat: a simple checklist | Tharkoo");
    await expect(page.locator("[data-tk=seo-panel]")).toContainText("53 / 60");
    await page.getByLabel("Meta description").fill("What to check before you pay a deposit in Surat.");
    await expect(page.locator("[data-tk=seo-panel] .adm-serp").first()).toContainText("simple checklist");

    await expect(page.locator("[data-tk=save-state]")).toContainText("Unsaved changes");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Draft saved.");
    await expect(page.locator("[data-tk=save-state]")).toContainText("Draft saved");
    await page.reload();
    await expect(page.getByLabel(/^Short summary/)).toHaveValue(/^What to check/);
    await expect(page.getByLabel("Heading 1", { exact: true })).toHaveValue("Before you visit");
    await expect(page.getByLabel(/^List 3/)).toHaveValue("Rent\nDeposit\nParking");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);

    // Preview shows the text, with the bold mark drawn and no stray marks.
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator("[data-tk=preview]")).toContainText("Before you visit");
    await expect(page.locator("[data-tk=preview] strong")).toContainText("Make a short list");
    await shot(page, "a31-preview", false);
    await page.getByRole("button", { name: "Back to editing" }).click();

    // A bad link is refused with plain words (the address needs a scheme or a slash).
    await page.getByLabel("Paragraph 2", { exact: true }).fill("A bad one [click](javascript:alert(1)) here.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Draft saved.");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator("[data-tk=preview] a")).toHaveCount(0);
    await page.getByRole("button", { name: "Back to editing" }).click();

    // Change the address of a draft: no redirect is needed, the new address shows.
    await page.getByLabel("Web address").fill(first);
    await page.getByRole("button", { name: "Change address" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText(`/blog/${first}/`);

    // Publish, then Undo toast appears; change the address of the live post: the old address redirects.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Published");
    await expect(page.locator("[data-tk=publish-on]")).toContainText("Published on");
    await page.getByLabel("Web address").fill(second);
    await page.getByRole("button", { name: "Change address" }).click();
    await page.locator("[data-tk=reason-dialog]").getByRole("button", { name: "Change address" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText(`/blog/${second}/`);
    // The address table is cached for up to 15 seconds by the site's request filter, so the redirect may take a moment to apply.
    await expect
      .poll(async () => {
        const old = await page.request.get(`/blog/${first}/`, { maxRedirects: 0 });
        return `${old.status()} ${old.headers()["location"] ?? ""}`;
      }, { timeout: 30_000 })
      .toMatch(new RegExp(`^308 .*/blog/${second}/`));
    await shot(page, "a31-published");

    // Take it off the site and Undo it.
    await page.getByRole("button", { name: "Take off the site..." }).click();
    const dialog = page.locator("[data-tk=reason-dialog]");
    await dialog.getByLabel("Say the page is gone").check();
    await dialog.getByRole("button", { name: "Take off the site" }).last().click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("off the site");
    await expect(page.locator("[data-tk=editor]").getByText("Off the site").first()).toBeVisible();
    await staff.close();
  });

  test("the list filters by status and search, the phone shows one pane at a time, and a draft autosaves after 10 seconds", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/content/");
    const title = `Autosave test ${stamp()}`;
    await startPost(page, title);
    await page.getByLabel(/^Short summary/).fill("Typed and left alone.");
    await expect(page.locator("[data-tk=save-state]")).toContainText("Unsaved changes");
    await expect(page.locator("[data-tk=save-state]")).toContainText("Draft saved", { timeout: 20_000 });

    if (isPhone(page)) {
      await expect(page.locator("[data-tk=studio-list]")).toBeHidden();
      await page.getByRole("button", { name: /All blog posts/ }).click();
      await expect(page.locator("[data-tk=studio-list]")).toBeVisible();
    }
    await page.goto("/admin/content/?status=published");
    await expect(page.locator("[data-tk=content-row]", { hasText: title })).toHaveCount(0);
    await page.goto(`/admin/content/?status=draft&q=${encodeURIComponent("Autosave test")}`);
    await expect(page.locator("[data-tk=content-row]", { hasText: title })).toBeVisible();
    await page.goto("/admin/content/?q=zzzz-no-such-post");
    await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
    await staff.close();
  });

  test("a blog editor writes and saves but has no Publish button", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const member = await newUserApi(baseURL!, "a31blog");
    await member.api.dispose();
    expect(await setRoles(member.email, ["blog_editor"])).toBe(true);
    await loginUi(page, member.email, undefined, "/admin/content/");
    await expect(page.getByRole("heading", { level: 1, name: "Content studio" })).toBeVisible();
    await startPost(page, `Blog editor draft ${stamp()}`);
    await expect(page.locator("[data-tk=no-publish]")).toContainText("An editor or admin publishes this");
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
    await page.getByLabel(/^Short summary/).fill("A short summary.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("[data-tk=toast]").last()).toContainText("Draft saved.");
  });

  test("a support agent cannot open the content studio", async ({ page, baseURL }) => {
    const member = await newUserApi(baseURL!, "a31support");
    await member.api.dispose();
    expect(await setRoles(member.email, ["support"])).toBe(true);
    await loginUi(page, member.email, undefined, "/admin/");
    const response = await page.goto("/admin/content/");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
    await expect(page.locator("[data-tk=studio]")).toHaveCount(0);
  });
});
