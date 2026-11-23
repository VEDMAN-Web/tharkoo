import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LOCK_KIND, LOCK_NO_KIND, LOCK_PEOPLE, COIN_MIN, isCoinPrice, lockOf, shareLine } from "@/app/admin/settings/video-tours/shared";
import { AuditEvent, Category, Site } from "@/server/models";
import { loadCategoriesScreen } from "@/server/categories/screen";
import { listVideoTourCategories, updateVideoTourSettings } from "@/server/tours/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H19.8: the video call switch and price inside the category form and on the Video tours page are one value with one set of rules. */

const req = "req-h198";
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

async function category(slug: string, kind: string, extra: Record<string, unknown> = {}) {
  const doc = await Category.create({ slug, name: slug, kind, ...extra });
  return String(doc._id);
}

describe("the help line reads the share from the setting", () => {
  it("says 70 and 30 at the default and follows a change", async () => {
    expect(shareLine(30)).toBe("Users pay this per call. The vendor keeps 70 %, Tharkoo keeps 30 %.");
    expect(shareLine(45)).toBe("Users pay this per call. The vendor keeps 55 %, Tharkoo keeps 45 %.");
    await category("cars", "goods");
    expect((await loadCategoriesScreen("cars")).sharePercent).toBe(30);
    await Site.updateOne({ key: "default" }, { $set: { videoCallSharePercent: 45 } }, { upsert: true });
    expect((await loadCategoriesScreen("cars")).sharePercent).toBe(45);
  });
});

describe("one value for the Video tours page and the category form", () => {
  it("a category saved through the shared rules shows the same switch and price in both places", async () => {
    const id = await category("cars", "goods");
    const saved = await updateVideoTourSettings({ actorId: uid(), roles: ["superadmin"], categoryId: id, enabled: true, coins: 25, requestId: req });
    expect(saved).toMatchObject({ videoTourEnabled: true, videoTourCoins: 25 });
    const screen = (await loadCategoriesScreen("cars")).detail!;
    expect(screen.video).toMatchObject({ enabled: true, coins: 25, peopleLocked: false });
    const page = (await listVideoTourCategories()).find((row) => row.id === id)!;
    expect(page).toMatchObject({ videoTourEnabled: true, videoTourCoins: 25 });
    expect(await AuditEvent.countDocuments({ action: "video_tours.settings.update" })).toBe(1);
  });

  it("an older price below the floor shows as the floor in the form", async () => {
    await category("cars", "goods", { videoTourCoins: 3 });
    expect((await loadCategoriesScreen("cars")).detail!.video.coins).toBe(COIN_MIN);
  });

  it("only a superadmin saves, the price floor is enforced on the server, and nothing changes on a refusal", async () => {
    const id = await category("cars", "goods", { videoTourCoins: 20 });
    await expect(updateVideoTourSettings({ actorId: uid(), roles: ["admin"], categoryId: id, enabled: true, coins: 30, requestId: req })).rejects.toThrow(/superadmin/);
    await expect(updateVideoTourSettings({ actorId: uid(), roles: ["superadmin"], categoryId: id, coins: COIN_MIN - 1, requestId: req })).rejects.toThrow("Invalid request");
    expect((await Category.findById(id).lean())?.videoTourCoins).toBe(20);
    expect(await AuditEvent.countDocuments({ action: "video_tours.settings.update" })).toBe(0);
  });

  it("a people category cannot be switched on and the form reports it locked", async () => {
    const id = await category("dating", "people");
    await expect(updateVideoTourSettings({ actorId: uid(), roles: ["superadmin"], categoryId: id, enabled: true, requestId: req })).rejects.toThrow("Invalid request");
    expect((await loadCategoriesScreen("dating")).detail!.video.peopleLocked).toBe(true);
  });
});

describe("the lock reasons and the price check of the form", () => {
  it("names the reason the switch is off", () => {
    expect(lockOf({ kind: "people" })).toBe(LOCK_PEOPLE);
    expect(lockOf({ kind: "goods", peopleLocked: true })).toBe(LOCK_PEOPLE);
    expect(lockOf({ kind: null })).toBe(LOCK_NO_KIND);
    expect(lockOf({ kind: "goods", kindVideoOff: true })).toBe(LOCK_KIND);
    expect(lockOf({ kind: "goods" })).toBe("");
  });

  it("accepts whole numbers from 10 to 100 only", () => {
    for (const ok of ["10", "11", "100"]) expect(isCoinPrice(ok), ok).toBe(true);
    for (const bad of ["9", "0", "101", "1.5", "", "ten", "-10"]) expect(isCoinPrice(bad), bad).toBe(false);
  });
});
