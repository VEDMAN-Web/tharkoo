import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readOwnPresence, setOwnAvailable, touchOwnPresence } from "@/server/availability/service";
import { awayReason } from "@/server/availability/status";
import { VendorPresence } from "@/server/availability/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-15T10:00:00Z");
const uid = () => new mongoose.Types.ObjectId().toString();

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

describe("presence reason (H7.5 follow-up, relay #69)", () => {
  it("is auto when the switch is on but there was no recent activity", () => {
    expect(awayReason({ available: true, lastActivityAt: new Date(NOW - 3 * HOUR) }, NOW, 2)).toBe("auto");
  });

  it("is manual when the seller switched it off, even with recent activity", () => {
    expect(awayReason({ available: false, lastActivityAt: new Date(NOW) }, NOW, 2)).toBe("manual");
  });

  it("is null while Online", () => {
    expect(awayReason({ available: true, lastActivityAt: new Date(NOW - HOUR) }, NOW, 2)).toBeNull();
  });
});

describe("a seller starts Available now", () => {
  it("a seller with no presence record has the switch on, and is Away (auto) until first activity", async () => {
    const own = await readOwnPresence(uid(), new Date(NOW));
    expect(own.available).toBe(true);
    expect(own.status).toBe("away");
    expect(own.awayReason).toBe("auto");
  });

  it("activity (login, chat, panel visit) brings an auto-away seller back to Online", async () => {
    const userId = uid();
    await touchOwnPresence(userId, new Date(NOW));
    const own = await readOwnPresence(userId, new Date(NOW + HOUR));
    expect(own.available).toBe(true);
    expect(own.status).toBe("online");
    expect(own.callsAllowed).toBe(true);
  });

  it("goes Away (auto) once the idle hours pass, and activity brings it back", async () => {
    const userId = uid();
    await touchOwnPresence(userId, new Date(NOW));
    const later = new Date(NOW + 3 * HOUR);
    expect((await readOwnPresence(userId, later)).awayReason).toBe("auto");
    await touchOwnPresence(userId, later);
    expect((await readOwnPresence(userId, later)).status).toBe("online");
  });
});

describe("a manual off stays Away", () => {
  it("activity does not override a manual Away", async () => {
    const userId = uid();
    await setOwnAvailable(userId, false, new Date(NOW));
    await touchOwnPresence(userId, new Date(NOW + HOUR));
    const own = await readOwnPresence(userId, new Date(NOW + HOUR));
    expect(own.available).toBe(false);
    expect(own.status).toBe("away");
    expect(own.awayReason).toBe("manual");
  });

  it("switching back on returns the seller to Online", async () => {
    const userId = uid();
    await setOwnAvailable(userId, false, new Date(NOW));
    const own = await setOwnAvailable(userId, true, new Date(NOW + HOUR));
    expect(own.status).toBe("online");
    expect(await VendorPresence.countDocuments({ userId })).toBe(1);
  });
});
