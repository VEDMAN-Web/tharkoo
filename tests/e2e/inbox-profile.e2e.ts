import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { adAddressPattern, becomeSeller, expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, originHeaders, test, withLocalDb } from "./helpers";

const SHOTS = process.env.POST_SHOTS ?? "";

async function liveAd(api: APIRequestContext, base: string, slug: string, title: string) {
  const categories = (await (await api.get("/api/categories")).json()).data.categories as { _id: string }[];
  const cities = (await (await api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  for (const category of categories) {
    const res = await api.post("/api/listings", {
      headers: originHeaders(base, "/u/post-insert/"),
      data: { categoryId: category._id, cityId: city.id, title, description: "A wooden desk in good condition for the whole family." },
    });
    if (res.status() === 201) {
      const id = ((await res.json()).data as { id: string }).id;
      const { ObjectId } = await import("mongodb");
      await withLocalDb((db) => db.collection("listings").updateOne({ _id: new ObjectId(id) }, { $set: { status: "active", slug, price: 4500, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } }));
      return id;
    }
  }
  throw new Error("No category accepted a draft ad");
}

async function serious(page: Page) {
  const found = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  for (const [width, height] of [[1536, 674], [1366, 768], [390, 844]] as [number, number][]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${SHOTS}/h7-82-${name}-${width}x${height}.png` });
  }
}

test.describe("H7.82 chats and the profile card", () => {
  test("a chat row shows the ad picture, the person, the last text, the time and an unread dot; opening it shows the ad card", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const slug = `inbox-desk-${Date.now()}`;
    const title = `Inbox desk ${Date.now()}`;
    const owner = await newUserApi(baseURL!, "inboxowner");
    const listingId = await liveAd(owner.api, baseURL!, slug, title);
    const buyer = await newUserApi(baseURL!, "inboxbuyer");
    const started = await buyer.api.post("/api/chat/conversations", { headers: originHeaders(baseURL!, "/"), data: { listingId } });
    expect(started.status(), await started.text()).toBeLessThan(300);
    const conversationId = ((await started.json()).data as { conversationId: string }).conversationId;
    const sent = await buyer.api.post(`/api/chat/conversations/${conversationId}/messages`, { headers: originHeaders(baseURL!, "/"), data: { text: "Is it still available?" } });
    expect(sent.status(), await sent.text()).toBeLessThan(300);

    await loginUi(page, owner.email, undefined, "/u/account/messages/");
    const row = page.locator("[data-tk=chat-row]");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("E2E");
    await expect(row).toContainText(title);
    await expect(row).toContainText("Is it still available?");
    await expect(row.locator(".up-chat-time")).toHaveText(/^(Now|\d+ min)$/);
    await expect(row.locator("[data-tk=chat-unread]")).toBeVisible();
    await expect(row.locator(".up-chat-thumb")).toBeVisible();
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(64);
    await expect(page.getByText(/seller|buyer|vendor/i)).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shots(page, "inbox");
    await page.setViewportSize(isPhone(page) ? { width: 390, height: 844 } : { width: 1440, height: 900 });

    await row.click();
    await expect(page.locator("[data-tk=chat-thread]")).toBeVisible();
    await expect(page.locator("[data-tk=chat-ad-card] [data-tk=mini-ad-link]")).toHaveAttribute("href", await adAddressPattern(slug));
    await expect(page.getByText("View ad", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-tk=chat-thread] [role=log]")).toContainText("Is it still available?");
    if (isPhone(page)) {
      await expect(page.locator("[data-tk=chat-back]")).toBeVisible();
      await expect(row).toBeHidden();
      await page.locator("[data-tk=chat-back]").click();
      await expect(row).toBeVisible();
    } else {
      await expect(page.locator("[data-tk=chat-back]")).toBeHidden();
      await expect(row).toBeVisible();
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await row.click();
    expect(await serious(page)).toEqual([]);
    await shots(page, "thread");
    // H14.2: the whole ad card in the thread header opens the ad (photo, price and the empty space as well as the title); it shows the price.
    const adCard = page.locator("[data-tk=chat-ad-card]");
    await expect(adCard).toContainText("₹4,500");
    // A real mouse click on the photo: the stretched title link is over it, which is the point (Playwright's own click refuses a covered target).
    const photo = (await adCard.locator(".tk-mini-ad-photo").boundingBox())!;
    await page.mouse.click(photo.x + photo.width / 2, photo.y + photo.height / 2);
    await expect(page).toHaveURL(await adAddressPattern(slug));
    await buyer.api.dispose();
    await owner.api.dispose();
  });

  test("the account home shows Your profile with a percent and the first three missing steps as links", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const owner = await newUserApi(baseURL!, "profilecard");
    await liveAd(owner.api, baseURL!, `profile-desk-${Date.now()}`, `Profile desk ${Date.now()}`);
    await loginUi(page, owner.email, undefined, "/u/account/");
    await expect(page.locator("[data-tk=profile-card]")).toHaveCount(0);
    await becomeSeller(page, baseURL!);
    await page.goto("/u/account/");
    const card = page.locator("[data-tk=profile-card]");
    await expect(card).toBeVisible();
    await expect(card.locator("[data-tk=profile-percent]")).toHaveText("50%");
    await expect(card).toContainText("Advertisers with a full profile get more replies.");
    await expect(card.locator("[data-tk=profile-step]")).toHaveText(["Add your WhatsApp number", "Check your ID", "Turn on live chat"]);
    await expect(card.locator("[data-tk=profile-step]").nth(1)).toHaveAttribute("href", "/u/account/kyc/");
    for (const step of await card.locator("[data-tk=profile-step]").all()) expect((await step.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(card.getByText(/seller|buyer|vendor/i)).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shots(page, "profile");
    await owner.api.dispose();
  });
});
