import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const purged = vi.hoisted(() => ({ paths: [] as string[], layouts: 0 }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    if (type === "layout") purged.layouts += 1;
    else purged.paths.push(path);
  },
  revalidateTag: () => undefined,
}));
import { expireDue, pauseListing, removeListing, renewListing, resumeListing } from "@/server/listings/service";
import { removeLiveAd } from "@/server/moderation/decide";
import { banUser } from "@/server/admin/user-actions";
import { Category, Listing, Location, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/**
 * H17.2: pages are stored for 300 seconds, so every way an ad leaves the public pages (or comes back)
 * must clear the ad's own page, its category, city and area pages and the home feed in the same request.
 */

const DAY = 86_400_000;
let ownerId: mongoose.Types.ObjectId;

async function liveAd(slug: string, extra: Record<string, unknown> = {}) {
  const category = (await Category.findOne({ slug: "cycles" })) ?? (await Category.create({ slug: "cycles", name: "Cycles", enabled: true, fields: [] }));
  const city = (await Location.findOne({ slug: "pune" })) ?? (await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true }));
  return Listing.create({
    ownerId,
    categoryId: category._id,
    cityId: city._id,
    title: `Ad ${slug}`,
    description: "A description that is long enough",
    slug,
    status: "active",
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + DAY),
    ...extra,
  });
}

function expectCleared(slug: string) {
  expect(purged.layouts, "the home feed and every shared list are cleared").toBeGreaterThan(0);
  expect(purged.paths, "the ad page").toContain(`/ad/${slug}/`);
  expect(purged.paths, "the category page").toContain("/cycles/");
  expect(purged.paths, "the city page").toContain("/cycles/pune/");
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  purged.paths = [];
  purged.layouts = 0;
  ownerId = (await User.create({ email: `seller-${Date.now()}@example.com`, passwordHash: "x", displayName: "Seller", roles: ["user"], status: "active" }))._id as mongoose.Types.ObjectId;
});

describe("an ad that leaves or returns is cleared from every stored page at once", () => {
  it("seller pauses", async () => {
    const ad = await liveAd("pause-me");
    await pauseListing(String(ad._id), String(ownerId), "req-1");
    expectCleared("pause-me");
  });

  it("seller deletes", async () => {
    const ad = await liveAd("delete-me");
    await removeListing(String(ad._id), String(ownerId), "req-2");
    expectCleared("delete-me");
  });

  it("seller resumes and renews", async () => {
    const paused = await liveAd("resume-me", { status: "paused" });
    await resumeListing(String(paused._id), String(ownerId), "req-3");
    expectCleared("resume-me");
    purged.paths = [];
    purged.layouts = 0;
    const ended = await liveAd("renew-me", { status: "expired", expiresAt: new Date(Date.now() - DAY) });
    await renewListing(String(ended._id), String(ownerId), "req-4");
    expectCleared("renew-me");
  });

  it("the expiry job clears every ad it ends", async () => {
    await liveAd("old-1", { expiresAt: new Date(Date.now() - DAY) });
    await liveAd("old-2", { expiresAt: new Date(Date.now() - 2 * DAY) });
    await liveAd("still-live");
    const result = await expireDue("req-5");
    expect(result.expired).toBe(2);
    expectCleared("old-1");
    expect(purged.paths).toContain("/ad/old-2/");
    expect(purged.paths).not.toContain("/ad/still-live/");
  });

  it("admin removes a live ad", async () => {
    const ad = await liveAd("admin-remove");
    await removeLiveAd({ id: String(ad._id), roles: ["admin"], email: "admin@example.com", reason: "Breaks the posting rules", refund: false });
    expectCleared("admin-remove");
  });

  it("admin bans the seller, so every ad of the seller is paused and cleared", async () => {
    await liveAd("banned-1");
    await liveAd("banned-2");
    const staff = { actorId: String(new mongoose.Types.ObjectId()), email: "boss@example.test", roles: ["superadmin"], requestId: "req-6" };
    await banUser(staff, { userId: String(ownerId), reason: "Breaks the rules" });
    expectCleared("banned-1");
    expect(purged.paths).toContain("/ad/banned-2/");
  });
});
