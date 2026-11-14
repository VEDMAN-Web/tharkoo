import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, firstAdPath, hasHorizontalScroll, isPhone, newUserApi, originHeaders, test, USER_PASSWORD, withLocalDb } from "./helpers";

/**
 * Signs in through the password form. The login page has two LOG IN buttons (password and phone code),
 * so the button is scoped to the form that holds the password field.
 */
async function signInUi(page: Page, email: string) {
  await page.goto("/u/login/");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(USER_PASSWORD);
  await page.locator("form", { has: page.locator("#password") }).getByRole("button", { name: "LOG IN", exact: true }).click();
  await page.waitForURL(/\/u\/account\/dashboard\//);
}

// H6.8: the ad page contact card (desktop sidebar) and the mobile sticky bar.
// Dating ad (people category): Call, WhatsApp, Chat online now.
// Property ad with live tours on: the same three, then "Video call and verify, N coins".
// The tour switch is turned on in the in-memory test database for this file only, and put back afterwards.
// The seed data, production and the people guard are not touched.

const DATING_FEED = "/dating/bengaluru/";
const PROPERTY_FEED = "/property/bengaluru/";
const TOUR_COINS = 2;
const BASE_LABELS = ["Call", "WhatsApp", "Chat online now"];
const TOUR_LABEL = `Video call and verify, ${TOUR_COINS} coins`;

/** The first ad on a city feed. (firstAdPath needs a super-top card, which the property feed may not have.) */
async function anyAdPath(page: Page, feed: string) {
  await page.goto(feed);
  const link = page.locator("[data-tk=card] a[href*=\"/ad/\"]").first();
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
  test("three contact buttons: Call, WhatsApp, Chat online now", async ({ page }) => {
    await page.goto(await firstAdPath(page, DATING_FEED));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await buttonLabels(page)).toEqual(BASE_LABELS);
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

  test("four contact buttons in order, the video call last", async ({ page }) => {
    await page.goto(await anyAdPath(page, PROPERTY_FEED));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await buttonLabels(page)).toEqual([...BASE_LABELS, TOUR_LABEL]);
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
    await page.locator("[data-tk=tour]:visible").click();
    const note = page.getByRole("status").filter({ hasText: "Sign in to request a live video tour." });
    await expect(note).toBeVisible();
    await expect(note.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /^\/u\/login\/\?next=/);
  });

  test("a signed-in visitor without coins is told by the server, and no request is sent", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "tourless");
    await api.dispose();
    await signInUi(page, email);
    await page.waitForURL(/\/u\/account\/dashboard\//);
    await page.goto(await anyAdPath(page, PROPERTY_FEED));
    const asked = page.waitForResponse((r) => r.url().includes("/api/tours/request") && r.request().method() === "POST");
    await page.locator("[data-tk=tour]:visible").click();
    expect((await asked).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByRole("status").filter({ hasText: "Request sent" })).toHaveCount(0);
    await expect(page.locator("[data-tk=tour]:visible")).toBeEnabled();
  });

  test("chat round trip: a buyer's message reaches the advertiser, and the reply comes back", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const base = baseURL!;
    const advertiser = await newUserApi(base, "advertiser");
    const buyer = await newUserApi(base, "buyer");
    const buyerEmail = buyer.email;
    await buyer.api.dispose();

    const adPath = await anyAdPath(page, PROPERTY_FEED);
    const slug = adPath.split("/").filter(Boolean)[1];
    // The advertiser must own the ad to answer it: move the ad to the second test user in the test database.
    const moved = await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email: advertiser.email.toLowerCase() }, { projection: { _id: 1 } });
      const listing = await db.collection("listings").findOne({ slug }, { projection: { ownerId: 1 } });
      if (!user || !listing) return null;
      await db.collection("listings").updateOne({ _id: listing._id }, { $set: { ownerId: user._id } });
      return { listingId: String(listing._id), previousOwner: listing.ownerId as ObjectId };
    });
    expect(moved, "the advertiser and the ad are in the test database").not.toBeNull();

    try {
      await signInUi(page, buyerEmail);
      await page.waitForURL(/\/u\/account\/dashboard\//);
      await page.goto(adPath);
      await page.locator("[data-tk=chat]:visible").click();
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
      await withLocalDb((db) =>
        db.collection("listings").updateOne({ slug }, { $set: { ownerId: moved!.previousOwner } }),
      );
      await advertiser.api.dispose();
    }
  });
});

test.describe("H6.8 contact card at tablet width (768 px)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("the contact card shows the four buttons in two columns, with no horizontal scroll", async ({ page }) => {
    const original = await readPropertyTourSwitch();
    await writePropertyTourSwitch({ enabled: true, coins: TOUR_COINS });
    try {
      await page.goto(await anyAdPath(page, PROPERTY_FEED));
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("[data-tk=contact-card]")).toBeVisible();
      expect(await buttonLabels(page)).toEqual([...BASE_LABELS, TOUR_LABEL]);
      expect(await hasHorizontalScroll(page)).toBe(false);
      const boxes = await expectTapTargets(page);
      const tops = new Set(boxes.map((box) => Math.round(box.y)));
      expect(tops.size).toBe(2);
    } finally {
      await writePropertyTourSwitch(original);
    }
  });
});
