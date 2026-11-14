import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dryRunImport, type ImportActor } from "@/server/listings/import";
import { createImportJob, getImportJob, openImportJob, recordImportPhoto, runImportChunk } from "@/server/import/job";
import { setCloudinaryUploader } from "@/server/media/client";
import { AuditEvent, Category, Listing, Location, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const superadmin: ImportActor = { id: new mongoose.Types.ObjectId().toString(), roles: ["superadmin"] };
const admin: ImportActor = { id: new mongoose.Types.ObjectId().toString(), roles: ["admin"] };
const HEAD = "category,city,district,title,description,amount,condition,photos";
const EMAIL = "broker@example.com";

/** A PNG header that the size reader accepts. The bytes are not a picture, which is fine for these tests. */
function png(width = 640, height = 480) {
  const head = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const dims = Buffer.alloc(8);
  dims.writeUInt32BE(width, 0);
  dims.writeUInt32BE(height, 4);
  return Buffer.concat([head, dims, Buffer.alloc(16)]);
}

function row(title: string, photos = "", price = "4500") {
  return `cycles,surat,adajan,${title},A well kept cycle,${price},used,${photos}`;
}

const file = (...rows: string[]) => [HEAD, ...rows].join("\n");

/** Five ads with 12 photos between them, as in the e2e check. */
const FIVE_ADS = [
  row("Cycle one", "c1-a.jpg|c1-b.jpg|c1-c.jpg"),
  row("Cycle two", "c2-a.jpg|c2-b.jpg"),
  row("Cycle three", "c3-a.jpg|c3-b.jpg|c3-c.jpg"),
  row("Cycle four", "c4-a.jpg|c4-b.jpg"),
  row("Cycle five", "c5-a.jpg|c5-b.jpg"),
];
const TWELVE = ["c1-a.jpg", "c1-b.jpg", "c1-c.jpg", "c2-a.jpg", "c2-b.jpg", "c3-a.jpg", "c3-b.jpg", "c3-c.jpg", "c4-a.jpg", "c4-b.jpg", "c5-a.jpg", "c5-b.jpg"];

async function partner() {
  return User.create({
    email: EMAIL,
    passwordHash: "not-a-secret",
    displayName: "Surat Brokers",
    dateOfBirth: new Date("1990-04-02"),
    attestedAdultAt: new Date("2020-01-01"),
    roles: ["user"],
    verificationStatus: "approved",
    status: "active",
  });
}

async function catalogue(maxPhotos: number | null = 4) {
  await Category.create({
    slug: "cycles",
    name: "Cycles",
    enabled: true,
    importMaxPhotos: maxPhotos,
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true, min: 0, order: 1, enabled: true },
      { key: "condition", label: "Condition", type: "select", options: ["new", "used"], required: false, order: 2, enabled: true },
    ],
  });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true });
  const city = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true });
  await Location.create({ type: "district", slug: "adajan", name: "Adajan", parentId: city._id, enabled: true });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  setCloudinaryUploader(async (_data, options) => ({
    url: `https://res.cloudinary.com/demo/image/upload/${options.folder}/${options.publicId}`,
    publicId: `${options.folder}/${options.publicId}`,
  }));
  await connectMemoryMongo();
});

afterAll(async () => {
  setCloudinaryUploader(null);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

describe("dry run for a file with photos", () => {
  it("counts ads and photos, and lists the chosen image that no ready row uses", async () => {
    await partner();
    await catalogue();
    const dry = await dryRunImport(superadmin, EMAIL, file(...FIVE_ADS), [...TWELVE, "spare.jpg"]);
    expect(dry.okCount).toBe(5);
    expect(dry.photos).toEqual({ ads: 5, photosToAttach: 12, filesToUpload: TWELVE, unusedFiles: ["spare.jpg"] });
    expect(await Listing.countDocuments({})).toBe(0);
  });

  it("reports a photo name that was not chosen as a row error", async () => {
    await partner();
    await catalogue();
    const dry = await dryRunImport(superadmin, EMAIL, file(row("Cycle one", "c1-a.jpg|missing.jpg")), ["c1-a.jpg"]);
    expect(dry.okCount).toBe(0);
    expect(dry.rows[0].errors.join(" ")).toMatch(/Missing file: missing\.jpg/);
  });

  it("uses the category maximum for a superadmin and refuses more", async () => {
    await partner();
    await catalogue(4);
    const five = ["p-1.jpg", "p-2.jpg", "p-3.jpg", "p-4.jpg", "p-5.jpg"];
    const dry = await dryRunImport(superadmin, EMAIL, file(row("Cycle one", five.join("|"))), five);
    expect(dry.rows[0].errors.join(" ")).toMatch(/The limit is 4/);
  });

  it("keeps the free limit for an admin: two photos on one row are refused", async () => {
    await partner();
    await catalogue(4);
    const dry = await dryRunImport(admin, EMAIL, file(row("Cycle one", "a.jpg|b.jpg")), ["a.jpg", "b.jpg"]);
    expect(dry.rows[0].errors.join(" ")).toMatch(/Too many photos: 2/);
  });

  it("refuses a file with more than 500 rows before it reads the rows", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => row(`Cycle ${index}`));
    await expect(dryRunImport(superadmin, EMAIL, file(...rows), [])).rejects.toThrow(/500/);
  });

  it("accepts exactly 500 rows", async () => {
    await partner();
    await catalogue();
    const rows = Array.from({ length: 500 }, (_, index) => row(`Cycle ${index}`));
    const dry = await dryRunImport(superadmin, EMAIL, file(...rows), []);
    expect(dry.total).toBe(500);
    expect(dry.okCount).toBe(500);
  });
});

describe("partner import with photos, in blocks", () => {
  it("uploads the photos, imports in blocks, and continues from the saved row after a closed page", async () => {
    await partner();
    await catalogue();
    const csv = file(...FIVE_ADS);
    const created = await createImportJob(superadmin, { partnerEmail: EMAIL, csv, fileNames: [...TWELVE], status: "pending" }, "req-create");
    const jobId = created.job.jobId;
    expect(created.job.state).toBe("uploading");
    expect(created.job.filesToUpload).toEqual(TWELVE);
    await expect(runImportChunk(superadmin, jobId, "req-early", 2)).rejects.toThrow(/still to upload/);

    for (const name of TWELVE) {
      const sent = await recordImportPhoto(superadmin, jobId, { name, type: "image/png", data: png() }, "req-photo");
      expect(sent).toEqual({ status: "cleared", name });
    }
    expect(await recordImportPhoto(superadmin, jobId, { name: "c1-a.jpg", type: "image/png", data: png() }, "req-again")).toEqual({
      status: "exists",
      name: "c1-a.jpg",
    });

    const first = await runImportChunk(superadmin, jobId, "req-1", 2);
    expect(first).toMatchObject({ nextRow: 2, state: "importing", imported: 2, failed: 0 });
    expect(await Listing.countDocuments({})).toBe(2);

    // The page closes here. A later visit finds the unfinished job and continues from the saved row.
    const open = await openImportJob(superadmin);
    expect(open).toMatchObject({ jobId, state: "importing", nextRow: 2 });

    const second = await runImportChunk(superadmin, jobId, "req-2", 2);
    expect(second.nextRow).toBe(4);
    const last = await runImportChunk(superadmin, jobId, "req-3", 2);
    expect(last).toMatchObject({ nextRow: 5, state: "done", imported: 5, failed: 0 });
    expect(last.rowResults).toHaveLength(5);
    expect(last.rowResults.every((item) => item.ok)).toBe(true);

    expect(await Listing.countDocuments({})).toBe(5);
    const withThree = await Listing.findOne({ title: "Cycle one" });
    expect(withThree?.mediaIds).toHaveLength(3);
    expect(withThree?.status).toBe("pending");
    expect(await openImportJob(superadmin)).toBeNull();
    const events = await AuditEvent.find({ action: "listing.import" });
    expect(events).toHaveLength(1);
    expect(events[0].after).toMatchObject({ rows: 5, imported: 5, failed: 0, jobId });
  });

  it("refuses a photo that no row uses, and a file that is not an image", async () => {
    await partner();
    await catalogue();
    const created = await createImportJob(superadmin, { partnerEmail: EMAIL, csv: file(...FIVE_ADS), fileNames: [...TWELVE, "spare.jpg"], status: "pending" }, "req");
    const jobId = created.job.jobId;
    await expect(recordImportPhoto(superadmin, jobId, { name: "spare.jpg", type: "image/png", data: png() }, "req-x")).rejects.toThrow(/not used by a row/);
    await expect(recordImportPhoto(superadmin, jobId, { name: "c1-a.jpg", type: "image/png", data: Buffer.from("not a picture") }, "req-y")).rejects.toThrow(/valid/);
  });

  it("keeps one staff member's job away from another", async () => {
    await partner();
    await catalogue();
    const created = await createImportJob(superadmin, { partnerEmail: EMAIL, csv: file(row("Cycle one")), fileNames: [], status: "pending" }, "req");
    await expect(getImportJob(admin, created.job.jobId)).rejects.toThrow(/not found/i);
    expect(await openImportJob(admin)).toBeNull();
  });

  it("refuses an active import for an admin, the same as the normal import", async () => {
    await partner();
    await catalogue();
    await expect(createImportJob(admin, { partnerEmail: EMAIL, csv: file(row("Cycle one")), fileNames: [], status: "active" }, "req")).rejects.toThrow(/superadmin/i);
    expect(await User.countDocuments({ email: EMAIL })).toBe(1);
  });
});
