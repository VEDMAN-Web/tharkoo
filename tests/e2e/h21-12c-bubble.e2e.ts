import { expect, loginUi, newUserApi, test } from "./helpers";

/** H21.12c: below 1024 px the floating support bubble is hidden on the post-ad screens (an in-page help link stays); on a computer it is there. */

test.describe("H21.12c the support bubble on post an ad", () => {
  test("hidden at 390 and 768 with a help link in the page, visible at 1440", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const user = await newUserApi(baseURL!, "h2112c");
    await loginUi(page, user.email, undefined, "/u/post-insert/");
    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/u/post-insert/");
      await expect(page.locator(".tkp-tile").first()).toBeVisible();
      await expect(page.locator("[data-tk=post-logo] img")).toBeVisible();
      const bubble = page.locator(".tkn-chat-bubble");
      if (width < 1024) {
        await expect(bubble).toBeHidden();
        await expect(page.locator("[data-tk=step-help-link]")).toBeVisible();
      } else {
        await expect(bubble).toBeVisible();
        await expect(page.locator("[data-tk=step-help-link]")).toBeHidden();
        // As the design board: the credit pill, then "Save draft and exit" at the far right.
        const pill = (await page.locator("[data-tk=header-credit-pill]").boundingBox())!;
        const exit = (await page.locator("[data-tk=exit-post]").boundingBox())!;
        expect(exit.x).toBeGreaterThanOrEqual(pill.x + pill.width);
      }
    }
    await user.api.dispose();
  });
});
