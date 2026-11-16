import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, newApi, originHeaders, PNG, registerApi, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(".tkn-ls-photo img");
    if (img) await img.decode().catch(() => undefined);
  });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function newPoster(page: Page, baseURL: string, prefix: string, withBirthDate = true) {
  const email = uniqueEmail(prefix);
  const signup = await newApi(baseURL);
  await registerApi(signup, baseURL, email);
  await signup.dispose();
  if (!withBirthDate) {
    await withLocalDb((db) => db.collection("users").updateOne({ email: email.toLowerCase() }, { $unset: { dateOfBirth: "", attestedAdultAt: "" } }));
  }
  const res = await page.request.post("/api/auth/login", { headers: originHeaders(baseURL, "/u/login/"), data: { email, password: USER_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
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
  const publish = page.getByRole("button", { name: "Publish ad", exact: true });
  expect(await publish.evaluate((node) => getComputedStyle(node).textTransform)).toBe("none");
  await publish.click();
  await expect(page.locator("[data-tk=step-title]")).toHaveText("Your ad is live");
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

async function tapTargets(page: Page, selector: string) {
  const heights = await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent).map((node) => node.getBoundingClientRect().height));
  expect(heights.length, selector).toBeGreaterThan(0);
  expect(Math.min(...heights), selector).toBeGreaterThanOrEqual(44);
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

    await expect(page.locator("[data-tk=step-title]")).toHaveText("Check your ad");
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
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Check your ad");
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
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Check your ad");
    await consentAndPublish(page);
    await page.goto("/u/account/ads/");
    await expect(page.locator("[data-tk=card]").filter({ hasText: final }).first()).toBeVisible();
    expect((await page.request.get(adHref!)).status()).toBe(200);
    expect(await (await page.request.get(adHref!)).text()).toContain(final);
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
    await expect(page.locator("#nickname")).toHaveValue("Asha");
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
    await page.getByRole("switch", { name: "Telegram" }).click();
    await expect(page.locator("#telegram")).toHaveAttribute("placeholder", "@yourname");
    await expect(page.getByText("Telegram username", { exact: true })).toBeVisible();
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
    const sizes: [number, number][] = [[1366, 768], [1536, 730]];
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
      expect(fit.frames.map((box) => box[0]), `${width} tile widths`).toEqual([96, 96, 96, 96]);
      expect(fit.frames.map((box) => box[1]), `${width} tile heights`).toEqual([96, 96, 96, 96]);
      expect(new Set(fit.frames.map((box) => box[2])).size, `${width} one row`).toBe(1);
      expect(fit.inner, `${width}x${height} no inner scroll`).toBeLessThanOrEqual(0);
      expect(fit.page, `${width}x${height} no page scroll`).toBeLessThanOrEqual(0);
      expect(fit.navBottom, `${width}x${height} buttons in view`).toBeLessThanOrEqual(height);
      await shot(page, `3-3-step3-${width}x${height}`);
    }
  });

  test("steps 4 and 5 and the success screen fit every common size, keep the bar clear of the last field, and pass axe", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    await newPoster(page, baseURL!, "sizes5");
    const id = await reachAbout(page, `Size check ${Date.now()}`, "sizes5");
    const sizes: [number, number][] = [[360, 740], [390, 844], [768, 1024], [1366, 768], [1536, 730]];
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
    await tapTargets(page, ".tkp-chip, .tkp-btn");
    await tapTargets(page, ".tk-field input, .tk-field select");
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
    await tapTargets(page, ".tkp-consent label");
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
