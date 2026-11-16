import AxeBuilder from "@axe-core/playwright";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, loginUi, newUserApi, test, withLocalDb } from "./helpers";

const RULES = "Calls are for checking that the person or item is real. No nudity or sexual content. Report anything wrong with the Report button.";

async function acceptedTour(userId: string) {
  const id = new ObjectId();
  const made = await withLocalDb(async (db) => {
    const listing = await db.collection("listings").findOne({ status: "active", slug: { $exists: true } });
    if (!listing) return false;
    await db.collection("video_tours").insertOne({
      _id: id,
      listingId: listing._id,
      ownerId: listing.ownerId,
      userId: new ObjectId(userId),
      coins: 1,
      status: "accepted",
      requestedAt: new Date(),
      acceptedAt: new Date(),
      roomId: `mock_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return true;
  });
  expect(made).toBe(true);
  return String(id);
}

test.describe("H7.77 live video call page", () => {
  test("shows the rules before joining, a Report button, and passes axe", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "callpage");
    const me = await api.get("/api/auth/me");
    const userId = String((await me.json()).data.user.id);
    const tourId = await acceptedTour(userId);
    await loginUi(page, email, undefined, `/u/account/tours/${tourId}/`);
    await expect(page.getByRole("heading", { level: 1, name: "Live video call" })).toBeVisible();
    await expect(page.locator('[data-tk="call-rules"]')).toHaveText(RULES);
    const report = page.locator('[data-tk="call-report"]');
    await expect(report).toHaveAttribute("href", /^\/submit-report\/\?ad=.+/);
    expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("button", { name: "Join the call" })).toHaveCount(0);
    await expect(page.getByText("Video calls are not live yet. We will tell you when they open.")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id)).toEqual([]);
    await api.dispose();
  });

  test("a stranger gets a not found page", async ({ page, baseURL }) => {
    const owner = await newUserApi(baseURL!, "callowner");
    const me = await owner.api.get("/api/auth/me");
    const tourId = await acceptedTour(String((await me.json()).data.user.id));
    const stranger = await newUserApi(baseURL!, "callstranger");
    await loginUi(page, stranger.email, undefined, "/");
    const res = await page.goto(`/u/account/tours/${tourId}/`);
    expect(res?.status()).toBe(404);
    await owner.api.dispose();
    await stranger.api.dispose();
  });
});
