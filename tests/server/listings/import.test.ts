import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const queueIndexNow = vi.hoisted(() => vi.fn());
vi.mock("@/server/indexnow/ping", () => ({ queueIndexNow }));
import { parseCsv } from "@/server/listings/csv";
import { MAX_IMPORT_ROWS, dryRunImport, runImport, type ImportActor } from "@/server/listings/import";
import { AuditEvent, BannedWord, Category, Listing, Location, MediaAsset, User } from "@/server/models";
import { denyTerm } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: ImportActor = { id: new mongoose.Types.ObjectId().toString(), roles: ["admin"] };
const superadmin: ImportActor = { id: new mongoose.Types.ObjectId().toString(), roles: ["superadmin"] };
const HEAD = "category,city,district,title,description,amount,condition,photos";

async function partner(verificationStatus: "approved" | "unsubmitted" = "approved", email = "broker@example.com") {
  return User.create({
    email,
    passwordHash: "not-a-secret",
    displayName: "Surat Brokers",
    dateOfBirth: new Date("1990-04-02"),
    attestedAdultAt: new Date("2020-01-01"),
    roles: ["user"],
    verificationStatus,
    status: "active",
  });
}

async function catalogue(ownerId: mongoose.Types.ObjectId) {
  const category = await Category.create({
    slug: "cycles",
    name: "Cycles",
    enabled: true,
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true, min: 0, order: 1, enabled: true },
      { key: "condition", label: "Condition", type: "select", options: ["new", "used"], required: false, order: 2, enabled: true },
    ],
  });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true });
  const city = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true });
  await Location.create({ type: "district", slug: "adajan", name: "Adajan", parentId: city._id, enabled: true });
  const media = await MediaAsset.create({
    ownerId,
    kind: "image",
    objectKey: "/uploads/own-photo.jpg",
    status: "cleared",
    clearedAt: new Date(),
    contentType: "image/jpeg",
  });
  return { category, city, media };
}

function row(title: string, extra: Partial<Record<"description" | "price" | "photos" | "city", string>> = {}) {
  const { description = "A well kept cycle", price = "4500", photos = "", city = "surat" } = extra;
  return `cycles,${city},adajan,${title},${description},${price},used,${photos}`;
}

const file = (...rows: string[]) => [HEAD, ...rows].join("\n");

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

describe("parseCsv", () => {
  it("reads quoted fields, commas, line breaks in quotes, doubled quotes, CRLF and a BOM", () => {
    const text = '﻿a,b,c\r\n"x, y","line1\nline2","say ""hi"""\r\n\r\n1,2,3';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", "line1\nline2", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/quote/i);
  });
});

describe("partner import", () => {
  it("imports every valid row as pending, attaches the partner photo and writes one audit event", async () => {
    const owner = await partner();
    const { media } = await catalogue(owner._id);
    const csv = file(
      row("Hero road cycle", { photos: "/uploads/own-photo.jpg" }),
      row("Hybrid commuter cycle"),
      row("Kids cycle red", { description: '"Two lines\nof text"' }),
    );
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.okCount).toBe(3);
    expect(await Listing.countDocuments({})).toBe(0);

    const result = await runImport(admin, owner.email, csv, "pending", "req-1");
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    const listings = await Listing.find({ ownerId: owner._id }).select("+contact");
    expect(listings).toHaveLength(3);
    expect(listings.every((item) => item.status === "pending" && item.seoNoindex)).toBe(true);
    expect(listings.every((item) => item.contact?.acceptForm)).toBe(true);
    const withPhoto = listings.find((item) => item.title === "Hero road cycle");
    expect(withPhoto?.mediaIds?.map(String)).toEqual([media._id.toString()]);
    expect(withPhoto?.attributes).toMatchObject({ amount: 4500, condition: "used" });
    expect(withPhoto?.stateId).toBeTruthy();
    expect(withPhoto?.districtId).toBeTruthy();
    const events = await AuditEvent.find({ action: "listing.import" });
    expect(events).toHaveLength(1);
    expect(events[0].after).toMatchObject({ rows: 3, imported: 3, status: "pending" });
    expect(String(events[0].actorId)).toBe(admin.id);
  });

  it("lets only a superadmin publish at once, with a slug and expiry", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const csv = file(row("Gear cycle"));
    await expect(runImport(admin, owner.email, csv, "active", "req-2")).rejects.toThrow(/superadmin/i);
    expect(await Listing.countDocuments({})).toBe(0);
    const result = await runImport(superadmin, owner.email, csv, "active", "req-3");
    expect(result.imported).toBe(1);
    const listing = await Listing.findOne({ ownerId: owner._id });
    expect(listing?.status).toBe("active");
    expect(listing?.slug).toBe("gear-cycle");
    expect(listing?.seoNoindex).toBe(false);
    expect(listing?.expiresAt).toBeInstanceOf(Date);
  });

  it("pings IndexNow for each ad that goes straight to active, and not for pending imports", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    queueIndexNow.mockClear();
    await runImport(admin, owner.email, file(row("Held cycle")), "pending", "req-4");
    expect(queueIndexNow).not.toHaveBeenCalled();
    await runImport(superadmin, owner.email, file(row("Fresh cycle"), row("Second cycle")), "active", "req-5");
    const pinged = queueIndexNow.mock.calls.flatMap((call) => call[0] as string[]).sort();
    expect(pinged).toEqual(["/ad/fresh-cycle/", "/ad/second-cycle/"]);
  });

  it("reports a row with a missing required field and does not import it", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const csv = file(row("Good cycle"), row("", { price: "4500" }), row("No amount cycle", { price: "" }));
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.okCount).toBe(1);
    expect(dry.rows[1].errors.join(" ")).toMatch(/"title" is empty/);
    expect(dry.rows[2].errors.join(" ")).toMatch(/Amount/);
    const result = await runImport(admin, owner.email, csv, "pending", "req-4");
    expect(result.imported).toBe(1);
    expect(await Listing.countDocuments({})).toBe(1);
  });

  it("rejects a forbidden term and an admin banned word", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    await BannedWord.create({ text: "blorptastic" });
    const csv = file(
      row("Clean cycle"),
      row("Bad cycle", { description: `A ${denyTerm("esc", "ort")} service` }),
      row("Other cycle", { description: "Totally blorptastic deal" }),
    );
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.rows.map((item) => item.ok)).toEqual([true, false, false]);
    expect(dry.rows[1].errors[0]).toMatch(/description contains a word that is not allowed/);
    const result = await runImport(admin, owner.email, csv, "pending", "req-5");
    expect(result.imported).toBe(1);
    expect(await Listing.countDocuments({})).toBe(1);
  });

  it("refuses a partner who is not ID-verified", async () => {
    const owner = await partner("unsubmitted", "unverified@example.com");
    await catalogue(owner._id);
    await expect(dryRunImport(admin, owner.email, file(row("Cycle")))).rejects.toThrow(/verification/i);
    await expect(runImport(admin, owner.email, file(row("Cycle")), "pending", "req-6")).rejects.toThrow(/verification/i);
    expect(await Listing.countDocuments({})).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "listing.import" })).toBe(0);
  });

  it("refuses a file with more than 200 rows and accepts exactly 200", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const make = (count: number) => file(...Array.from({ length: count }, (_, index) => row(`Cycle number ${index}`)));
    await expect(dryRunImport(admin, owner.email, make(MAX_IMPORT_ROWS + 1))).rejects.toThrow(/Too many rows: 201/);
    const dry = await dryRunImport(admin, owner.email, make(MAX_IMPORT_ROWS));
    expect(dry.total).toBe(200);
    expect(dry.okCount).toBe(200);
  });

  it("reads the price column into the real price field, not an attribute", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const csv = ["category,city,title,description,amount,price", "cycles,surat,Priced cycle,A cycle,100,\"5,000\""].join("\n");
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.rows[0].errors).toEqual([]);
    await runImport(admin, owner.email, csv, "pending", "req-price");
    const saved = await Listing.findOne({ title: "Priced cycle" }).lean();
    expect(saved?.price).toBe(5000);
    expect(saved?.attributes).not.toHaveProperty("price");
  });

  it("rejects a price that is not a whole number of rupees", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const csv = ["category,city,title,description,amount,price", "cycles,surat,Bad price,A cycle,100,12.5"].join("\n");
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.rows[0].ok).toBe(false);
    expect(dry.rows[0].errors[0]).toMatch(/Price "12.5"/);
  });

  it("refuses staff roles other than admin and superadmin", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const moderator: ImportActor = { id: admin.id, roles: ["moderator"] };
    await expect(dryRunImport(moderator, owner.email, file(row("Cycle")))).rejects.toThrow(/not allowed/i);
    await expect(runImport(moderator, owner.email, file(row("Cycle")), "pending", "req-7")).rejects.toThrow(/not allowed/i);
  });

  it("accepts only photos from the partner own cleared uploads", async () => {
    const owner = await partner();
    const other = await partner("approved", "other@example.com");
    await catalogue(owner._id);
    await MediaAsset.create({ ownerId: other._id, kind: "image", objectKey: "/uploads/other.jpg", status: "cleared" });
    const csv = file(
      row("Foreign host cycle", { photos: "https://example.org/uploads/own-photo.jpg" }),
      row("Not my photo cycle", { photos: "/uploads/other.jpg" }),
      row("Own photo cycle", { photos: "/uploads/own-photo.jpg" }),
    );
    const dry = await dryRunImport(admin, owner.email, csv);
    expect(dry.rows.map((item) => item.ok)).toEqual([false, false, true]);
    expect(dry.rows[0].errors[0]).toMatch(/not from our own uploads/);
    expect(dry.rows[1].errors[0]).toMatch(/cleared uploads/);
  });

  it("flags unknown places and a repeat of listings the partner already has", async () => {
    const owner = await partner();
    await catalogue(owner._id);
    const csv = file(row("Repeat cycle"), row("Repeat cycle"), row("Lost cycle", { city: "atlantis" }));
    const first = await dryRunImport(admin, owner.email, csv);
    expect(first.rows[1].errors[0]).toMatch(/already exists/);
    expect(first.rows[2].errors[0]).toMatch(/Unknown city/);
    await runImport(admin, owner.email, file(row("Repeat cycle")), "pending", "req-8");
    const second = await dryRunImport(admin, owner.email, file(row("Repeat cycle")));
    expect(second.okCount).toBe(0);
  });
});
