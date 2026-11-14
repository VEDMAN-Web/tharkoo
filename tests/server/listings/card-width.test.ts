import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CARD_WIDTH_LABELS, DEFAULT_CARD_WIDTH, cardWidthFrom } from "@/server/listings/card-width-config";
import { loadCardWidth, setCardWidth } from "@/server/listings/card-width";
import { AuditEvent } from "@/server/models/trust";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { id: new mongoose.Types.ObjectId().toHexString(), roles: ["admin"] };
const moderator = { id: new mongoose.Types.ObjectId().toHexString(), roles: ["moderator"] };

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

describe("H6.17 card width setting", () => {
  it("offers narrow 760, medium 880 (default) and full width, and falls back to medium", () => {
    expect(DEFAULT_CARD_WIDTH).toBe("medium");
    expect(Object.keys(CARD_WIDTH_LABELS)).toEqual(["narrow", "medium", "full"]);
    expect(CARD_WIDTH_LABELS.narrow).toContain("760");
    expect(CARD_WIDTH_LABELS.medium).toContain("880");
    expect(cardWidthFrom(undefined)).toBe("medium");
    expect(cardWidthFrom("huge")).toBe("medium");
    expect(cardWidthFrom("full")).toBe("full");
  });

  it("is medium until an admin changes it, then stores the new value with an audit row", async () => {
    expect(await loadCardWidth()).toBe("medium");
    await setCardWidth({ actor: admin, width: "narrow", requestId: "req-width-1" });
    expect(await loadCardWidth()).toBe("narrow");
    const row = await AuditEvent.findOne({ action: "listing_pages.card_width.update" }).lean();
    expect(row?.before).toEqual({ listingCardWidth: "medium" });
    expect(row?.after).toEqual({ listingCardWidth: "narrow" });
  });

  it("refuses staff who are not admins", async () => {
    await expect(setCardWidth({ actor: moderator, width: "full", requestId: "req-width-2" })).rejects.toThrow(/Only an admin/);
    expect(await loadCardWidth()).toBe("medium");
  });
});
