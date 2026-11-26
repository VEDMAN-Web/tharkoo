import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { DEMO_TEXT, DEMO_TEXT_CATEGORIES, demoAdText } from "@/server/listings/demo-text";
import { demoTextCandidates, refreshDemoText, refreshTextConfirmation } from "@/server/listings/demo-text-refresh";
import { AuditEvent, Category, Listing, Location, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { textDenied } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H17.10: sample ad text that fits each category, the same word checks as a real ad, and the refresh action with its audit entry and Undo. */

const admin: AdminCtx = { actorId: "000000000000000000000071", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const support: AdminCtx = { actorId: "000000000000000000000072", email: "sup@example.com", roles: ["support"], requestId: "r-s" };

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

describe("H17.10 the templates", () => {
  const NEW_CATEGORIES = ["dating", "transgender", "spa", "personal-ads"];

  it("covers the four renamed categories with at least 8 distinct templates each, at least 4 of them without an area", () => {
    for (const slug of NEW_CATEGORIES) {
      expect(DEMO_TEXT_CATEGORIES, slug).toContain(slug);
      const templates = DEMO_TEXT[slug];
      expect(templates.length, `${slug} has at least 8 templates`).toBeGreaterThanOrEqual(8);
      expect(new Set(templates.map((item) => item.title)).size, `${slug} titles are distinct`).toBe(templates.length);
      expect(new Set(templates.map((item) => item.text)).size, `${slug} texts are distinct`).toBe(templates.length);
      expect(templates.filter((item) => !`${item.title} ${item.text}`.includes("{area}")).length, `${slug} has at least 4 without an area`).toBeGreaterThanOrEqual(4);
      expect(templates.filter((item) => `${item.title} ${item.text}`.includes("{area}")).length, `${slug} names an area in some`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every template, with and without an area, is a valid ad text and passes the same word check as a real ad", () => {
    for (const [slug, templates] of Object.entries(DEMO_TEXT)) {
      for (const template of templates) {
        for (const area of ["Adajan", null]) {
          if (area === null && `${template.title} ${template.text}`.includes("{area}")) continue;
          const filled = demoAdText(slug, "Surat", area, templates.indexOf(template));
          expect(filled, `${slug}: ${template.title}`).toBeTruthy();
          const { title, description } = filled!;
          expect(title.length, title).toBeGreaterThanOrEqual(5);
          expect(title.length, title).toBeLessThanOrEqual(70);
          expect(description.length, description).toBeGreaterThanOrEqual(20);
          expect(`${title} ${description}`, "no placeholder is left").not.toMatch(/[{}]/);
          expect(textDenied(title).denied, `denied title: ${title}`).toBe(false);
          expect(textDenied(description).denied, `denied text: ${description}`).toBe(false);
        }
      }
    }
  });

  it("stays plain: Spa & Salon has no body massage wording, and no category has age, body or money wording", () => {
    for (const template of DEMO_TEXT.spa) expect(`${template.title} ${template.text}`, template.title).not.toMatch(/massag|sensual|erotic|escort|body.?rub|happy ending|intimate|private room/i);
    for (const [slug, templates] of Object.entries(DEMO_TEXT)) {
      for (const template of templates) {
        expect(`${template.title} ${template.text}`, `${slug}: ${template.title}`).not.toMatch(/\b(age|aged|\d{2} ?yrs?|slim|curvy|figure|bust|sexy|hot|rs\.?|inr|paid|payment|donation|fee|fees)\b|₹/i);
      }
    }
  });

  it("gives the same words to the same ad every time, and uses the area templates only when there is an area", () => {
    expect(demoAdText("spa", "Pune", "Aundh", 12)).toEqual(demoAdText("spa", "Pune", "Aundh", 12));
    expect(demoAdText("nothing-here", "Pune", null, 1)).toBeNull();
    for (let n = 0; n < 40; n += 1) {
      const without = demoAdText("dating", "Pune", null, n)!;
      expect(`${without.title} ${without.description}`).not.toContain("  ");
    }
    const titles = new Set(Array.from({ length: 30 }, (_, n) => demoAdText("transgender", "Pune", "Aundh", n)!.title));
    expect(titles.size).toBeGreaterThanOrEqual(8);
  });
});

describe("H17.10 Refresh sample ad text", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    delete process.env.MONGODB_URI;
    resetDbCache();
    await connectMemoryMongo();
    await AuditEvent.init();
  });
  afterAll(async () => {
    await disconnectMemoryMongo();
    resetDbCache();
  });
  beforeEach(async () => {
    await clearMemoryMongo();
  });

  async function world() {
    const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo seller", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
    const real = await User.create({ email: "real@example.test", displayName: "Real seller", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
    const spa = await Category.create({ slug: "spa", name: "Spa & Salon", enabled: true, order: 0, description: "Local meetups" });
    const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 1 });
    const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN", enabled: true, order: 0 });
    const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: country._id, enabled: true, order: 0 });
    const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
    const adajan = await Location.create({ type: "district", slug: "adajan", name: "Adajan", parentId: surat._id, enabled: true, order: 0 });
    const pune = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 1 });
    return { seed, real, spa, jobs, state, surat, adajan, pune };
  }

  let serial = 0;
  async function ad(w: Awaited<ReturnType<typeof world>>, input: { owner: "seed" | "real"; category: "spa" | "jobs"; city?: "surat" | "pune"; district?: boolean }) {
    serial += 1;
    return Listing.create({
      ownerId: input.owner === "seed" ? w.seed._id : w.real._id,
      categoryId: input.category === "spa" ? w.spa._id : w.jobs._id,
      stateId: w.state._id,
      cityId: input.city === "pune" ? w.pune._id : w.surat._id,
      ...(input.district ? { districtId: w.adajan._id } : {}),
      title: `Old text ${serial}`,
      description: "An old sample description that is long enough to be valid.",
      slug: input.owner === "seed" ? `demo-${String(serial).padStart(4, "0")}` : `real-ad-${serial}-k7q2`,
      status: "active",
      price: 777,
    });
  }

  it("rewrites only sample ads of a covered category, names a real area when the city has one, and changes nothing else", async () => {
    const w = await world();
    const sampleSpa = [await ad(w, { owner: "seed", category: "spa", district: true }), await ad(w, { owner: "seed", category: "spa" }), await ad(w, { owner: "seed", category: "spa", city: "pune" })];
    const sampleJobs = await ad(w, { owner: "seed", category: "jobs" });
    const realSpa = await ad(w, { owner: "real", category: "spa" });
    expect(await demoTextCandidates()).toBe(3);

    const done = await refreshDemoText(admin, { confirm: refreshTextConfirmation(3) });
    expect(done.rewritten).toBe(3);
    const after = await Listing.find({ _id: { $in: sampleSpa.map((row) => row._id) } }).lean();
    for (const row of after) {
      expect(row.title).not.toMatch(/Old text/);
      expect(row.price).toBe(777);
      expect(row.status).toBe("active");
      expect(`${row.title} ${row.description}`).not.toMatch(/massag/i);
    }
    expect(after.some((row) => /Adajan/.test(`${row.title} ${row.description}`)), "an area of the city is named").toBe(true);
    const pune = after.find((row) => String(row.cityId) === String(w.pune._id))!;
    expect(`${pune.title} ${pune.description}`, "a city with no areas names no area").not.toMatch(/Adajan/);
    expect((await Listing.findById(sampleJobs._id).lean())?.title, "another category keeps its text").toBe(sampleJobs.title);
    expect((await Listing.findById(realSpa._id).lean())?.title, "a real ad is never touched").toBe(realSpa.title);

    const events = await AuditEvent.find({ action: "listing.demo.text" }).lean();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorRole: "admin", summary: "Rewrote the text of 3 sample ads" });
    expect(events[0].undo?.kind).toBe("demo.text");
  });

  it("needs the typed confirmation, an admin, and says so when there is nothing to change", async () => {
    const w = await world();
    await ad(w, { owner: "seed", category: "spa" });
    await expect(refreshDemoText(admin, { confirm: "yes" })).rejects.toThrow(ValidationError);
    await expect(refreshDemoText(admin, { confirm: "REFRESH 99" })).rejects.toThrow(ValidationError);
    await expect(refreshDemoText(support, { confirm: "REFRESH 1" })).rejects.toThrow(ForbiddenError);
    expect((await Listing.findOne({ slug: /^demo-/ }).lean())?.title).toMatch(/Old text/);
    await refreshDemoText(admin, { confirm: "REFRESH 1" });
    await expect(refreshDemoText(admin, { confirm: "REFRESH 1" })).rejects.toThrow(ConflictError);
    expect(await AuditEvent.countDocuments({ action: "listing.demo.text" })).toBe(1);
  });

  it("Undo puts every old title and text back, and leaves an ad that was edited since alone", async () => {
    const w = await world();
    const first = await ad(w, { owner: "seed", category: "spa" });
    const second = await ad(w, { owner: "seed", category: "spa" });
    const done = await refreshDemoText(admin, { confirm: "REFRESH 2" });
    await Listing.updateOne({ _id: second._id }, { $set: { title: "Edited by hand after the refresh" } });
    const undone = await undoEvent(admin, done.eventId);
    expect(undone.ok).toBe(true);
    expect((await Listing.findById(first._id).lean())?.title).toBe(first.title);
    expect((await Listing.findById(first._id).lean())?.description).toBe(first.description);
    expect((await Listing.findById(second._id).lean())?.title).toBe("Edited by hand after the refresh");
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });
});
