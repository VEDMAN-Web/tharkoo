import { createHmac, randomInt } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, firstAdPath, hasHorizontalScroll, isPhone, newUserApi, originHeaders, setSellerAvailable, slugFromAdPath, test, withLocalDb, withoutAddress } from "./helpers";

const E2E_SESSION_SECRET = "local-only-session-secret-not-real-0001";

async function deliverCode(email: string, code: string) {
  const codeHash = createHmac("sha256", E2E_SESSION_SECRET).update(`email-otp:${email}:${code}`).digest("hex");
  const stored = await withLocalDb(async (db) => {
    await db.collection("email_login_challenges").insertOne({
      email,
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    });
    return true;
  });
  expect(stored, "E2E_MONGO_URI_FILE must point at the in-memory database").toBe(true);
}

/**
 * Signs in through the current login card (H7.12): the email address, a code from a mocked send, then the six boxes.
 * The code is stored the way the mail provider would have delivered it. Ends on the user panel.
 */
async function signInUi(page: Page, email: string) {
  const code = String(randomInt(100000, 1000000));
  await page.route("**/api/auth/email/otp/send", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { sent: true } }) }),
  );
  await page.goto("/u/login/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByRole("group", { name: "6-digit code" })).toBeVisible();
  await deliverCode(email, code);
  for (const [index, digit] of [...code].entries()) {
    await page.getByLabel(`Digit ${index + 1} of 6`).fill(digit);
  }
  await page.waitForURL(/\/u\/account\//);
  await page.goto("/u/account/dashboard/");
}

// H6.8: the ad page contact card (desktop sidebar) and the mobile sticky bar.
// Dating ad (people category): Call, WhatsApp, Chat online now.
// The tour switch is turned on in the in-memory test database for this file only, and put back afterwards.
// The seed data, production and the people guard are not touched.

const DATING_FEED = "/dating/bengaluru/";
const PROPERTY_FEED = "/property/bengaluru/";
const TOUR_COINS = 2;
const BASE_LABELS = ["Call", "WhatsApp", "Chat online now"];
// H7.5 (relay #69): a people ad has no video call. Call, WhatsApp and chat stay.
const PEOPLE_LABELS = ["Call", "WhatsApp", "Chat online now"];
const TOUR_LABEL = `Video call and verify · ${TOUR_COINS} credits`;
const PHONE_PEOPLE_LABELS = ["Call", "WhatsApp", "Chat"];
const PHONE_TOUR_LABELS = ["WhatsApp", "Chat", `Video · ${TOUR_COINS} credits`];

/**
 * An ad on a city feed: the first one, or the `index`th. (firstAdPath needs a super-top card, which the property feed may not have.)
 * The chat round trip moves its ad to another account for a while, so it takes a different ad per project: two workers run the phone and
 * the desktop project at the same time, and they must never use the same ad.
 */
async function anyAdPath(page: Page, feed: string, index = 0) {
  await page.goto(feed);
  const link = page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) a[href*=\"/ad/\"]").nth(index);
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

type TourSwitch = { enabled: boolean; coins: number };

async function readPropertyTourSwitch(): Promise<TourSwitch> {
  const row = await withLocalDb((db) =>
    db.collection("categories").findOne({ slug: "property" }, { projection: { videoTourEnabled: 1, videoTourCoins: 1 } }),
  );
  expect(row, "the in-memory test database is reachable").not.toBeNull();
  return { enabled: row?.videoTourEnabled === true, coins: row?.videoTourCoins ?? 1 };
}

async function writePropertyTourSwitch(value: TourSwitch) {
  const res = await withLocalDb((db) =>
    db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: value.enabled, videoTourCoins: value.coins } }),
  );
  expect(res?.matchedCount).toBe(1);
}

/** The contact buttons the visitor sees: the sticky bar on a phone, the contact card on a wider screen. */
function contactScope(page: Page) {
  return page.locator(isPhone(page) ? "[data-tk=bottom-bar]" : "[data-tk=contact-card]");
}

async function buttonLabels(page: Page) {
  return contactScope(page)
    .locator(".tk-btn")
    .evaluateAll((els) => els.map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()));
}

/** Every visible contact button is at least 24 px in both directions. */
async function expectTapTargets(page: Page) {
  const boxes = await contactScope(page).locator(".tk-btn").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  }
  return boxes;
}

test.describe("H6.8 contact card on a dating ad (people, no tour)", () => {
  test("people ad: Call, WhatsApp and Chat online now, and no video call", async ({ page }) => {
    await page.goto(await firstAdPath(page, DATING_FEED));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await buttonLabels(page)).toEqual(isPhone(page) ? PHONE_PEOPLE_LABELS : PEOPLE_LABELS);
    await expect(contactScope(page).locator("[data-tk=tour]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("no chat section lower on the page any more", async ({ page }) => {
    await page.goto(await firstAdPath(page, DATING_FEED));
    await expect(page.getByRole("region", { name: "Chat" })).toHaveCount(0);
    await expect(page.locator("[data-tk=chat-now]")).toHaveCount(0);
  });
});

test.describe("H6.8 contact card on a property ad with live tours on", () => {
  let original: TourSwitch | null = null;

  test.beforeAll(async () => {
    original = await readPropertyTourSwitch();
    await writePropertyTourSwitch({ enabled: true, coins: TOUR_COINS });
  });

  test.afterAll(async () => {
    if (original) await writePropertyTourSwitch(original);
  });

  test("contact buttons in order, the video call last", async ({ page }) => {
    await page.goto(await anyAdPath(page, PROPERTY_FEED));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await buttonLabels(page)).toEqual(isPhone(page) ? PHONE_TOUR_LABELS : [...BASE_LABELS, TOUR_LABEL]);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const boxes = await expectTapTargets(page);
    // The buttons sit side by side in the bar on a phone and never overlap.
    if (isPhone(page)) {
      const row = [...boxes].sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].width - 0.5);
    }
  });

  test("the page passes axe with no serious or critical issues", async ({ page }) => {
    await page.goto(await anyAdPath(page, PROPERTY_FEED));
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => item.id)).toEqual([]);
  });

  test("a signed-out visitor who taps the video call is asked to sign in", async ({ page }) => {
    await page.goto(await anyAdPath(page, PROPERTY_FEED));
    await contactScope(page).locator("[data-tk=tour]").click();
    const note = page.getByRole("status").filter({ hasText: "Sign in to request a live video tour." });
    await expect(note).toBeVisible();
    await expect(note.getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await expect(page.locator("[data-tk=ad-popup] form")).toBeVisible();
  });

  test("a signed-in visitor without coins is told by the server, and no request is sent", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "tourless");
    await api.dispose();
    await signInUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    const path = await anyAdPath(page, PROPERTY_FEED);
    await setSellerAvailable(slugFromAdPath(path), true);
    await page.goto(path);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/tours/request") && request.method() === "POST") requests.push(request.url());
    });
    // The popup asks for the balance when it opens. With the answer in, a visitor without coins is sent to Buy without any tour request;
    // clicking before it arrives sends the request and the server answers 402 (also fine, but then a request was sent).
    await contactScope(page).locator("[data-tk=tour]").click();
    const popup = page.locator("[data-tk=ad-popup]");
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("data-step", "call");
    // The balance tile shows "…" until the popup knows the balance.
    await expect(popup.locator(".tkn-pop-tile strong").nth(1)).not.toHaveText("…");
    await popup.locator(".tkn-pop-btn").click();
    await expect(popup).toHaveAttribute("data-step", "buy");
    await expect(page.getByRole("status").filter({ hasText: "Request sent" })).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("chat round trip: a buyer's message reaches the advertiser, and the reply comes back", async ({ page, baseURL }, info) => {
    test.setTimeout(240_000);
    const base = baseURL!;
    const advertiser = await newUserApi(base, "advertiser");
    const buyer = await newUserApi(base, "buyer");
    const buyerEmail = buyer.email;
    await buyer.api.dispose();

    // The advertiser must own the ad to answer it. The test makes its OWN ad (a copy of the first one, owned by the advertiser) instead of
    // moving a shared one: the phone and the desktop project run at the same time on two workers, and no other test may ever see this ad.
    const templatePath = await anyAdPath(page, PROPERTY_FEED);
    const templateSlug = templatePath.split("/").filter(Boolean)[1];
    const moved = await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email: advertiser.email.toLowerCase() }, { projection: { _id: 1 } });
      const template = await db.collection("listings").findOne({ slug: templateSlug });
      if (!user || !template) return null;
      const id = new ObjectId();
      const slug = `chat-roundtrip-${info.project.name}-${Date.now()}`;
      await db.collection("listings").insertOne({ ...withoutAddress(template), _id: id, slug, title: `Chat round trip ${Date.now()}`, ownerId: user._id });
      return { listingId: String(id), slug };
    });
    expect(moved, "the advertiser and the ad are in the test database").not.toBeNull();

    try {
      await signInUi(page, buyerEmail);
      await page.waitForURL(/\/u\/account\/dashboard\//);
      await page.goto(`/ad/${moved!.slug}/`);
      await contactScope(page).locator("[data-tk=chat]").click();
      const panel = page.locator("[data-tk=chat-panel]");
      await expect(panel).toBeVisible();

      const outgoing = `Is the flat still free? ${Date.now()}`;
      await panel.getByLabel("Your message").fill(outgoing);
      await panel.locator("button[type=submit]").click();
      await expect(panel.getByRole("log").getByText(outgoing)).toBeVisible();

      // The advertiser sees the message in their inbox.
      let conversationId = "";
      await expect
        .poll(
          async () => {
            const inbox = await advertiser.api.get("/api/chat/conversations");
            const rows = ((await inbox.json()).data ?? []) as { id: string; listingId: string }[];
            conversationId = rows.find((row) => row.listingId === moved!.listingId)?.id ?? "";
            if (!conversationId) return [];
            const thread = await advertiser.api.get(`/api/chat/conversations/${conversationId}/messages`);
            const body = (await thread.json()) as { data: { messages: { text: string; mine: boolean }[] } };
            return body.data.messages.filter((message) => !message.mine).map((message) => message.text);
          },
          { timeout: 20_000 },
        )
        .toContain(outgoing);

      // The advertiser replies; the buyer's open panel shows the reply (it polls every few seconds).
      const reply = `Yes, viewings this week ${Date.now()}`;
      const sent = await advertiser.api.post(`/api/chat/conversations/${conversationId}/messages`, {
        headers: originHeaders(base, "/u/account/"),
        data: { text: reply },
      });
      expect(sent.ok(), await sent.text()).toBe(true);
      await expect(panel.getByRole("log").getByText(reply)).toBeVisible({ timeout: 20_000 });
    } finally {
      await withLocalDb((db) => db.collection("listings").deleteOne({ slug: moved!.slug }));
      await advertiser.api.dispose();
    }
  });
});

test.describe("H7.99b contact bar at tablet width (768 px)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("below 1024 px the contact card gives way to a bottom bar with the buttons side by side and no horizontal scroll", async ({ page }) => {
    const original = await readPropertyTourSwitch();
    await writePropertyTourSwitch({ enabled: true, coins: TOUR_COINS });
    try {
      await page.goto(await anyAdPath(page, PROPERTY_FEED));
      await expect(page.locator("h1")).toHaveCount(1);
      const bar = page.locator("[data-tk=bottom-bar]");
      await expect(bar).toBeVisible();
      await expect(page.locator("[data-tk=contact-card] [data-tk=call]")).toBeHidden();
      expect(await hasHorizontalScroll(page)).toBe(false);
      const boxes = await bar.locator(".tk-btn").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      );
      expect(boxes.length).toBeGreaterThanOrEqual(2);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
      expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
    } finally {
      await writePropertyTourSwitch(original);
    }
  });
});
