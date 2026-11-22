import AxeBuilder from "@axe-core/playwright";
import type { Browser } from "@playwright/test";
import { expect, freshIp, loginUi, newUserApi, setSellerAvailable, test, USER_PASSWORD } from "./helpers";
import { createLiveAd } from "./flows";

/** FIX-8 (E1-B9): the messages in a chat thread have at least 4.5:1 colour contrast, after a reply and after a block. */

async function visitor(browser: Browser, baseURL: string, size: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport: size, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  await context.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  return { context, page: await context.newPage() };
}

test("the chat thread has no serious colour-contrast problem after a reply and a block", async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const ad = await createLiveAd(page, baseURL!, "fix8");
  await setSellerAvailable(ad.adHref.replace(/^\/ad\//, "").replace(/\/$/, ""), true);
  const side = await visitor(browser, baseURL!, page.viewportSize() ?? { width: 1440, height: 900 });
  const user = await newUserApi(baseURL!, "fix8buyer");
  await user.api.dispose();
  await loginUi(side.page, user.email, USER_PASSWORD, "/");
  await side.page.goto(ad.adHref);
  await side.page.locator("[data-tk=chat]").filter({ visible: true }).first().click();
  const panel = side.page.locator("[data-tk=chat-panel]");
  await panel.locator("textarea").fill("Is this still open?");
  await panel.locator("button[type=submit]").click();
  await expect(panel.locator(".tkn-msg.is-mine")).toHaveCount(1);

  await page.goto("/u/account/messages/");
  await page.locator("[data-tk=chat-row]").first().click();
  const thread = page.locator("[data-tk=chat-thread]");
  await expect(thread).toContainText("Is this still open?");
  await thread.locator("textarea").fill("Yes, it is open");
  await thread.locator("button[type=submit]").click();
  await expect(thread).toContainText("Yes, it is open");

  const contrast = async () => {
    const result = await new AxeBuilder({ page }).include("[data-tk=chat-thread]").withRules(["color-contrast"]).analyze();
    return result.violations.flatMap((item) => item.nodes.map((node) => `${node.target.join(" ")}: ${node.any[0]?.message ?? ""}`));
  };
  expect(await contrast(), "after a reply").toEqual([]);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "End chat", exact: true }).first().click();
  await expect(thread.locator("textarea")).toBeDisabled();
  expect(await contrast(), "after a block").toEqual([]);
  await side.context.close();
});
