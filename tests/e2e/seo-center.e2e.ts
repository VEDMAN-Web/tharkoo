import { expect, signInAdminContext, test } from "./helpers";

const POLL = { timeout: 90_000, intervals: [3_000] };
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";

test.describe("7 SEO center", () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    // Remove and Delete ask the browser to confirm; accept so the cleanup really happens.
    page.on("dialog", (dialog) => void dialog.accept());
    await signInAdminContext(context, baseURL!);
  });

  test("run the SEO check, then read the issues table", async ({ page }) => {
    test.setTimeout(330_000);
    await page.goto("/admin/seo/");
    await expect(page.getByRole("button", { name: /Run SEO check now/ })).toBeVisible();
    const waiting = await page.getByText(/A check ran in the last 10 minutes/).count();
    if (!waiting) {
      await page.getByRole("button", { name: /Run SEO check now/ }).click();
      await expect(page.getByText(/^Done\. \d+ pages with P0 issues/)).toBeVisible({ timeout: 300_000 });
    }
    await expect(page.getByText("Pages in sitemap")).toBeVisible();
    await expect(page.getByText("Pages with P0 issues", { exact: true })).toBeVisible();

    await page.locator("a[href=\"/admin/seo/pages/\"]").first().click();
    await expect(page).toHaveURL(/\/admin\/seo\/pages\//);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("changing a template changes the page titles", async ({ page, request }) => {
    test.setTimeout(240_000);
    const marker = `E2E${Date.now() % 100000}`;
    const title = `${marker} {category} ads in {city} | {site}`;
    await page.goto("/admin/seo/templates/");
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ label: "Category hub" });
    await selects.nth(1).selectOption({ label: "Dating only" });
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Description", { exact: true }).fill(`Browse {category} notices in {city} on {site}. Updated daily with clear photos and honest details.`);
    await page.getByRole("button", { name: /Save/ }).first().click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
    await expect.poll(async () => titleOf(await (await request.get("/dating/")).text()), POLL).toContain(marker);

    await page.getByRole("button", { name: "Delete this category template" }).click();
    await expect.poll(async () => titleOf(await (await request.get("/dating/")).text()), POLL).not.toContain(marker);
  });

  test("a per-URL override wins over the template", async ({ page, request }) => {
    test.setTimeout(240_000);
    const marker = `E2E override ${Date.now() % 100000}`;
    await page.goto("/admin/urls/");
    await page.getByLabel("Page address").fill("/dating/mumbai/");
    await page.getByLabel("Title", { exact: true }).fill(`${marker} for dating in Mumbai | Tharkoo`);
    await page.getByLabel("Description", { exact: true }).fill("An e2e check description that is long enough to pass the length rule for search results pages.");
    await page.getByRole("button", { name: "Save override" }).click();
    await expect.poll(async () => titleOf(await (await request.get("/dating/mumbai/")).text()), POLL).toContain(marker);

    const row = page.locator("li").filter({ hasText: "/dating/mumbai/" }).first();
    await row.getByRole("button", { name: "Remove" }).click();
    await expect.poll(async () => titleOf(await (await request.get("/dating/mumbai/")).text()), POLL).not.toContain(marker);
  });

  test("an override can set noindex on one page", async ({ page, request }) => {
    test.setTimeout(240_000);
    await page.goto("/admin/urls/");
    await page.getByLabel("Page address").fill("/wellness/delhi/");
    await page.locator("select").filter({ hasText: "Hide from search" }).selectOption({ label: "Hide from search (noindex)" });
    await page.getByRole("button", { name: "Save override" }).click();
    await expect
      .poll(async () => /<meta name="robots" content="[^"]*noindex/.test(await (await request.get("/wellness/delhi/")).text()), POLL)
      .toBe(true);
    await page.locator("li").filter({ hasText: "/wellness/delhi/" }).first().getByRole("button", { name: "Remove" }).click();
  });

  test("redirects and the 404 monitor", async ({ request }) => {
    test.fixme(true, "BUG 7 SEO: /admin/redirects/ is a 404 (Redirects & 404s tab not on main; H4.6 PR open).");
    expect((await request.get("/admin/redirects/")).status()).toBe(200);
  });

  test("indexing toggle for a city: noindex and out of the sitemap", async ({ request }) => {
    test.fixme(true, "BUG 7 SEO: /admin/indexing/ is a 404 (Indexing rules tab not on main; H4.6/H4.7 PR open).");
    expect((await request.get("/admin/indexing/")).status()).toBe(200);
  });

  test("robots and llms settings", async ({ request }) => {
    test.fixme(true, "BUG 7 SEO: /admin/robots/ is a 404 (robots, llms & schema tab not on main; H4.7 PR open).");
    expect((await request.get("/admin/robots/")).status()).toBe(200);
  });
});
