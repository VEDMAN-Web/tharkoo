import { createHmac, randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, freshIp, loginUi, newUserApi, setSellerAvailable, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.131: every chat entry point, as a guest and signed in, at 1440 and 390. */

const SHOTS = process.env.POST_SHOTS ?? "";
// Must match SESSION_SECRET in tests/e2e/server.mjs (the mock mail provider seeds the hash the server stores).
const E2E_SESSION_SECRET = "local-only-session-secret-not-real-0001";

type Shared = { adHref: string; slug: string; title: string; listingId: string; sellerEmail: string };
const shared = {} as Shared;

function sizeOf(phone: boolean) {
  return phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/h7-131-${name}-${size?.width}x${size?.height}.png` });
}

/** Collects server errors and console errors so a test can assert there are none. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text().slice(0, 160)}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) problems.push(`${res.status()} ${res.request().method()} ${res.url().replace(/^https?:\/\/[^/]+/, "")}`);
  });
  return problems;
}

async function visitor(browser: Browser, baseURL: string, phone: boolean) {
  const context = await browser.newContext({ baseURL, viewport: sizeOf(phone), extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  await context.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  const page = await context.newPage();
  return { context, page, problems: watch(page) };
}

async function signedIn(browser: Browser, baseURL: string, phone: boolean, prefix: string) {
  const made = await visitor(browser, baseURL, phone);
  const user = await newUserApi(baseURL, prefix);
  await user.api.dispose();
  await loginUi(made.page, user.email, USER_PASSWORD, "/");
  return { ...made, email: user.email };
}

function codeHash(email: string, code: string) {
  return createHmac("sha256", E2E_SESSION_SECRET).update(`email-otp:${email}:${code}`).digest("hex");
}

async function deliverCode(email: string, code: string) {
  await withLocalDb((db) =>
    db.collection("email_login_challenges").insertOne({ email, codeHash: codeHash(email, code), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60 * 1000), consumedAt: null, createdAt: new Date() }),
  );
}

function chatButton(page: Page) {
  return page.locator("[data-tk=chat]").filter({ visible: true }).first();
}

async function closeChecks(page: Page, open: () => Promise<void>, root: string) {
  const target = page.locator(root);
  await open();
  await expect(target).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(target).toHaveCount(0);
  await open();
  await expect(target).toBeVisible();
  await target.getByRole("button", { name: /^Close/ }).first().click();
  await expect(target).toHaveCount(0);
  await open();
  await expect(target).toBeVisible();
  await page.mouse.click(3, 3);
  await expect(target).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test.describe("H7.131 chat flows", () => {
  // The first test sets the ad up and the others read it from `shared`. Run on their own they would post an empty email and the sign-up answers 400 "email: invalid input", so say what is wrong instead.
  test.beforeEach(({}, info) => {
    if (!info.title.startsWith("setup:")) expect(shared.sellerEmail, "run this whole file: its first test posts the ad the others use").toBeTruthy();
  });

  test("setup: an ad whose advertiser takes live chat, and the Help link on the success screen", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "chatflow");
    shared.adHref = ad.adHref;
    shared.slug = ad.adHref.replace(/^\/ad\//, "").replace(/\/$/, "");
    shared.title = ad.title;
    shared.listingId = ad.listingId;
    shared.sellerEmail = ad.email;
    await setSellerAvailable(shared.slug, true);
    // The page is still on the success screen: its Help link opens the support chat.
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Your ad is live");
    await page.locator("[data-tk=success-help]").click();
    await expect(page.locator("[data-tk=support-chat]")).toBeVisible();
    await shot(page, "success-help");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tk=support-chat]")).toHaveCount(0);
  });

  test("ad page, guest: Chat opens the sign-in step, and Esc, X and a click outside close it", async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const phone = info.project.name === "phone-390";
    const { context, page, problems } = await visitor(browser, baseURL!, phone);
    await page.goto(shared.adHref);
    await expect(chatButton(page)).toBeVisible();
    await closeChecks(page, async () => void (await chatButton(page).click()), "[data-tk=ad-popup]");
    await chatButton(page).click();
    await expect(page.locator("[data-tk=ad-popup]")).toHaveAttribute("data-step", "login");
    await shot(page, "ad-guest-signin");
    expect(problems.filter((row) => !row.startsWith("401 "))).toEqual([]);
    await context.close();
  });

  test("ad page, guest: signing in from the chat step lands in the chat on the same ad, and a message sends", async ({ browser, baseURL }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone-390";
    const { context, page, problems } = await visitor(browser, baseURL!, phone);
    await page.route("**/api/auth/email/otp/send", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { sent: true } }) }));
    await page.goto(shared.adHref);
    await chatButton(page).click();
    const popup = page.locator("[data-tk=ad-popup]");
    await popup.getByRole("button", { name: "Use email instead" }).click();
    const email = uniqueEmail("chatguest");
    await popup.getByPlaceholder("Email address").fill(email);
    await popup.getByRole("button", { name: "Send me a code" }).click();
    const code = String(randomInt(100000, 1000000));
    await deliverCode(email, code);
    for (const [index, digit] of [...code].entries()) await popup.locator(".tkn-code-box").nth(index).fill(digit);
    await popup.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.locator("[data-tk=chat-panel]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-tk=ad-popup]")).toHaveCount(0);
    expect(page.url()).toContain(shared.slug);
    await page.locator("[data-tk=chat-panel] textarea").fill("Hello after signing in");
    await page.locator("[data-tk=chat-panel] button[type=submit]").click();
    await expect(page.locator("[data-tk=chat-panel] .tkn-msg.is-mine")).toHaveCount(1);
    await shot(page, "ad-guest-after-signin");
    expect(problems.filter((row) => !row.startsWith("401 "))).toEqual([]);
    await context.close();
  });

  test("ad page, signed in: chat opens, a message sends, the advertiser's inbox and header badge update, the reply shows without a reload, and it closes three ways", async ({ browser, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    const buyer = await signedIn(browser, baseURL!, phone, "chatbuyer");
    const seller = await visitor(browser, baseURL!, phone);
    await loginUi(seller.page, shared.sellerEmail, USER_PASSWORD, "/");
    await buyer.page.goto(shared.adHref);
    await chatButton(buyer.page).click();
    const panel = buyer.page.locator("[data-tk=chat-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-tk=chat-peer]")).not.toHaveText("");
    await panel.locator("textarea").fill("Is this still open?");
    await panel.locator("button[type=submit]").click();
    await expect(panel.locator(".tkn-msg.is-mine")).toHaveCount(1);
    await shot(buyer.page, "ad-signed-in-sent");

    // The advertiser: the header badge, then the inbox row, then a reply.
    await seller.page.reload();
    await expect(seller.page.locator("[data-tk=header-unread]")).toBeVisible({ timeout: 40_000 });
    await seller.page.goto("/u/account/messages/");
    const row = seller.page.locator("[data-tk=chat-row][data-unread=yes]").first();
    await expect(row).toBeVisible();
    await shot(seller.page, "inbox-unread");
    await row.click();
    await expect(seller.page.locator("[data-tk=chat-thread]")).toContainText("Is this still open?");
    await seller.page.locator("[data-tk=chat-thread] textarea").fill("Yes, it is open");
    await seller.page.locator("[data-tk=chat-thread] button[type=submit]").click();
    await expect(seller.page.locator("[data-tk=chat-thread]")).toContainText("Yes, it is open");

    // The buyer sees the reply without reloading.
    await expect(panel).toContainText("Yes, it is open", { timeout: 20_000 });
    await shot(buyer.page, "ad-signed-in-reply");

    await closeChecks(buyer.page, async () => {
      if ((await panel.count()) === 0) await chatButton(buyer.page).click();
    }, "[data-tk=chat-panel]");
    expect(buyer.problems).toEqual([]);
    await buyer.context.close();
    await seller.context.close();
  });

  test("Home and listing card pop-out: Chat opens the chat on the ad (a guest gets the sign-in step); on a phone there is no pop-out", async ({ browser, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    const { context, page, problems } = await visitor(browser, baseURL!, phone);
    for (const path of ["/", "/jobs/mumbai/"]) {
      await expect
        .poll(
          async () => {
            await page.goto(path);
            return page.locator(`:is(.tkh-ad, .tk-row):has(a[href="${shared.adHref}"])`).count();
          },
          { timeout: 120_000, intervals: [4_000] },
        )
        .toBeGreaterThan(0);
      const card = page.locator(`:is(.tkh-ad, .tk-row):has(a[href="${shared.adHref}"])`).first();
      await card.scrollIntoViewIfNeeded();
      if (phone) {
        await expect(page.locator(".tkh-pop")).toHaveCount(0);
        continue;
      }
      await card.hover();
      const chat = page.locator('.tkh-pop [data-tk="pop-chat"]');
      await expect(chat).toBeVisible();
      await shot(page, `popout-${path === "/" ? "home" : "listing"}`);
      await chat.click();
      await expect(page).toHaveURL(new RegExp(`${shared.slug}/?$`));
      await expect(page.locator("[data-tk=ad-popup]")).toHaveAttribute("data-step", "login");
      expect(page.url()).not.toContain("chat=1");
    }
    expect(problems.filter((row) => !row.startsWith("401 "))).toEqual([]);
    await context.close();
  });

  test("pop-out Chat, signed in: the chat panel opens straight away on the ad", async ({ browser, baseURL }, info) => {
    test.skip(info.project.name === "phone-390", "the pop-out is a hover part");
    test.setTimeout(240_000);
    const buyer = await signedIn(browser, baseURL!, false, "chatpop");
    await buyer.page.goto(`${shared.adHref}?chat=1`);
    await expect(buyer.page.locator("[data-tk=chat-panel]")).toBeVisible();
    expect(buyer.page.url()).not.toContain("chat=1");
    await buyer.context.close();
  });

  test("support chat bubble: opens on Home, a listing, the ad page and the post page, and closes with Esc, X and a click outside", async ({ browser, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    const user = await signedIn(browser, baseURL!, phone, "chatsupport");
    const { page, problems } = user;
    const bubble = page.locator(".tkn-chat-bubble");
    const panel = page.locator("[data-tk=support-chat]");
    for (const path of ["/", "/jobs/mumbai/", shared.adHref]) {
      await page.goto(path);
      await page.waitForTimeout(500);
      if (phone && path === shared.adHref) {
        // On a phone the ad page keeps its contact bar free, so the bubble is hidden there; Help lives in the footer.
        await expect(bubble).toBeHidden();
        continue;
      }
      await closeChecks(page, async () => {
        if ((await panel.count()) === 0) await bubble.click();
      }, "[data-tk=support-chat]");
      await shot(page, `support-${path === "/" ? "home" : path.includes("/ad/") ? "ad" : "listing"}`);
    }
    // The post page hides the bubble, so its Help link opens the same chat.
    await page.goto("/u/post-insert/");
    await expect(page.locator("[data-tk=post-help]")).toBeVisible();
    await page.locator("[data-tk=post-help]").click();
    await expect(panel).toBeVisible();
    await shot(page, "support-post-ad");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    expect(problems).toEqual([]);
    await user.context.close();
  });

  test("support chat, signed in: a message becomes a ticket, and a reply from the team shows in the chat without a reload", async ({ browser, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    const user = await signedIn(browser, baseURL!, phone, "chatreply");
    const { page } = user;
    await page.goto("/");
    await page.locator(".tkn-chat-bubble").click();
    const panel = page.locator("[data-tk=support-chat]");
    await panel.locator("#tkn-chat-input").fill("I need help with my account please");
    await panel.locator("button.tkn-send").click();
    await expect(panel).toContainText("Thanks, we'll reply here and by email.", { timeout: 15_000 });
    const ticket = await page.evaluate(async () => {
      const res = await fetch("/api/support/tickets", { credentials: "same-origin" });
      const body = (await res.json()) as { data: { id: string }[] };
      return body.data[0]?.id ?? "";
    });
    expect(ticket).toBeTruthy();
    await withLocalDb((db) => {
      return db.collection("ticket_messages").insertOne({
        ticketId: new ObjectId(ticket),
        authorType: "staff",
        body: "Hello, this is the team. How can we help?",
        internal: false,
        opening: false,
        attachments: [],
        createdAt: new Date(),
      });
    });
    await expect(panel).toContainText("Hello, this is the team. How can we help?", { timeout: 25_000 });
    await shot(page, "support-reply");
    await user.context.close();
  });

  test("support chat, guest: a quick reply and Talk to a person send one message to support", async ({ browser, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    const { context, page, problems } = await visitor(browser, baseURL!, phone);
    await page.goto("/");
    await page.locator(".tkn-chat-bubble").click();
    const panel = page.locator("[data-tk=support-chat]");
    await panel.getByRole("button", { name: "Report a problem" }).click();
    await panel.locator("[data-tk=chat-talk]").click();
    const form = panel.locator("[data-tk=chat-guest]");
    await form.getByLabel("Your name").fill("Asha");
    await form.getByLabel("Email or phone").fill(uniqueEmail("guestsupport"));
    await form.getByRole("button", { name: "Send to support" }).click();
    await expect(panel).toContainText("Thanks, we'll reply here and by email.");
    await shot(page, "support-guest-sent");
    expect(problems).toEqual([]);
    await context.close();
  });
});

