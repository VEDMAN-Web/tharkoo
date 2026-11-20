import type { Browser, Page } from "@playwright/test";
import { freshIp, loginUi, newUserApi, setSellerAvailable, USER_PASSWORD } from "./helpers";
import { createLiveAd } from "./flows";
import { expect, finalChecks, test } from "./e1-b-helpers";

/**
 * E1-B: two accounts talking (send, receive, unread badge, reply, block), the notifications page, and the seller dashboard
 * numbers moving after a buyer views and clicks (the owner's own visit is not counted).
 */

function sizeOf(page: Page) {
  return page.viewportSize() ?? { width: 1440, height: 900 };
}

async function visitorContext(browser: Browser, baseURL: string, size: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport: size, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  await context.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  return { context, page: await context.newPage() };
}

test.describe("E1-B two accounts and the dashboard", () => {
  test("chat: send, receive with the unread badge, reply, block makes it read-only, and the notifications page", async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "e1chat");
    const slug = ad.adHref.replace(/^\/ad\//, "").replace(/\/$/, "");
    await setSellerAvailable(slug, true);
    const seller = page;

    const buyerSide = await visitorContext(browser, baseURL!, sizeOf(page));
    const buyer = buyerSide.page;
    const user = await newUserApi(baseURL!, "e1buyer");
    await user.api.dispose();
    await loginUi(buyer, user.email, USER_PASSWORD, "/");

    await buyer.goto(ad.adHref);
    await buyer.locator("[data-tk=chat]").filter({ visible: true }).first().click();
    const panel = buyer.locator("[data-tk=chat-panel]");
    await expect(panel).toBeVisible();
    await panel.locator("textarea").fill("Is this still open?");
    await panel.locator("button[type=submit]").click();
    await expect(panel.locator(".tkn-msg.is-mine")).toHaveCount(1);

    // The advertiser: the header badge, the inbox row (unread), then the reply.
    await seller.goto("/u/account/messages/");
    await expect(seller.locator("[data-tk=header-unread]")).toBeVisible({ timeout: 40_000 });
    const row = seller.locator("[data-tk=chat-row][data-unread=yes]").first();
    await expect(row).toBeVisible();
    await row.click();
    const thread = seller.locator("[data-tk=chat-thread]");
    await expect(thread).toContainText("Is this still open?");
    await thread.locator("textarea").fill("Yes, it is open");
    await thread.locator("button[type=submit]").click();
    await expect(thread).toContainText("Yes, it is open");
    await expect(panel).toContainText("Yes, it is open", { timeout: 20_000 });

    // The notifications page of the advertiser names the chat.
    await seller.goto("/u/account/notifications/");
    await expect(seller.locator("main")).not.toContainText("No notifications yet");

    // Block: the composer closes for both sides.
    await seller.goto("/u/account/messages/");
    await seller.locator("[data-tk=chat-row]").first().click();
    await seller.getByRole("button", { name: "Block", exact: true }).first().click();
    await seller.getByRole("dialog", { name: "Block this person?" }).getByRole("button", { name: "Block", exact: true }).click();
    await expect(seller.locator("[data-tk=chat-thread] textarea")).toBeDisabled();
    await expect(seller.locator("[data-tk=chat-thread] textarea")).toHaveAttribute("placeholder", "This conversation is blocked");
    await buyer.goto("/u/account/messages/");
    await buyer.locator("[data-tk=chat-row]").first().click();
    await expect(buyer.locator("[data-tk=chat-thread] textarea")).toBeDisabled();

    await expect(seller.locator("h1")).toHaveCount(1);
    await buyerSide.context.close();
  });

  test("dashboard numbers: one view and one click from a buyer move them, the owner's own visit does not", async ({ page, browser, baseURL }) => {
    test.setTimeout(360_000);
    const ad = await createLiveAd(page, baseURL!, "e1dash");
    const number = async (tk: string) => Number(((await page.locator(`[data-tk=${tk}]`).first().innerText()).replace(/[^\d]/g, "")) || "0");

    // The owner opens the ad and the dashboard: nothing counts.
    await page.goto(ad.adHref);
    await page.waitForTimeout(2500);
    await page.goto("/u/account/dashboard/");
    await expect(page.locator("[data-tk=tile-views-value]")).toBeVisible();
    expect(await number("tile-views-value"), "the owner's own visit is not a view").toBe(0);
    expect(await number("tile-clicks-value")).toBe(0);

    // A buyer (a new visitor) opens the ad: one view; and sends one click event, as a click on the card does.
    const buyerSide = await visitorContext(browser, baseURL!, sizeOf(page));
    const buyer = buyerSide.page;
    await buyer.goto(ad.adHref);
    await buyer.waitForTimeout(2500);
    const slug = ad.adHref.replace(/^\/ad\//, "").replace(/\/$/, "");
    const click = await buyer.request.post("/api/views/", { headers: { origin: baseURL!, referer: `${baseURL}${ad.adHref}` }, data: { events: [{ slug, type: "click" }] } });
    expect(click.ok(), await click.text()).toBe(true);
    await buyerSide.context.close();

    await expect
      .poll(
        async () => {
          await page.goto("/u/account/dashboard/");
          return `${await number("tile-views-value")}/${await number("tile-clicks-value")}`;
        },
        { timeout: 60_000, intervals: [3_000] },
      )
      .toBe("1/1");
    await expect(page.locator("[data-tk=dash-ad]").first().locator("[data-tk=ad-views]")).toContainText("1");
    await finalChecks(page);
  });
});
