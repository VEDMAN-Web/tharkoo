import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMPORT_HELP_LINES, IMPORT_TEMPLATE_HEADERS, importTemplateCsv } from "@/server/import/template";
import { isVideoFile, parseVideoCell, videoProblem, videoTypeOf, type ChosenVideo } from "@/server/import/videos";
import { createImportJob, recordImportVideo, runImportChunk } from "@/server/import/job";
import { dryRunImport, type ImportActor } from "@/server/listings/import";
import { setCloudinaryUploader, type UploadOptions } from "@/server/media/client";
import { VIDEO_MAX_BYTES, VIDEO_MAX_PER_AD } from "@/server/media/config";
import { AuditEvent, Category, Listing, Location, MediaAsset, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const MB = 1024 * 1024;
const superadmin: ImportActor = { id: new mongoose.Types.ObjectId().toString(), roles: ["superadmin"] };
const EMAIL = "broker@example.com";
const HEAD = "category,city,district,title,description,amount,condition,photos,videos";

/** A minimal mp4 whose mvhd says it lasts `seconds`. Same shape as the post-ad video tests. */
function mp4(seconds: number) {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom0000isom")), box("mdat", Buffer.alloc(0)), box("moov", box("mvhd", mvhd))]);
}

/** A chosen video as the browser reports it. Size is the real byte length unless the test overrides it. */
function video(name: string, over: Partial<ChosenVideo> = {}): ChosenVideo {
  return { name, size: 5 * MB, type: "video/mp4", seconds: 12, ...over };
}

function listingRow(title: string, videos = "", photos = "") {
  return `cycles,surat,adajan,${title},A well kept cycle,4500,used,${photos},${videos}`;
}

const csvOf = (...rows: string[]) => [HEAD, ...rows].join("\n");

const uploads: UploadOptions[] = [];

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

async function catalogue() {
  await Category.create({
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
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  // Cloudinary is "on" so that uploads go through the uploader below and never touch the disk.
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  setCloudinaryUploader(async (_data, options) => {
    uploads.push(options);
    return { url: `https://res.cloudinary.com/demo/video/upload/${options.publicId}`, publicId: `${options.folder}/${options.publicId}` };
  });
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
  uploads.length = 0;
});

describe("videos column: reading the cell and the type", () => {
  it("reads file names separated by | and ignores empty entries", () => {
    expect(parseVideoCell("ride-1.mp4 | ride-2.webm||")).toEqual(["ride-1.mp4", "ride-2.webm"]);
    expect(parseVideoCell("")).toEqual([]);
  });

  it("counts any video-looking file as a video, so a wrong format is reported as a wrong type", () => {
    expect(isVideoFile({ name: "old.avi", type: "" })).toBe(true);
    expect(isVideoFile({ name: "flat.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("takes the type from the extension when the browser gives none, and keeps a wrong type", () => {
    expect(videoTypeOf({ name: "ride.MOV", type: "" })).toBe("video/quicktime");
    expect(videoTypeOf({ name: "ride.mp4", type: "application/octet-stream" })).toBe("video/mp4");
    expect(videoTypeOf({ name: "old.avi", type: "video/x-msvideo" })).toBe("video/x-msvideo");
  });
});

describe("videos column: the post-ad rule", () => {
  it("accepts a clip of exactly 30 seconds and exactly 10 MB", () => {
    expect(videoProblem(video("ride.mp4", { seconds: 30, size: VIDEO_MAX_BYTES }))).toBeNull();
  });

  it("refuses a wrong type, an empty file, a file over 10 MB, an unreadable clip and one over 30 seconds", () => {
    expect(videoProblem(video("old.avi", { type: "video/x-msvideo" }))).toMatch(/not mp4, webm or mov/);
    expect(videoProblem(video("empty.mp4", { size: 0 }))).toMatch(/is empty/);
    expect(videoProblem(video("big.mp4", { size: VIDEO_MAX_BYTES + 1 }))).toMatch(/larger than 10 MB/);
    expect(videoProblem(video("odd.mp4", { seconds: null }))).toMatch(/could not be read/);
    expect(videoProblem(video("long.mp4", { seconds: 30.5 }))).toMatch(/longer than 30 seconds/);
  });

  it("allows two videos per ad", () => {
    expect(VIDEO_MAX_PER_AD).toBe(2);
  });
});

describe("videos column: the template", () => {
  it("has a videos column and a plain help line that gives the limits", () => {
    expect(IMPORT_TEMPLATE_HEADERS).toContain("videos");
    expect(importTemplateCsv().split("\r\n")[0]).toMatch(/,photos,videos$/);
    const help = IMPORT_HELP_LINES.find((line) => line.startsWith("videos:"));
    expect(help).toMatch(/Up to 2 per ad/);
    expect(help).toMatch(/10 MB and 30 seconds/);
  });
});

describe("videos in the dry run", () => {
  it("counts the videos a row attaches, and lists a chosen video that no row uses", async () => {
    await partner();
    await catalogue();
    const videos = [video("ride-1.mp4"), video("ride-2.webm", { type: "video/webm" }), video("spare.mp4")];
    const dry = await dryRunImport(superadmin, EMAIL, csvOf(listingRow("Cycle one", "ride-1.mp4|ride-2.webm")), [], videos);
    expect(dry.okCount).toBe(1);
    expect(dry.videos).toEqual({ videosToAttach: 2, filesToUpload: ["ride-1.mp4", "ride-2.webm"], unusedFiles: ["spare.mp4"] });
    expect(await Listing.countDocuments({})).toBe(0);
  });

  it("reports each video problem on its own row, and imports only the good row", async () => {
    await partner();
    await catalogue();
    const csv = csvOf(
      listingRow("Missing clip", "gone.mp4"),
      listingRow("Too many clips", "a.mp4|b.mp4|c.mp4"),
      listingRow("Too big clip", "big.mp4"),
      listingRow("Too long clip", "long.mp4"),
      listingRow("Wrong type clip", "old.avi"),
      listingRow("Good clip", "good.mp4"),
    );
    const dry = await dryRunImport(
      superadmin,
      EMAIL,
      csv,
      [],
      [
        video("a.mp4"),
        video("b.mp4"),
        video("c.mp4"),
        video("big.mp4", { size: 11 * MB }),
        video("long.mp4", { seconds: 31 }),
        video("old.avi", { type: "video/x-msvideo" }),
        video("good.mp4"),
      ],
    );
    const errorsOf = (title: string) => dry.rows.find((row) => row.title === title)?.errors.join(" ") ?? "";
    expect(errorsOf("Missing clip")).toMatch(/Missing file: gone\.mp4 is not among the chosen videos/);
    expect(errorsOf("Too many clips")).toMatch(/Too many videos: 3\. The limit is 2 per ad/);
    expect(errorsOf("Too big clip")).toMatch(/larger than 10 MB/);
    expect(errorsOf("Too long clip")).toMatch(/longer than 30 seconds/);
    expect(errorsOf("Wrong type clip")).toMatch(/not mp4, webm or mov/);
    expect(dry.rows.find((row) => row.title === "Good clip")?.ok).toBe(true);
    expect(dry.videos.videosToAttach).toBe(1);
  });

  it("refuses the same video twice on one row", async () => {
    await partner();
    await catalogue();
    const dry = await dryRunImport(superadmin, EMAIL, csvOf(listingRow("Twice clip", "good.mp4|good.mp4")), [], [video("good.mp4")]);
    expect(dry.rows[0].errors.join(" ")).toMatch(/listed twice: good\.mp4/);
  });
});

describe("videos in a partner import job", () => {
  it("checks the uploaded file, attaches the video to the ad that names it, and audits it", async () => {
    await partner();
    await catalogue();
    const bytes = mp4(12);
    const chosen = [video("ride.mp4", { size: bytes.length, seconds: 12 })];
    const created = await createImportJob(
      superadmin,
      { partnerEmail: EMAIL, csv: csvOf(listingRow("Cycle one", "ride.mp4")), fileNames: [], videoFiles: chosen, status: "pending" },
      "req-create",
    );
    const jobId = created.job.jobId;
    expect(created.job).toMatchObject({ state: "uploading", videosToUpload: ["ride.mp4"] });
    await expect(runImportChunk(superadmin, jobId, "req-early")).rejects.toThrow(/still to upload/);

    expect(await recordImportVideo(superadmin, jobId, { name: "ride.mp4", type: "video/mp4", data: bytes }, "req-video")).toEqual({
      status: "cleared",
      name: "ride.mp4",
    });
    expect(await recordImportVideo(superadmin, jobId, { name: "ride.mp4", type: "video/mp4", data: bytes }, "req-again")).toEqual({
      status: "exists",
      name: "ride.mp4",
    });

    const done = await runImportChunk(superadmin, jobId, "req-run");
    expect(done).toMatchObject({ state: "done", imported: 1, failed: 0 });
    const listing = await Listing.findOne({ title: "Cycle one" });
    const asset = await MediaAsset.findOne({ kind: "video" });
    expect(asset?.status).toBe("cleared");
    expect(asset?.listingId?.toString()).toBe(listing?._id.toString());
    expect(uploads.at(-1)?.resourceType).toBe("video");

    const imports = await AuditEvent.find({ action: "listing.import" });
    expect(imports).toHaveLength(1);
    expect(imports[0].after).toMatchObject({ imported: 1, videos: 1, jobId });
    const uploaded = await AuditEvent.find({ action: "media.import.upload" });
    expect(uploaded.map((event) => event.after)).toEqual([expect.objectContaining({ kind: "video", name: "ride.mp4" })]);
  });

  it("checks the real file on the server, whatever the browser said about its length", async () => {
    await partner();
    await catalogue();
    const created = await createImportJob(
      superadmin,
      { partnerEmail: EMAIL, csv: csvOf(listingRow("Cycle one", "ride.mp4")), fileNames: [], videoFiles: [video("ride.mp4")], status: "pending" },
      "req-create",
    );
    await expect(
      recordImportVideo(superadmin, created.job.jobId, { name: "ride.mp4", type: "video/mp4", data: mp4(40) }, "req-long"),
    ).rejects.toThrow(/longer than 30 seconds/);
    expect(await MediaAsset.countDocuments({ kind: "video" })).toBe(0);
  });
});
