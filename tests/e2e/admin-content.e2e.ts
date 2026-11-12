import { createLiveAd } from "./flows";
import { expect, signInAdminContext, test } from "./helpers";

const POLL = { timeout: 90_000, intervals: [3_000] };

test.describe("6 Admin: content screens", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAdminContext(context, baseURL!);
  });

  test("UI text: edit a label, see it on the listing page, reset it", async ({ page, request }) => {
    test.setTimeout(200_000);
    const key = "listing.filters.verified";
    const text = `Verified e2e ${Date.now() % 100000}`;
    await page.goto("/admin/ui-text/");
    const field = page.getByLabel(key, { exact: true });
    await expect(field).toBeVisible();
    await field.fill(text);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Saved 1 text/)).toBeVisible();
    await expect.poll(async () => (await (await request.get("/dating/bengaluru/")).text()).includes(text), POLL).toBe(true);

    await field.locator("xpath=ancestor::div[contains(@style, \"display:grid\")][1]").getByRole("button", { name: "Reset to default" }).click();
    await expect(page.getByText("Back to the default text.")).toBeVisible();
    await expect.poll(async () => (await (await request.get("/dating/bengaluru/")).text()).includes(text), POLL).toBe(false);
  });

  test("post-ad page labels: a step title can be edited and the editor opens", async ({ page }) => {
    await page.goto("/admin/post-page/");
    const steps = page.locator("li.lay-block").filter({ has: page.locator(".lay-type", { hasText: /^postStep$/ }) });
    await expect(steps).toHaveCount(6);
    await steps.first().getByRole("button", { name: "Edit", exact: true }).click();
    await expect(steps.first().locator(".lay-block-body input[type=text], .lay-block-body input:not([type])").first()).toBeVisible();
    // Required steps cannot be deleted.
    await expect(steps.first().getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  test("listing pages editor", async ({ page }) => {
    test.fixme(true, "BUG 6 Admin: /admin/listing-pages/ is a 404 (nav says soon H3.5); there is no listing page editor scoped to a category yet.");
    await page.goto("/admin/listing-pages/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("listing order: pin an ad to position 1, it shows first", async ({ page, request }) => {
    test.setTimeout(240_000);
    await page.goto("/dating/bengaluru/");
    const hrefs = await page.locator("[data-tk=card] a[href*='/ad/']").evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
    const target = hrefs.filter(Boolean).at(-1)!;
    expect(target).toMatch(/^\/ad\//);

    await page.goto("/admin/listing-order/");
    const selects = page.locator("section[aria-labelledby=lo-page] select");
    await selects.nth(0).selectOption({ label: "Dating" });
    await selects.nth(1).selectOption({ label: "Bengaluru" });
    const pins = page.locator("section[aria-labelledby=lo-pins]");
    // Clear pins left by an earlier run.
    for (let i = 0; i < 5 && (await pins.getByRole("button", { name: /^Remove pin for/ }).count()); i += 1) {
      await pins.getByRole("button", { name: /^Remove pin for/ }).first().click();
      await page.waitForTimeout(800);
    }
    await pins.getByLabel("Ad ID or ad link").fill(target);
    await pins.getByLabel("Position").fill("1");
    await pins.getByRole("button", { name: "Add pin" }).click();
    await expect(pins.getByText(/Active/).first()).toBeVisible();

    await expect
      .poll(async () => {
        const html = await (await request.get("/dating/bengaluru/")).text();
        // The Star slot sits above the ordered list (BUG 6 in lane-d-bugs: position 1 lands second), so look at the first non-star card.
        const cards = html.split('<article class="tk-card"').slice(1).filter((card) => !/data-variant="star"/.test(card.slice(0, 200)));
        return cards[0]?.match(/href="(\/ad\/[^"]+)"/)?.[1];
      }, POLL)
      .toBe(target);

    // Clean up: remove the pin again.
    await pins.getByRole("button", { name: /^Remove pin for/ }).first().click();
    await expect(pins.getByRole("button", { name: /^Remove pin for/ })).toHaveCount(0);
  });

  test("listing order: a hidden ad is gone from feeds and the sitemap", async ({ page: posterPage, browser, request, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(posterPage, baseURL!, "hide");
    // The poster page now holds the poster's session, so the admin works in its own context.
    const adminContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.1.2.3" } });
    await signInAdminContext(adminContext, baseURL!);
    const page = await adminContext.newPage();
    await expect.poll(async () => (await (await request.get("/jobs/mumbai/")).text()).includes(ad.adHref), POLL).toBe(true);
    const inSitemap = async () => (await (await request.get("/sitemap/ads.xml")).text()).includes(ad.adHref);

    await page.goto("/admin/listing-order/");
    const hidden = page.locator("section[aria-labelledby=lo-hidden]");
    await hidden.getByLabel("Ad ID or ad link").fill(ad.adHref);
    await hidden.getByRole("button", { name: "Hide ad" }).click();
    await expect(hidden.getByRole("button", { name: /in feeds again$/ }).first()).toBeVisible();

    await expect.poll(async () => (await (await request.get("/jobs/mumbai/")).text()).includes(ad.adHref), POLL).toBe(false);
    await expect.poll(async () => (await (await request.get("/search/?q=" + encodeURIComponent(ad.title))).text()).includes(ad.adHref), POLL).toBe(false);
    await expect.poll(inSitemap, POLL).toBe(false);

    await hidden.getByRole("button", { name: /in feeds again$/ }).first().click();
    await expect.poll(async () => (await (await request.get("/jobs/mumbai/")).text()).includes(ad.adHref), POLL).toBe(true);
    await adminContext.close();
  });

  test("CSV import: dry run, then import", async ({ page }) => {
    const title = `E2E import ${Date.now()}`;
    const csv = `category,city,district,title,description,role\njobs,mumbai,,${title},A weekday office role with a clear description of the work and hours.,Office assistant\n`;
    await page.goto("/admin/import/");
    await page.getByLabel(/Partner account email/).fill(process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test");
    await page.locator("#import-file").setInputFiles({ name: "e2e.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: /Step 1/ }).click();
    await expect(page.getByText("Dry run, nothing has been saved")).toBeVisible();
    await expect(page.getByText(/1 of 1 rows are OK/)).toBeVisible();
    await page.getByRole("button", { name: /Step 2: import 1 listing/ }).click();
    await expect(page.getByText("Import finished")).toBeVisible();
  });

  test("CSV import: a bad row is reported in the dry run", async ({ page }) => {
    const csv = "category,city,district,title,description\nno-such-category,mumbai,,Hi,short\n";
    await page.goto("/admin/import/");
    await page.getByLabel(/Partner account email/).fill(process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test");
    await page.locator("#import-file").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: /Step 1/ }).click();
    await expect(page.getByText(/0 of 1 rows are OK/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Step 2/ })).toHaveCount(0);
  });

  test("moderation queue: approve a pending ad", async () => {
    test.fixme(true, "BUG 6 Admin: /admin/moderation/ is a raw list of all listings (no pending filter, approve or reject buttons).");
  });
});

