import { adminApi, expect, loginUi, newUserApi, originHeaders, PNG, test, USER_PASSWORD } from "./helpers";
import { createLiveAd } from "./flows";

/** FIX-6 (E1-B1, E1-B3, E1-B8): the live chat step opens Settings, Change name speaks plainly, Settings shows the real identity status. */

async function decide(baseURL: string, email: string, decision: "approved" | "rejected") {
  const admin = await adminApi(baseURL);
  const queue = await admin.get("/api/admin/verifications/?page=1&pageSize=100");
  const items = ((await queue.json()).data?.items ?? []) as { id: string }[];
  const mine = items.find((item) => JSON.stringify(item).includes(email)) ?? items[items.length - 1];
  const res = await admin.post(`/api/admin/verifications/${mine.id}/decision/`, { headers: originHeaders(baseURL, "/admin/"), data: { decision, reason: "E2E decision" } });
  expect(res.status(), await res.text()).toBe(200);
  await admin.dispose();
}

async function sendId(page: import("@playwright/test").Page) {
  await page.goto("/u/account/kyc/");
  await page.locator("#front-id").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
  await page.locator("#selfie-id").setInputFiles({ name: "selfie.png", mimeType: "image/png", buffer: PNG });
  await page.locator("[data-tk=kyc-submit]").click();
  await expect(page.locator("[data-tk=kyc-note]")).toContainText(/review/i);
}

test.describe("FIX-6: profile and settings text and links", () => {
  test("E1-B1: Turn on live chat in Your profile opens Settings, where the chat switches are", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await createLiveAd(page, baseURL!, "fix6chat");
    await page.goto("/u/account/dashboard/");
    const step = page.locator('[data-tk="profile-step"]', { hasText: "Turn on live chat" });
    await expect(step).toHaveAttribute("href", "/u/account/edit-account/");
    await step.click();
    await page.waitForURL(/\/u\/account\/edit-account\//);
    await expect(page.locator('[data-tk="chat-availability"]')).toBeVisible();
  });

  test("E1-B3: saving the name without a city says Choose your city in plain words", async ({ page, baseURL }) => {
    const { email, api } = await newUserApi(baseURL!, "fix6city");
    await api.dispose();
    await loginUi(page, email, USER_PASSWORD, "/u/seller-profile/?next=/u/account/edit-account/");
    await page.locator("input[name=name]").fill("Some Name");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.locator("#tk-sp-city-err")).toHaveText("Choose your city.");
    await expect(page.locator("main")).not.toContainText(/expected string|>=\s*2|Too small/i);
  });

  test("E1-B8: Settings reads the real identity status: needed, being checked, verified, needs another look", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const line = page.locator('[data-tk="setting-id-line"]');
    const approved = await newUserApi(baseURL!, "fix6ok");
    await approved.api.dispose();
    await loginUi(page, approved.email, USER_PASSWORD, "/u/account/edit-account/");
    await expect(line).toHaveText("Needed for some categories");
    await sendId(page);
    await page.goto("/u/account/edit-account/");
    await expect(line).toHaveText("Being checked");
    await decide(baseURL!, approved.email, "approved");
    await page.goto("/u/account/edit-account/");
    await expect(line).toHaveText("Verified");

    const refused = await newUserApi(baseURL!, "fix6no");
    await refused.api.dispose();
    await page.context().clearCookies();
    await loginUi(page, refused.email, USER_PASSWORD, "/u/account/kyc/");
    await sendId(page);
    await decide(baseURL!, refused.email, "rejected");
    await page.goto("/u/account/edit-account/");
    await expect(line).toHaveText("Needs another look");
  });
});
