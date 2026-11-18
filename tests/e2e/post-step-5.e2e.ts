import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, grantCredits, newApi, originHeaders, PNG, registerApi, stubPostingFee, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(".tkn-ls-photo img");
    if (img) await Promise.race([img.decode().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 1500))]);
  });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function newPoster(page: Page, baseURL: string, prefix: string, withBirthDate = true, credits = 100) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  if (!withBirthDate) {
    await withLocalDb((db) => db.collection("users").updateOne({ email: email.toLowerCase() }, { $unset: { dateOfBirth: "", attestedAdultAt: "" } }));
  }
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password: USER_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
  if (credits > 0) await grantCredits(page, credits);
  await page.goto("/u/post-insert/");
  await expect(page.locator(".tkp-tile").first()).toBeVisible();
  return email;
}

async function stepOf(page: Page, step: number) {
  await expect(page.locator("[data-tk=step-of]")).toContainText(`Step ${step} of 5`);
}

async function chooseDating(page: Page, prefix: string) {
  await page.locator(".tkp-tile", { hasText: "Dating" }).click();
  await shot(page, `${prefix}-01-category`);
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 2);
}

async function fillDetails(page: Page, title: string, prefix: string) {
  await page.locator("#city").selectOption({ label: "Mumbai" });
  await page.locator("#nickname").fill("Asha");
  await page.locator("#age").fill("28");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("Looking to meet for coffee and a walk by the sea on weekends.");
  await page.getByRole("button", { name: "Coffee", exact: true }).click();
  await shot(page, `${prefix}-02-details`);
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 3);
}

async function addPhoto(page: Page, prefix: string) {
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
  await page.locator("[data-tk=photo-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i);
  await shot(page, `${prefix}-03-photos`);
  await page.locator("[data-tk=go-on]").click();
  await stepOf(page, 4);
}

async function reachAbout(page: Page, title: string, prefix: string) {
  await chooseDating(page, prefix);
  await fillDetails(page, title, prefix);
  await addPhoto(page, prefix);
  const draft = new URL(page.url()).searchParams.get("draft");
  expect(draft).toBeTruthy();
  return draft as string;
}

async function consentAndPublish(page: Page) {
  await page.locator("#consent-terms").check();
  await page.locator("#consent-adult").check();
  const publish = page.getByRole("button", { name: /^(Publish( ad| for \d+ credits)|Save changes)$/ });
  expect(await publish.evaluate((node) => getComputedStyle(node).textTransform)).toBe("none");
  await publish.click();
  await expect(page.locator("[data-tk=step-title]")).toHaveText(/^(Your ad is live|Changes saved)$/);
}

async function seen(page: Page, path: string, text: string) {
  await expect
    .poll(async () => (await (await page.request.get(path)).text()).includes(text), { timeout: 100_000, intervals: [5_000] })
    .toBe(true);
}

async function serious(page: Page) {
  const found = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function tapTargets(page: Page, selector: string, least = 44) {
  const heights = await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent).map((node) => node.getBoundingClientRect().height));
  expect(heights.length, selector).toBeGreaterThan(0);
  expect(Math.min(...heights), selector).toBeGreaterThanOrEqual(least);
}

test.describe("H7.86 post an ad, step 5 and the success screen", () => {
  test("a new account posts a Dating ad through all five steps, it shows on its city page, and editing it works", async ({ page, baseURL }, info) => {
    test.setTimeout(420_000);
    const prefix = `flow${info.project.name === "phone-390" ? "390" : "1440"}`;
    const title = `Coffee walk ${Date.now()}`;
    await newPoster(page, baseURL!, "flow");
    await reachAbout(page, title, prefix);

    await expect(page.locator("[data-tk=step-title]")).toHaveText("About you");
    await expect(page.locator("[data-tk=step-help]")).toContainText("We ask only once");
    await expect(page.locator("#about-name")).toHaveValue("Asha");
    await expect(page.locator("#about-city option:checked")).toHaveText("Mumbai");
    await expect(page.locator("#about-dob")).toHaveCount(0);
    await page.locator("#phone").fill("9876543210");
    await shot(page, `${prefix}-04-about-you`);
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);

    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review and publish");
    await expect(page.locator("[data-tk=review-title]")).toContainText(title);
    await expect(page.locator("[data-tk=review-photos]")).toContainText("1 photo");
    await expect(page.locator("[data-tk=review-contact]")).toContainText("+919876543210");
    await expect(page.locator("[data-tk=review-place]")).toContainText("Mumbai");
    await expect(page.locator("[data-tk=review-preview] [data-tk=post-preview] .tkn-ls-by")).toHaveText("Asha, 28");
    await shot(page, `${prefix}-05-review`);

    const edited = `${title} edited once`;
    await page.locator("[data-tk=edit-title]").click();
    await stepOf(page, 2);
    await expect(page.locator("#title")).toHaveValue(title);
    await page.locator("#title").fill(edited);
    for (const step of [3, 4, 5]) {
      await page.locator("[data-tk=go-on]").click();
      await stepOf(page, step);
    }
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review and publish");
    await expect(page.locator("[data-tk=review-title]")).toContainText(edited);

    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator(".tkp-main [data-tk=field-error]")).toHaveCount(2);
    await shot(page, `${prefix}-06-review-errors`);
    await consentAndPublish(page);

    await expect(page.locator("[data-tk=what-next] li")).toHaveCount(3);
    await expect(page.locator("[data-tk=what-next]")).toContainText("Mumbai Dating");
    await expect(page.locator("[data-tk=view-my-ads]")).toHaveText("View my ads");
    await expect(page.locator("[data-tk=post-another]")).toHaveText("Post another ad");
    await expect(page.locator("[data-tk=post-success] [data-tk=post-preview]")).toContainText(edited);
    expect(page.url()).not.toContain("draft=");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await shot(page, `${prefix}-07-success`);

    await page.locator("[data-tk=view-my-ads]").click();
    await page.waitForURL(/\/u\/account\/ads\//);
    const mine = page.locator("[data-tk=card]").filter({ hasText: edited }).first();
    await expect(mine).toBeVisible();
    const adHref = await mine.locator('a[href*="/ad/"]').first().getAttribute("href");
    expect(adHref).toBeTruthy();
    expect((await page.request.get(adHref!)).status()).toBe(200);
    await shot(page, `${prefix}-08-my-ads`);

    await seen(page, "/dating/mumbai/", edited);

    const final = `${title} final`;
    await mine.getByRole("link", { name: "Edit", exact: true }).click();
    await page.waitForURL(/draft=/);
    await expect(page.locator("#title")).toHaveValue(edited);
    await expect(page.locator("#nickname")).toHaveValue("Asha");
    await page.locator("#title").fill(final);
    for (const step of [3, 4, 5]) {
      await page.locator("[data-tk=go-on]").click();
      await stepOf(page, step);
    }
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review your changes");
    await consentAndPublish(page);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Changes saved");
    await page.goto("/u/account/ads/");
    await expect(page.locator("[data-tk=card]").filter({ hasText: final }).first()).toBeVisible();
    const finalHref = await page.locator("[data-tk=card]").filter({ hasText: final }).first().locator('a[href*="/ad/"]').first().getAttribute("href");
    expect(finalHref).toBeTruthy();
    const finalPage = await page.request.get(finalHref!);
    expect(finalPage.status()).toBe(200);
    expect(await finalPage.text()).toContain(final);
    await seen(page, "/dating/mumbai/", final);
  });

  test("a first-time account without a date of birth is asked for it once, and cannot go on under 18", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await newPoster(page, baseURL!, "dob", false);
    await reachAbout(page, `Sunset walk ${Date.now()}`, "dob");
    await expect(page.locator("[data-tk=step-title]")).toHaveText("About you");
    await expect(page.locator("#about-dob")).toBeVisible();
    await expect(page.locator("#about-adult")).toBeVisible();
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("#about-dob")).toBeVisible();
    await expect(page.getByText("Enter your date of birth")).toBeVisible();
    await expect(page.getByText("Tick this box to go on")).toBeVisible();
    await stepOf(page, 4);
    const young = new Date();
    young.setUTCFullYear(young.getUTCFullYear() - 17);
    await page.locator("#about-dob").fill(young.toISOString().slice(0, 10));
    await page.locator("#about-adult").check();
    await page.locator("[data-tk=go-on]").click();
    await expect(page.getByText("You must be 18 or older to post an ad")).toBeVisible();
    await stepOf(page, 4);
    await page.locator("#about-dob").fill("1995-05-05");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await consentAndPublish(page);
    await page.goto("/u/post-insert/");
    await expect(page.locator(".tkp-tile").first()).toBeVisible();
    await page.locator(".tkp-tile", { hasText: "Dating" }).click();
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("#nickname")).toHaveValue("");
    await page.locator("#nickname").fill("Asha");
    await page.locator("#title").fill(`Second ad ${Date.now()}`);
    await page.locator("#text").fill("Another friendly walk with coffee on a quiet weekday evening.");
    await page.locator("#age").fill("28");
    await page.getByRole("button", { name: "Events", exact: true }).click();
    for (const step of [3, 4]) {
      await page.locator("[data-tk=go-on]").click();
      await stepOf(page, step);
    }
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Contact");
    await expect(page.locator("#about-dob")).toHaveCount(0);
    await expect(page.locator("#about-name")).toHaveCount(0);
  });

  test("contact choices: sentence case in order, the masked account email, WhatsApp same as phone, a checked Telegram username, and Email only publishes", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const email = await newPoster(page, baseURL!, "contact5");
    const draft = await reachAbout(page, `Contact check ${Date.now()}`, "contact5");
    await expect(page.locator(".tkp-chips[aria-label='How people reach you'] .tkp-chip")).toHaveText(["Phone and email", "Phone only", "Email only"]);
    await expect(page.getByRole("button", { name: "Phone and email" })).toHaveAttribute("aria-pressed", "true");
    const [local, domain] = email.split("@");
    await expect(page.locator("[data-tk=account-email]")).toHaveText(`We will use your account email: ${local[0]}••••@${domain}`);
    expect(await page.locator("[data-tk=account-email]").innerText()).not.toContain(local);

    await page.getByRole("button", { name: "Phone only" }).click();
    await expect(page.locator("[data-tk=account-email]")).toHaveCount(0);
    await expect(page.locator("#phone")).toBeVisible();
    await page.getByRole("button", { name: "Phone and email" }).click();
    await expect(page.locator("[data-tk=account-email]")).toBeVisible();

    await page.locator("#phone").fill("9876543210");
    await page.getByRole("switch", { name: "WhatsApp" }).click();
    await expect(page.locator("#whatsapp-same")).toBeChecked();
    await expect(page.locator("#whatsapp-number")).toHaveCount(0);
    await page.locator("#whatsapp-same").uncheck();
    await expect(page.locator("#whatsapp-number")).toBeVisible();
    await page.locator("#whatsapp-number").fill("123");
    await page.locator("#whatsapp-number").blur();
    await page.getByRole("switch", { name: "Telegram" }).click();
    await expect(page.locator("#telegram")).toHaveAttribute("placeholder", "@yourname");
    await expect(page.locator("label[for=telegram]")).toContainText("Telegram username");
    await page.locator("#telegram").fill("ab");
    await page.locator("[data-tk=go-on]").click();
    await expect(page.getByText("Use +91 and 10 digits")).toBeVisible();
    await expect(page.getByText("Use 5 to 32 letters, digits or underscores")).toBeVisible();
    await stepOf(page, 4);
    await page.locator("#telegram").fill("bad name!");
    await expect(page.getByText("Use 5 to 32 letters, digits or underscores")).toBeVisible();
    await page.locator("#telegram").fill("");
    await page.locator("#telegram").blur();
    await expect(page.getByText("Enter your Telegram username")).toBeVisible();
    await page.locator("#telegram").fill("@asha_walks");
    await page.locator("#whatsapp-number").fill("9123456780");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=review-contact]")).toContainText("+919876543210 and email");

    const saved = (await (await page.request.get(`/api/listings/by-id/${draft}`)).json()).data.contact;
    expect(saved).toMatchObject({ phone: "+919876543210", whatsapp: "+919123456780", telegram: "@asha_walks", acceptForm: true });

    await page.getByRole("button", { name: "Back" }).click();
    await stepOf(page, 4);
    await page.getByRole("button", { name: "Email only" }).click();
    await expect(page.locator("#phone")).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "WhatsApp" })).toHaveCount(0);
    await expect(page.locator("[data-tk=account-email]")).toBeVisible();
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=review-contact]")).toHaveText(/Email only/);
    const emailOnly = (await (await page.request.get(`/api/listings/by-id/${draft}`)).json()).data.contact;
    expect(emailOnly.phone ?? null).toBeNull();
    expect(emailOnly.whatsapp ?? null).toBeNull();
    expect(emailOnly.acceptForm).toBe(true);
    await consentAndPublish(page);
  });

  test("desktop: step 1 fits at every laptop size with no inner scroll, four tiles a row, and the Tip is hidden when it does not fit", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "desktop sizes only");
    test.setTimeout(120_000);
    await newPoster(page, baseURL!, "fit1");
    for (const [width, height] of [[1366, 768], [1536, 730], [1536, 674], [1440, 900]] as [number, number][]) {
      await page.setViewportSize({ width, height });
      await page.goto("/u/post-insert/");
      await expect(page.locator(".tkp-tile")).toHaveCount(11);
      const fit = await page.evaluate(() => {
        const scroll = document.querySelector(".tkp-scroll") as HTMLElement;
        const tiles = Array.from(document.querySelectorAll<HTMLElement>(".tkp-tile")).map((node) => node.getBoundingClientRect());
        const nav = (document.querySelector(".tkp-nav") as HTMLElement).getBoundingClientRect();
        const tip = document.querySelector(".tkp-tip") as HTMLElement | null;
        const aside = document.querySelector(".tkp-aside") as HTMLElement;
        return {
          inner: scroll.scrollHeight - scroll.clientHeight,
          page: document.documentElement.scrollHeight - window.innerHeight,
          rows: new Set(tiles.map((box) => Math.round(box.top))).size,
          perRow: tiles.filter((box) => Math.round(box.top) === Math.round(tiles[0].top)).length,
          tallest: Math.max(...tiles.map((box) => box.height)),
          navBottom: nav.bottom,
          tipShown: tip ? getComputedStyle(tip).display !== "none" : false,
          asideCut: aside.scrollHeight - aside.clientHeight,
          asideBottom: aside.getBoundingClientRect().bottom,
        };
      });
      expect(fit.inner, `${width}x${height} inner scroll`).toBeLessThanOrEqual(0);
      expect(fit.page, `${width}x${height} page scroll`).toBeLessThanOrEqual(0);
      expect(fit.navBottom, `${width}x${height} buttons in view`).toBeLessThanOrEqual(height);
      expect(fit.asideCut, `${width}x${height} preview column cut`).toBeLessThanOrEqual(0);
      expect(fit.asideBottom, `${width}x${height} preview column in view`).toBeLessThanOrEqual(height);
      if (width >= 1280) {
        expect(fit.perRow, `${width} tiles a row`).toBe(4);
        expect(fit.rows, `${width} rows`).toBe(3);
        expect(fit.tallest, `${width}x${height} tile height`).toBeGreaterThanOrEqual(height < 860 ? 80 : 100);
      }
      if (height < 820) expect(fit.tipShown, `${width}x${height} tip hidden when short`).toBe(false);
      await shot(page, `3-3-step1-${width}x${height}`);
    }
  });

  test("desktop: step 2 shows the whole preview column and step 3 fits four photos with no inner scroll", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop-1440", "desktop sizes only");
    test.setTimeout(240_000);
    await newPoster(page, baseURL!, "fit5");
    await chooseDating(page, "fit5");
    await page.locator("#city").selectOption({ label: "Mumbai" });
    await page.locator("#nickname").fill("Asha");
    await page.locator("#age").fill("28");
    await page.locator("#title").fill("A long title that wraps in the preview card");
    await page.locator("#text").fill("Looking to meet for coffee and a long walk by the sea on weekends, then dinner somewhere quiet and a chat about books, music and travel.");
    await page.getByRole("button", { name: "Coffee", exact: true }).click();
    const sizes: [number, number][] = [[1366, 768], [1536, 730], [1536, 674], [1440, 900]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await expect(page.locator(".tkp-aside")).toBeVisible();
      const aside = await page.locator(".tkp-aside").evaluate((node) => {
        const box = node.getBoundingClientRect();
        return { bottom: box.bottom, cut: node.scrollHeight - node.clientHeight };
      });
      expect(aside.bottom, `${width}x${height} preview column inside the window`).toBeLessThanOrEqual(height);
      expect(aside.cut, `${width}x${height} nothing cut in the preview column`).toBeLessThanOrEqual(0);
      await shot(page, `3-3-step2-${width}x${height}`);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 3);
    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    const files = Array.from({ length: 4 }, (_, index) => ({ name: `p${index}.png`, mimeType: "image/png", buffer: PNG }));
    await page.locator("[data-tk=photo-input]").setInputFiles(files);
    await expect(page.locator("[data-tk=photo-tile]")).toHaveCount(4, { timeout: 30_000 });
    await expect(page.locator("[data-tk=upload-progress]")).toHaveCount(0);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const fit = await page.evaluate(() => {
        const scroll = document.querySelector(".tkp-scroll") as HTMLElement;
        const frames = Array.from(document.querySelectorAll<HTMLElement>("[data-tk=photo-grid] .tkp-media-frame")).map((node) => node.getBoundingClientRect());
        const nav = (document.querySelector(".tkp-nav") as HTMLElement).getBoundingClientRect();
        return { inner: scroll.scrollHeight - scroll.clientHeight, page: document.documentElement.scrollHeight - window.innerHeight, frames: frames.map((box) => [Math.round(box.width), Math.round(box.height), Math.round(box.top)]), navBottom: nav.bottom };
      });
      expect(fit.frames.length).toBe(4);
      const side = height >= 860 ? 120 : 96;
      expect(fit.frames.map((box) => box[0]), `${width} tile widths`).toEqual([side, side, side, side]);
      expect(fit.frames.map((box) => box[1]), `${width} tile heights`).toEqual([side, side, side, side]);
      expect(new Set(fit.frames.map((box) => box[2])).size, `${width} one row`).toBe(1);
      expect(fit.inner, `${width}x${height} no inner scroll`).toBeLessThanOrEqual(0);
      expect(fit.page, `${width}x${height} no page scroll`).toBeLessThanOrEqual(0);
      expect(fit.navBottom, `${width}x${height} buttons in view`).toBeLessThanOrEqual(height);
      await shot(page, `3-3-step3-${width}x${height}`);
    }
  });

  test("paid posting: the price is clear early, step 5 turns amber with no credits, a recharge turns it back, and the receipt shows after publishing", async ({ page, baseURL }, info) => {
    test.setTimeout(240_000);
    const prefix = `paid${info.project.name === "phone-390" ? "390" : "1440"}`;
    await stubPostingFee(page);
    await page.route("**/api/listings/*/submit", async (route) => {
      const real = await route.fetch();
      const body = (await real.json()) as { data?: Record<string, unknown> };
      await route.fulfill({ response: real, json: { ...body, data: { ...(body.data ?? {}), charged: 30, balance: 70 } } });
    });
    await newPoster(page, baseURL!, "paid", true, 0);
    await expect(page.locator("[data-tk=step-help]")).toHaveText("Pick a category. Posting an ad costs 30 credits.");
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.locator("[data-tk=credits-card]")).toContainText("Balance 0 credits");
      await expect(page.locator("[data-tk=credits-card]")).toContainText("This ad: 30 credits");
      await expect(page.locator("[data-tk=credits-topup]")).toBeVisible();
      await shot(page, `${prefix}-A-rail-card`);
    }
    const draft = await reachAbout(page, `Paid check ${Date.now()}`, prefix);
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Review and publish");
    const card = page.locator("[data-tk=pay-card]");
    await expect(card).toHaveAttribute("data-state", "low");
    await expect(page.locator("[data-tk=pay-fee]")).toHaveText("30 credits");
    await expect(page.locator("[data-tk=pay-balance]")).toHaveText("0 credits");
    await expect(page.locator("[data-tk=pay-short]")).toContainText("You need 30 more credits to publish.");
    await expect(page.locator("[data-tk=publish-blocked]")).toBeDisabled();
    await expect(page.locator("[data-tk=publish-blocked]")).toHaveAttribute("aria-describedby", "pay-reason");
    const recharge = page.locator(".tkp-nav [data-tk=go-on]");
    await expect(recharge).toHaveText("Recharge now");
    expect(await card.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 251, 235)");
    await card.scrollIntoViewIfNeeded();
    await shot(page, `${prefix}-B-amber`);

    await recharge.click();
    const sheet = page.locator("[data-tk=recharge-sheet]");
    await expect(sheet.locator("[data-tk=recharge-short]")).toContainText("You need 30 more credits");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "low");

    await grantCredits(page, 100);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tk:credits-added", { detail: { added: 100 } })));
    await expect(page.locator("[data-tk=credits-toast]")).toHaveText("100 credits added");
    await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "ok");
    await expect(page.locator("[data-tk=pay-balance]")).toHaveText("100 credits");
    await expect(page.locator("[data-tk=pay-after]")).toHaveText("70 credits");
    await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Publish for 30 credits");
    await expect(page.locator("[data-tk=publish-blocked]")).toHaveCount(0);
    await page.locator("[data-tk=pay-card]").scrollIntoViewIfNeeded();
    await shot(page, `${prefix}-B-ok`);

    await consentAndPublish(page);
    await expect(page.locator("[data-tk=receipt]")).toHaveText("30 credits paid · Balance 70 credits");
    await expect(page.locator("[data-tk=view-ad]")).toHaveAttribute("href", /^\/ad\//);
    await expect(page.locator("[data-tk=upsell]")).toContainText("Get more views");
    expect(await page.locator("[data-tk=upsell-plan]").count()).toBeGreaterThan(0);
    await expect(page.locator("[data-tk=post-another]")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await shot(page, `${prefix}-C-success`);
    expect(draft).toBeTruthy();
  });

  test("with no posting-fee endpoint, a user with 0 credits sees no fee anywhere and publishes normally", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await stubPostingFee(page, 404);
    await newPoster(page, baseURL!, "nofee", true, 0);
    await expect(page.locator("[data-tk=step-help]")).toHaveText("Pick a category. This helps the right people find your ad.");
    await expect(page.locator("[data-tk=credits-card]")).toHaveCount(0);
    await reachAbout(page, `No fee ${Date.now()}`, "nofee");
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=pay-card]")).toHaveCount(0);
    await expect(page.locator("[data-tk=publish-blocked]")).toHaveCount(0);
    await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Publish ad");
    await consentAndPublish(page);
    await expect(page.locator("[data-tk=receipt]")).toHaveCount(0);
    await expect(page.locator("[data-tk=view-my-ads]")).toBeVisible();
  });

  test("a posting-fee answer of 0 means posting is free as well", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await stubPostingFee(page, 0);
    await newPoster(page, baseURL!, "zerofee", true, 0);
    await expect(page.locator("[data-tk=credits-card]")).toHaveCount(0);
    await expect(page.locator("[data-tk=step-help]")).not.toContainText("credits");
  });

  test("when the server answers 402 at publish, the amber card shows the real numbers and no code", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await stubPostingFee(page);
    await page.route("**/api/listings/*/submit", (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: "INSUFFICIENT_CREDITS", message: "You need 10 more credits to publish.", need: 30, balance: 20, fee: 30, short: 10 } }),
      }),
    );
    await newPoster(page, baseURL!, "drained", true, 100);
    await reachAbout(page, `Drained ${Date.now()}`, "drained");
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "ok");
    await page.locator("#consent-terms").check();
    await page.locator("#consent-adult").check();
    await page.getByRole("button", { name: /^Publish for 30 credits$/ }).click();
    await expect(page.locator("[data-tk=pay-card]")).toHaveAttribute("data-state", "low");
    await expect(page.locator("[data-tk=pay-short]")).toContainText("You need 10 more credits to publish.");
    await expect(page.locator("[data-tk=pay-balance]")).toHaveText("20 credits");
    await expect(page.getByText(/INSUFFICIENT/)).toHaveCount(0);
    await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Recharge now");
  });

  test("a live ad can be edited without a fee: no pay card, no top up, and a Save changes button", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await stubPostingFee(page);
    await newPoster(page, baseURL!, "freeedit", true, 100);
    const title = `Free edit ${Date.now()}`;
    const draft = await reachAbout(page, title, "freeedit");
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    await consentAndPublish(page);
    await page.goto(`/u/post-insert/?draft=${draft}&step=5`);
    await stepOf(page, 5);
    await expect(page.locator("[data-tk=pay-card]")).toHaveCount(0);
    await expect(page.locator(".tkp-nav [data-tk=go-on]")).toHaveText("Save changes");
    await expect(page.locator("[data-tk=credits-card]")).toContainText("no charge");
    await expect(page.locator("[data-tk=credits-topup]")).toHaveCount(0);
  });

  test("a photo that cannot be added keeps a red tile with its reason on it and a neutral placeholder, not a broken image", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    await newPoster(page, baseURL!, "failtile");
    await chooseDating(page, "failtile");
    await fillDetails(page, `Failed tile ${Date.now()}`, "failtile");
    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a photo") });
    const tile = page.locator("[data-tk=photo-tile][data-state=failed]");
    await expect(tile).toHaveCount(1);
    await expect(tile.locator("[data-tk=media-failed]")).toBeVisible();
    await expect(tile.locator("img")).toHaveCount(0);
    await expect(page.locator('img[alt="New photo"]')).toHaveCount(0);
    const reason = tile.locator("[data-tk=media-reason]");
    await expect(reason).toBeVisible();
    expect((await reason.innerText()).trim().length).toBeGreaterThan(10);
    expect(await reason.innerText()).not.toMatch(/^[A-Z_]{6,}$/);
    expect(await tile.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe("rgb(220, 38, 38)");
    const box = (await tile.boundingBox())!;
    const reasonBox = (await reason.boundingBox())!;
    expect(reasonBox.y).toBeGreaterThanOrEqual(box.y);
    expect(reasonBox.y + reasonBox.height).toBeLessThanOrEqual(box.y + box.height + 1);
    await shot(page, `failtile-${info.project.name === "phone-390" ? "390" : "1440"}`);
    await tile.getByRole("button", { name: "Remove New photo" }).click();
    await expect(page.locator("[data-tk=photo-tile][data-state=failed]")).toHaveCount(0);
  });

  test("steps 4 and 5 and the success screen fit every common size, keep the bar clear of the last field, and pass axe", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    await stubPostingFee(page);
    await newPoster(page, baseURL!, "sizes5");
    const id = await reachAbout(page, `Size check ${Date.now()}`, "sizes5");
    const sizes: [number, number][] = [[360, 740], [390, 844], [768, 1024], [1366, 768], [1536, 730], [1536, 674], [1440, 900]];
    const checkSize = async (width: number, height: number, label: string) => {
      expect(await overflow(page), `${label} ${width}: sideways scroll`).toBeLessThanOrEqual(0);
      const nav = (await page.locator(".tkp-nav").boundingBox())!;
      if (width < 1024) {
        expect(Math.round(nav.y + nav.height), `${label} ${width}: bar at the bottom`).toBe(height);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const last = (await page.locator(".tkp-scroll > *").last().boundingBox())!;
        const bar = (await page.locator(".tkp-nav").boundingBox())!;
        expect(last.y + last.height, `${label} ${width}: end above the bar`).toBeLessThanOrEqual(bar.y + 1);
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
        const top = (await page.locator(".tkp-nav").boundingBox())!;
        expect(top.y + top.height - height, `${label} ${width}x${height}: buttons in view`).toBeLessThanOrEqual(1);
      }
    };
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(`/u/post-insert/?draft=${id}&step=4`);
      await expect(page.locator("[data-tk=about-you]")).toBeVisible();
      await checkSize(width, height, "About you");
      await shot(page, `3-3-about-${width}x${height}`);
    }
    await tapTargets(page, ".tkp-btn");
    await tapTargets(page, ".tkp-chip", 40);
    await tapTargets(page, ".tk-field input, .tk-field select", 40);
    expect(await serious(page)).toEqual([]);
    await page.locator("#phone").fill("9876543210");
    await page.locator("[data-tk=go-on]").click();
    await stepOf(page, 5);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(`/u/post-insert/?draft=${id}&step=5`);
      await expect(page.locator("[data-tk=review-step]")).toBeVisible();
      await expect(page.locator("[data-tk=review-photos]")).toContainText("1 photo");
      await checkSize(width, height, "Review");
      await shot(page, `3-3-review-${width}x${height}`);
    }
    await tapTargets(page, ".tkp-edit, .tkp-btn");
    await tapTargets(page, ".tkp-consent label", 34);
    expect(await serious(page)).toEqual([]);
    await consentAndPublish(page);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await expect(page.locator("[data-tk=post-success]")).toBeVisible();
      expect(await overflow(page), `success ${width}: sideways scroll`).toBeLessThanOrEqual(0);
      if (width >= 1024) {
        const actions = (await page.locator(".tkp-success-actions").boundingBox())!;
        expect(actions.y + actions.height, `success ${width}x${height}: buttons in view`).toBeLessThanOrEqual(height);
      }
      await shot(page, `3-3-success-${width}x${height}`);
    }
    await tapTargets(page, ".tkp-success-actions .tkp-btn");
    expect(await serious(page)).toEqual([]);
  });
});
