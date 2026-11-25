import { mkdirSync } from "node:fs";
import { expect, hasHorizontalScroll, realAdPath, test, withLocalDb } from "./helpers";

/** H21.5b: an ad whose owner turned video calls off shows no video call button. */

test("an ad with video calls off shows no video call button", async ({ page }) => {
  const path = await realAdPath(page, "/property/bengaluru/");
  const slug = path.replace(/^\/ad\//, "").replace(/\/$/, "");
  await withLocalDb((db) => db.collection("listings").updateOne({ slug }, { $set: { videoCallsOff: true } }));
  try {
    await page.goto(path);
    await expect(page.locator('[data-tk="contact-card"], .tkn-contact-panel').first()).toBeAttached();
    await expect(page.locator('[data-tk="tour"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    mkdirSync(".shots/H21.5b", { recursive: true });
    await page.screenshot({ path: `.shots/H21.5b/ad-video-off-${page.viewportSize()?.width}.png` });
  } finally {
    await withLocalDb((db) => db.collection("listings").updateOne({ slug }, { $set: { videoCallsOff: false } }));
  }
});
