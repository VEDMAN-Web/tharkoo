import { mkdirSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, newUserApi, originHeaders, PNG, setRoles, test } from "./helpers";

const SHOTS = ".shots/support";

/** Elements whose right edge is past the viewport. Used to name the cause when a page scrolls sideways. */
async function wideElements(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 10)
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.getAttribute("class") || "").split(" ")[0]} right=${Math.round(element.getBoundingClientRect().right)}`),
  );
}

async function shot(page: Page, project: string, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png`, fullPage: true });
}

/** Signs a browser context in with an API session's cookies, the same way the admin helper does. */
async function signIn(context: BrowserContext, cookies: Parameters<BrowserContext["addCookies"]>[0]) {
  await context.addCookies(cookies);
}

test("support ticket: create, reply, staff reply and note, close, reopen", async ({ page, browser, baseURL }, testInfo) => {
  const project = testInfo.project.name;
  const subject = `Ad will not publish ${Date.now()}`;

  // One customer and one support agent, each with a real session.
  const owner = await newUserApi(baseURL!, "support-owner");
  const agent = await newUserApi(baseURL!, "support-agent");
  await setRoles(agent.email, ["support"]);
  const ownerState = await owner.api.storageState();
  await signIn(page.context(), ownerState.cookies);

  // 1. Empty list, then create a ticket with a screenshot.
  await page.goto("/u/account/support/");
  await expect(page.getByRole("heading", { level: 1, name: "Help and support" })).toBeVisible();
  await page.getByRole("link", { name: "New ticket" }).first().click();
  await page.waitForURL("**/u/account/support/new/");
  await page.locator("#support-topic").selectOption("my_ads");
  await page.locator("#support-subject").fill(subject);
  await page.locator("#support-body").fill("I press publish and nothing happens on my ad.");
  await page.locator("#support-screenshots").setInputFiles({ name: "screen.png", mimeType: "image/png", buffer: PNG });
  await shot(page, project, "01-new-ticket");
  expect(await hasHorizontalScroll(page)).toBe(false);
  await page.getByRole("button", { name: "Send ticket" }).click();
  await page.waitForURL(/\/u\/account\/support\/[a-f0-9]{24}\/$/);
  const ticketId = new URL(page.url()).pathname.split("/").filter(Boolean).pop() as string;

  // 2. The customer sees the ticket and the screenshot, and replies.
  await expect(page.getByRole("heading", { name: new RegExp(subject) })).toBeVisible();
  await expect(page.locator("img[alt='Screenshot 1']")).toBeVisible();
  await page.locator("#ticket-reply").fill("Here is the same screen again.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Here is the same screen again.")).toBeVisible();
  await shot(page, project, "02-customer-thread");
  expect(await hasHorizontalScroll(page)).toBe(false);

  // 3. Support replies publicly and leaves an internal note (API calls, with the agent's session).
  const reply = await agent.api.post(`/api/admin/support/tickets/${ticketId}/messages`, {
    headers: originHeaders(baseURL!, "/admin/support/"),
    data: { body: "Please clear the cache and try again.", internal: false },
  });
  expect(reply.status(), await reply.text()).toBe(200);
  const note = await agent.api.post(`/api/admin/support/tickets/${ticketId}/messages`, {
    headers: originHeaders(baseURL!, "/admin/support/"),
    data: { body: "Secret internal note about the ad limit", internal: true },
  });
  expect(note.status(), await note.text()).toBe(200);

  await page.reload();
  await expect(page.getByText("Please clear the cache and try again.")).toBeVisible();
  await expect(page.getByText("Secret internal note")).toHaveCount(0);

  // 4. The agent opens the desk, sees the note, and closes the ticket.
  const agentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await agentContext.addInitScript(() => {
    localStorage.setItem("nl-age", "ok");
    localStorage.setItem("nl-cookies", "necessary");
  });
  await signIn(agentContext, (await agent.api.storageState()).cookies);
  const desk = await agentContext.newPage();
  // The agent has already answered, so the ticket waits on the customer: it sits under "Waiting on user" (H8.43).
  await desk.goto("/admin/support/?tab=waiting");
  await expect(desk.locator("[data-tk=desk-row]", { hasText: subject })).toBeVisible();
  await shot(desk, project, "03-desk-queue");
  expect(await hasHorizontalScroll(desk)).toBe(false);
  // H8.43: a row opens the three-pane desk; this spec keeps working on the full ticket page, which still exists.
  await desk.locator("[data-tk=desk-row]", { hasText: subject }).click();
  await desk.waitForURL(`**/admin/support/?tab=waiting&ticket=${ticketId}`);
  await desk.goto(`/admin/support/${ticketId}/`);
  await expect(desk.getByText("Secret internal note about the ad limit")).toBeVisible();
  await desk.getByRole("button", { name: "Close ticket" }).click();
  await desk.getByRole("button", { name: "Confirm close" }).click();
  await expect(desk.locator("[data-tk=ticket-status][data-status=closed]")).toBeVisible();
  await shot(desk, project, "04-desk-closed");
  expect(await wideElements(desk), "elements wider than the viewport").toEqual([]);
  expect(await hasHorizontalScroll(desk)).toBe(false);

  // 5. The customer can read a closed ticket but not reply. The customer has no close button.
  await page.reload();
  await expect(page.getByText("This ticket is closed. You can read it, but you cannot reply.")).toBeVisible();
  await expect(page.locator("#ticket-reply")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open a new ticket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close ticket" })).toHaveCount(0);
  await shot(page, project, "05-customer-closed");
  expect(await hasHorizontalScroll(page)).toBe(false);

  // 6. The agent reopens it and the customer can reply again.
  await desk.reload();
  await desk.getByRole("button", { name: "Reopen ticket" }).click();
  await expect(desk.locator("[data-tk=ticket-status][data-status=open]")).toBeVisible();
  await page.reload();
  await page.locator("#ticket-reply").fill("Thanks, it is open again. It still fails.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Thanks, it is open again. It still fails.")).toBeVisible();
  await shot(page, project, "06-reopened");
  await agentContext.close();
});
