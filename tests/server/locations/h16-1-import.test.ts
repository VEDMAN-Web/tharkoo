import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { previewImport, runImport } from "@/server/locations/import";
import { AuditEvent, Category, Listing, Location } from "@/server/models";
import { STATES } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000081", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const support: AdminCtx = { actorId: "000000000000000000000082", email: "sup@example.com", roles: ["support"], requestId: "r-s" };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await Location.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

/** India with the 36 states and territories, and three cities on the site already (order 0, 1, 2). */
async function world() {
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN" });
  const states = await Location.insertMany(STATES.map(([slug, name], order) => ({ type: "state", slug, name, parentId: country._id, order })));
  const state = (name: string) => states.find((row) => row.name === name)!;
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state("Gujarat")._id, order: 0 });
  const pune = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state("Maharashtra")._id, order: 1 });
  const gurgaon = await Location.create({ type: "city", slug: "gurgaon", name: "Gurgaon", parentId: state("Haryana")._id, order: 2, oldSlugs: ["gurugram"] });
  return { country, state, surat, pune, gurgaon };
}

const cityFile = (...rows: string[]) => ["name,state,slug,isDistrictHq,population,source", ...rows].join("\n");
const upload = (text: string) => ({ kind: "cities" as const, from: "upload" as const, text });

describe("H16.1 preview of a cities file", () => {
  it("sorts every row into new, already there, or a problem, and writes nothing", async () => {
    await world();
    const text = cityFile(
      "Surat,Gujarat,surat,no,4467797,https://example.test/a", // already there
      "Pune City,Maharashtra,pune,no,,", // slug already used in the same state: already there
      "Bhuj,Gujarat,bhuj,yes,,https://example.test/b", // new
      "Bhuj,Gujarat,bhuj,yes,,https://example.test/b", // repeated in the file
      "Atlantis,Narnia,atlantis,no,,", // unknown state
      "Bad Slug,Gujarat,Bad Slug!,no,,", // bad web address
      "Gurugram,Haryana,gurugram,no,,", // an old address of Gurgaon
      "Search,Gujarat,search,no,,", // reserved word
    );
    const preview = await previewImport(admin, upload(text));
    expect(preview).toMatchObject({ kind: "cities", total: 8, fresh: 1, existing: 2, problems: 5, samples: ["Bhuj, Gujarat"] });
    const why = Object.fromEntries(preview.problemRows.map((row) => [row.name, row.message]));
    expect(why["Bhuj"]).toMatch(/repeated in the file \(first on line 4\)/);
    expect(why["Atlantis"]).toMatch(/state "Narnia" is not on Tharkoo/);
    expect(why["Bad Slug"]).toMatch(/cannot be used/);
    expect(why["Gurugram"]).toMatch(/already used by Gurgaon/);
    expect(why["Search"]).toMatch(/reserved/);
    expect(await Location.countDocuments({ type: "city" })).toBe(3);
    expect(await AuditEvent.countDocuments({})).toBe(0);
  });

  it("refuses a web address that a city in another state already uses", async () => {
    await world();
    const preview = await previewImport(admin, upload(cityFile("Surat East,Maharashtra,surat,no,,")));
    expect(preview).toMatchObject({ fresh: 0, existing: 0, problems: 1 });
    expect(preview.problemRows[0].message).toMatch(/already used by Surat in Gujarat/);
  });

  it("refuses a category address, a file with the wrong columns, and anyone without the catalogue permission", async () => {
    await world();
    await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0 });
    const preview = await previewImport(admin, upload(cityFile("Dating City,Goa,dating,no,,")));
    expect(preview.problemRows[0].message).toMatch(/category address/);
    await expect(previewImport(admin, upload("name,slug\nA,a"))).rejects.toThrow(ValidationError);
    await expect(previewImport(admin, upload(""))).rejects.toThrow(ValidationError);
    await expect(previewImport(support, upload(cityFile("Bhuj,Gujarat,bhuj,yes,,")))).rejects.toThrow(ForbiddenError);
    await expect(runImport(support, upload(cityFile("Bhuj,Gujarat,bhuj,yes,,")))).rejects.toThrow(ForbiddenError);
    expect(await Location.countDocuments({ slug: "bhuj" })).toBe(0);
  });
});

describe("H16.1 import of cities", () => {
  it("adds only the new rows after the cities already there, leaves the old ones exactly as they were, and writes ONE audit entry with the counts", async () => {
    const { state, surat } = await world();
    await Location.updateOne({ _id: surat._id }, { $set: { name: "Surat (renamed)", enabled: false } });
    const text = cityFile("Surat,Gujarat,surat,no,,", "Bhuj,Gujarat,bhuj,yes,,", "Rajkot,Gujarat,rajkot,no,1286995,", "Atlantis,Narnia,atlantis,no,,");
    const done = await runImport(admin, upload(text));
    expect(done).toMatchObject({ added: 2, existing: 1, skipped: 1 });

    const bhuj = await Location.findOne({ type: "city", slug: "bhuj" }).lean();
    expect(bhuj).toMatchObject({ name: "Bhuj", enabled: true, countryCode: "IN" });
    expect(String(bhuj?.parentId)).toBe(String(state("Gujarat")._id));
    expect(bhuj?.order).toBe(3);
    const old = await Location.findById(surat._id).lean();
    expect(old).toMatchObject({ name: "Surat (renamed)", enabled: false, order: 0 });

    const events = await AuditEvent.find({ action: "location.import" }).lean();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorRole: "admin", summary: "Imported 2 cities (1 already there, 1 skipped)" });
    expect(events[0].after).toMatchObject({ added: 2, alreadyThere: 1, skipped: 1 });
    expect(events[0].undo?.kind).toBe("locations.import");
  });

  it("a second import of the same file has nothing new to add and changes nothing", async () => {
    await world();
    const text = cityFile("Bhuj,Gujarat,bhuj,yes,,", "Rajkot,Gujarat,rajkot,no,,");
    await runImport(admin, upload(text));
    const before = await Location.find({ type: "city" }).sort({ slug: 1 }).lean();
    const again = await previewImport(admin, upload(text));
    expect(again).toMatchObject({ fresh: 0, existing: 2, problems: 0 });
    await expect(runImport(admin, upload(text))).rejects.toThrow(/nothing new/i);
    expect(await Location.find({ type: "city" }).sort({ slug: 1 }).lean()).toEqual(before);
    expect(await AuditEvent.countDocuments({ action: "location.import" })).toBe(1);
  });

  it("Undo removes exactly the places the import added, and keeps the old ones", async () => {
    const { surat } = await world();
    const done = await runImport(admin, upload(cityFile("Bhuj,Gujarat,bhuj,yes,,", "Rajkot,Gujarat,rajkot,no,,", "Surat,Gujarat,surat,no,,")));
    expect(await Location.countDocuments({ type: "city" })).toBe(5);
    const undone = await undoEvent(admin, done.eventId);
    expect(undone.ok).toBe(true);
    expect(await Location.countDocuments({ type: "city" })).toBe(3);
    expect(await Location.exists({ _id: surat._id })).toBeTruthy();
    expect(await Location.exists({ slug: "bhuj" })).toBeNull();
    const again = await undoEvent(admin, done.eventId);
    expect(again).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("Undo as a whole is refused once one of the added cities has an ad, and nothing is removed", async () => {
    await world();
    const done = await runImport(admin, upload(cityFile("Bhuj,Gujarat,bhuj,yes,,", "Rajkot,Gujarat,rajkot,no,,")));
    const bhuj = await Location.findOne({ slug: "bhuj" }).lean();
    await Listing.create({ ownerId: new mongoose.Types.ObjectId(), categoryId: new mongoose.Types.ObjectId(), cityId: bhuj!._id, title: "A desk in Bhuj", description: "A wooden desk in good condition", slug: "desk-bhuj", status: "active" });
    const outcome = await undoEvent(admin, done.eventId);
    expect(outcome).toMatchObject({ ok: false, reason: "conflict" });
    expect(await Location.countDocuments({ slug: { $in: ["bhuj", "rajkot"] } })).toBe(2);
  });
});

describe("H16.1 import of areas", () => {
  const areaFile = (...rows: string[]) => ["city,name,slug", ...rows].join("\n");
  const areas = (text: string) => ({ kind: "areas" as const, from: "upload" as const, text });

  it("adds areas as districts of the city named by its web address or its name, skips repeats and unknown cities, and undoes", async () => {
    const { surat } = await world();
    await Location.create({ type: "district", slug: "adajan", name: "Adajan", parentId: surat._id, order: 4 });
    const text = areaFile("surat,Adajan,adajan", "surat,Vesu,vesu", "Surat,Piplod,piplod", "surat,Vesu,vesu", "nowhere,Lost Area,lost-area");
    const preview = await previewImport(admin, areas(text));
    expect(preview).toMatchObject({ kind: "areas", total: 5, fresh: 2, existing: 1, problems: 2 });
    const done = await runImport(admin, areas(text));
    expect(done).toMatchObject({ added: 2, existing: 1, skipped: 2 });
    const vesu = await Location.findOne({ type: "district", slug: "vesu" }).lean();
    expect(String(vesu?.parentId)).toBe(String(surat._id));
    expect(vesu?.order).toBe(5);
    expect(await Location.countDocuments({ type: "district", parentId: surat._id })).toBe(3);
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await Location.countDocuments({ type: "district", parentId: surat._id })).toBe(1);
  });

  it("says when a city name is ambiguous", async () => {
    const { state } = await world();
    await Location.create({ type: "city", slug: "aurangabad", name: "Aurangabad", parentId: state("Maharashtra")._id });
    await Location.create({ type: "city", slug: "aurangabad-bihar", name: "Aurangabad", parentId: state("Bihar")._id });
    const preview = await previewImport(admin, areas(areaFile("Aurangabad,Cidco,cidco")));
    expect(preview.problemRows[0].message).toMatch(/More than one city is called "Aurangabad"/);
  });
});

describe("H16.1 the built-in lists", () => {
  it("the built-in cities list previews against the 36 states with a clean result: about 880 new, no problems", async () => {
    await world();
    const preview = await previewImport(admin, { kind: "cities", from: "builtin" });
    expect(preview.problems).toBe(0);
    expect(preview.fresh).toBeGreaterThanOrEqual(700);
    expect(preview.existing).toBeGreaterThanOrEqual(3);
    expect(preview.fresh + preview.existing).toBe(preview.total);
  });

  it("the built-in areas list needs its cities: before them every row is a problem, after them none is, and the areas import and undo", async () => {
    await world();
    const before = await previewImport(admin, { kind: "areas", from: "builtin" });
    expect(before.fresh, "only the areas of the cities the test world has can be added").toBeLessThan(150);
    expect(before.fresh + before.existing + before.problems).toBe(before.total);
    expect(before.problems).toBeGreaterThanOrEqual(400);
    await runImport(admin, { kind: "cities", from: "builtin" });
    const after = await previewImport(admin, { kind: "areas", from: "builtin" });
    expect(after.problems).toBe(0);
    expect(after.fresh).toBeGreaterThanOrEqual(500);
    const done = await runImport(admin, { kind: "areas", from: "builtin" });
    expect(await Location.countDocuments({ type: "district" })).toBe(done.added);
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await Location.countDocuments({ type: "district" })).toBe(0);
  });

  it("importing the built-in list adds the cities in a few seconds, and Undo takes them all away", async () => {
    await world();
    const started = Date.now();
    const done = await runImport(admin, { kind: "cities", from: "builtin" });
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(done.added).toBeGreaterThanOrEqual(700);
    expect(await Location.countDocuments({ type: "city" })).toBe(3 + done.added);
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await Location.countDocuments({ type: "city" })).toBe(3);
  });
});
