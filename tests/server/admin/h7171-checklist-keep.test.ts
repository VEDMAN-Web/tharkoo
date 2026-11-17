import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { undoEvent } from "@/server/admin/undo/core";
import { buildChecklist, getLaunchChecklist, markNotJunk, tickChecklist, type ChecklistInputs } from "@/server/admin/launch-checklist";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { AuditEvent, Listing, Site } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const BASE: ChecklistInputs = {
  staffNames: ["Vedant"],
  mockPaymentsOn: false,
  paidPostingOn: true,
  postingFee: 30,
  demoActive: 0,
  junkTitles: ["Coffee and a walk", "htjkjjhhkh"],
  junkIds: ["a1", "b2"],
  supportPhone: "+91 912345678",
  placeholderPages: [],
  grievancePublished: true,
  bannerChangedAt: null,
  pictures: 3,
  picturesToCheck: 0,
  loginCodeWarning: null,
  siteHidden: false,
  ticks: {},
};
const row = (inputs: ChecklistInputs, id: string) => buildChecklist(inputs).find((item) => item.id === id)!;
const admin = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };
const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("H7.171 Keep as is on the support phone row", () => {
  it("a 9 digit number is never done by itself, Keep as is makes the row done, and a real 10 digit number needs no Keep", () => {
    expect(row(BASE, "support-phone")).toMatchObject({ done: false, keep: { key: "supportPhoneKept", kept: false }, manual: null });
    expect(row({ ...BASE, ticks: { supportPhoneKept: { by: "a" } } }, "support-phone")).toMatchObject({ done: true, keep: { kept: true } });
    expect(row({ ...BASE, supportPhone: "+91 9123456789" }, "support-phone")).toMatchObject({ done: true, keep: { kept: false } });
  });

  it("is stored, audited, only for the settings permission, and Undo puts the record back", async () => {
    await Site.create({ key: "default" });
    const kept = await tickChecklist(admin, "supportPhoneKept", true);
    expect((await getLaunchChecklist()).find((item) => item.id === "support-phone")?.done).toBe(true);
    expect(await AuditEvent.countDocuments({ action: "launch.tick" })).toBe(1);
    expect(await undoEvent(admin, kept.eventId)).toMatchObject({ ok: true });
    expect((await getLaunchChecklist()).find((item) => item.id === "support-phone")?.done).toBe(false);
    await expect(tickChecklist({ ...admin, roles: ["moderator"] }, "supportPhoneKept", true)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("H7.171 Not junk on the junk ads row", () => {
  it("names the first junk ad, and is done when none are left", () => {
    expect(row(BASE, "junk-ads")).toMatchObject({ done: false, junkAd: { id: "b2", title: "htjkjjhhkh" } });
    expect(row({ ...BASE, junkTitles: ["Coffee and a walk"], junkIds: ["a1"] }, "junk-ads")).toMatchObject({ done: true });
    expect(row({ ...BASE, junkIds: undefined }, "junk-ads").junkAd).toBeUndefined();
  });

  it("marks one ad, the checklist stops naming it, it is audited, and Undo brings it back", async () => {
    const ad = await Listing.create({ ownerId: oid(), categoryId: oid(), title: "htjkjjhhkh", description: "A description that is long enough", slug: "htjk-1", status: "active" });
    await Site.create({ key: "default" });
    const before = (await getLaunchChecklist()).find((item) => item.id === "junk-ads");
    expect(before?.junkAd?.id).toBe(String(ad._id));
    const done = await markNotJunk(admin, String(ad._id), true);
    expect((await Listing.findById(ad._id).lean())?.notJunkAt).toBeTruthy();
    const after = (await getLaunchChecklist()).find((item) => item.id === "junk-ads");
    expect(after?.junkAd).toBeUndefined();
    expect(after?.done).toBe(true);
    expect(await AuditEvent.countDocuments({ action: "launch.not-junk" })).toBe(1);
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    expect((await getLaunchChecklist()).find((item) => item.id === "junk-ads")?.junkAd?.id).toBe(String(ad._id));
    await expect(markNotJunk({ ...admin, roles: ["moderator"] }, String(ad._id), true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(markNotJunk(admin, String(oid()), true)).rejects.toBeInstanceOf(NotFoundError);
  });
});
