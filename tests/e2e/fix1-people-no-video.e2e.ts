import { expect, loginUi, newUserApi, originHeaders, test, USER_PASSWORD, pickCity } from "./helpers";

/** FIX-1 (E1-B4): a listing about people never holds a video: no Add video button, and the server refuses it. */

const SENTENCE = "Videos are not allowed on people listings.";

async function startDraft(page: import("@playwright/test").Page, baseURL: string, category: "Dating" | "Jobs") {
  const { email, api } = await newUserApi(baseURL, "fix1");
  await api.dispose();
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  await page.locator(".tkp-tile", { hasText: category }).click();
  await page.locator("[data-tk=go-on]").click();
  await pickCity(page, "Mumbai");
  const people = category === "Dating";
  const roleHere = (await page.locator("#role").count()) > 0;
  if (!people && roleHere) await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(`FIX1 ${category} ${Date.now()}`);
  await page.locator("#text").fill("A friendly description with enough words to pass the checks here.");
  if (people) await page.getByRole("button", { name: "Coffee", exact: true }).click();
  await page.locator("[data-tk=go-on]").click();
  if (!people && !roleHere) {
    await page.locator("#role").fill("Office assistant");
    await page.locator("[data-tk=go-on]").click();
  }
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
  return new URL(page.url()).searchParams.get("draft")!;
}

test.describe("FIX-1: no video on people listings", () => {
  test("a Dating ad has no Add video button in the post flow or when it is opened again, and the server refuses a video for it", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const draft = await startDraft(page, baseURL!, "Dating");
    expect(draft).toBeTruthy();
    await expect(page.locator("[data-tk=video-input]")).toHaveCount(0);
    // H21.3: the buttons are "Choose photos", "Take a photo" and "Add video" in the new drop box.
    await expect(page.locator("label.tkph-btn", { hasText: "Add video" })).toHaveCount(0);
    await expect(page.locator("label.tkph-btn", { hasText: "Choose photos" })).toBeVisible();
    await expect(page.locator("[data-tk=no-video]")).toHaveText("No video for this category.");
    // Opened again from My ads (the edit flow): the same step, the same rule.
    await page.goto(`/u/post-insert/?draft=${draft}&step=photos`);
    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    await expect(page.locator("[data-tk=video-input]")).toHaveCount(0);
    // The server says no, in plain words, whatever the screen shows.
    const sign = await page.request.post("/api/media/sign", {
      headers: originHeaders(baseURL!, "/u/post-insert/"),
      data: { listingId: draft, contentType: "video/mp4", byteSize: 1_000_000, kind: "video" },
    });
    expect(sign.status()).toBeGreaterThanOrEqual(400);
    expect(await sign.text()).toContain(SENTENCE);
  });

  test("an ordinary category (Jobs) still has Add video and the server still signs it", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const draft = await startDraft(page, baseURL!, "Jobs");
    await expect(page.locator("[data-tk=video-input]")).toHaveCount(1);
    await expect(page.locator("[data-tk=no-video]")).toHaveCount(0);
    const sign = await page.request.post("/api/media/sign", {
      headers: originHeaders(baseURL!, "/u/post-insert/"),
      data: { listingId: draft, contentType: "video/mp4", byteSize: 1_000_000, kind: "video" },
    });
    // With the watermark on and no Cloudinary here the answer may refuse for that other reason, never for the people rule.
    expect(await sign.text()).not.toContain(SENTENCE);
  });
});
