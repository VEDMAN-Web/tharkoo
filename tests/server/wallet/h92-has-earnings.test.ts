import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Listing } from "@/server/models";
import { listOwnCards } from "@/server/listings/owner-cards";
import { hasEarnings } from "@/server/wallet/has-earnings";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { earn } from "./payout-helpers";

const oid = () => new mongoose.Types.ObjectId();
const HOUR = 3_600_000;

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
});

describe("H9.2 Withdraw only with earnings", () => {
  it("is false for an advertiser who has earned nothing, and true once credits are earned", async () => {
    const id = String(oid());
    expect(await hasEarnings(id)).toBe(false);
    await earn(id, 12);
    expect(await hasEarnings(id)).toBe(true);
    expect(await hasEarnings(String(oid()))).toBe(false);
  });
});

describe("H9.2 the ads that end soon", () => {
  it("counts live ads that end within the last day of their run, and no others", async () => {
    const owner = oid();
    const ad = (slug: string, extra: Record<string, unknown>) => Listing.create({ ownerId: owner, categoryId: oid(), title: `Ad ${slug}`, description: "A description that is long enough", slug, status: "active", ...extra });
    await ad("ends-in-2h", { expiresAt: new Date(Date.now() + 2 * HOUR) });
    await ad("ends-in-30h", { expiresAt: new Date(Date.now() + 30 * HOUR) });
    await ad("no-end", {});
    await ad("in-review", { status: "pending", expiresAt: new Date(Date.now() + HOUR) });
    const cards = await listOwnCards(String(owner), { page: 1, pageSize: 6 });
    expect(cards.counts).toMatchObject({ all: 4, live: 3, review: 1, endingSoon: 1 });
  });
});
