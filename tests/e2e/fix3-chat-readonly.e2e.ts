import type { Browser } from "@playwright/test";
import { expect, freshIp, hasHorizontalScroll, loginUi, newUserApi, originHeaders, setSellerAvailable, test, USER_PASSWORD } from "./helpers";
import { createLiveAd } from "./flows";

/** FIX-3 (E1-B7): a chat about an ad that is paused or removed is read-only: composer off, one line says why, the server says no. */

const SENTENCE = "This ad is no longer live, so you can read this chat but not reply.";
const CARD = ":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])";

async function buyerContext(browser: Browser, baseURL: string, size: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport: size, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  await context.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  const page = await context.newPage();
  const user = await newUserApi(baseURL, "fix3buyer");
  await user.api.dispose();
  await loginUi(page, user.email, USER_PASSWORD, "/");
  return { context, page };
}

test.describe("FIX-3: read-only chat for an ad that is not live", () => {
  test("paused then resumed, and then removed: the thread closes and opens as the ad does", async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "fix3");
    const slug = ad.adHref.replace(/^\/ad\//, "").replace(/\/$/, "");
    await setSellerAvailable(slug, true);
    const buyerSide = await buyerContext(browser, baseURL!, page.viewportSize() ?? { width: 1440, height: 900 });
    const buyer = buyerSide.page;

    await buyer.goto(ad.adHref);
    await buyer.locator("[data-tk=chat]").filter({ visible: true }).first().click();
    const panel = buyer.locator("[data-tk=chat-panel]");
    await panel.locator("textarea").fill("Is it still free?");
    await panel.locator("button[type=submit]").click();
    await expect(panel.locator(".tkn-msg.is-mine")).toHaveCount(1);

    const openThread = async () => {
      await buyer.goto("/u/account/messages/");
      await buyer.locator("[data-tk=chat-row]").first().click();
      return buyer.locator("[data-tk=chat-thread]");
    };
    const conversationId = async () => {
      const list = (await (await buyer.request.get("/api/chat/conversations")).json()).data as { id: string }[];
      return list[0].id;
    };

    // Live: the composer works.
    let thread = await openThread();
    await expect(thread.locator("textarea")).toBeEnabled();
    await expect(buyer.locator("[data-tk=chat-readonly]")).toHaveCount(0);

    // Paused: read-only with the reason, the server refuses with 403 and the sentence.
    await page.goto("/u/account/ads/");
    const card = page.locator(CARD).filter({ hasText: ad.title }).first();
    await card.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Paused.")).toBeVisible();
    thread = await openThread();
    await expect(thread).toContainText("Is it still free?");
    await expect(thread.locator("textarea")).toBeDisabled();
    await expect(buyer.locator("[data-tk=chat-readonly]")).toHaveText(SENTENCE);
    await expect(thread.locator("button[type=submit]")).toBeDisabled();
    const refused = await buyer.request.post(`/api/chat/conversations/${await conversationId()}/messages`, { headers: originHeaders(baseURL!, "/u/account/messages/"), data: { text: "Hello?" } });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain(SENTENCE);
    expect(await hasHorizontalScroll(buyer)).toBe(false);

    // Resumed: it writes again.
    await page.goto("/u/account/ads/");
    await page.locator(CARD).filter({ hasText: ad.title }).first().getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("Live again.")).toBeVisible();
    thread = await openThread();
    await expect(thread.locator("textarea")).toBeEnabled();
    await expect(buyer.locator("[data-tk=chat-readonly]")).toHaveCount(0);

    // Removed (deleted by its owner): read-only again.
    await page.goto("/u/account/ads/");
    const again = page.locator(CARD).filter({ hasText: ad.title }).first();
    await again.getByRole("button", { name: "Delete" }).click();
    await again.getByRole("button", { name: "Tap again to delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    thread = await openThread();
    await expect(thread.locator("textarea")).toBeDisabled();
    await expect(buyer.locator("[data-tk=chat-readonly]")).toHaveText(SENTENCE);
    await buyerSide.context.close();
  });
});
