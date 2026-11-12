import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDetails, fileReport, hashReporterIp, severityFor } from "@/server/reports/service";
import { Listing, Report } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  await connectMemoryMongo();
  await Report.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function ad(slug: string, publicId: string) {
  return Listing.collection.insertOne({ slug, publicId, title: "Sample", status: "active", createdAt: new Date(), updatedAt: new Date() } as never);
}

describe("report severity", () => {
  it("ranks the most serious reasons first", () => {
    expect(severityFor("trafficking_concern")).toBe("S0");
    expect(severityFor("prohibited_content")).toBe("S1");
    expect(severityFor("stolen_media")).toBe("S2");
    expect(severityFor("spam")).toBe("S3");
  });
});

describe("report text", () => {
  it("strips tags, collapses spaces and caps the length", () => {
    expect(cleanDetails("<b>Fake</b>   photo\n\n here")).toBe("Fake photo here");
    expect(cleanDetails("x".repeat(2000))).toHaveLength(1000);
    expect(cleanDetails(42)).toBe("");
  });

  it("hashes the reporter IP and never stores it raw", () => {
    const hash = hashReporterIp("203.0.113.9");
    expect(hash).toHaveLength(32);
    expect(hash).not.toContain("203.0.113.9");
    expect(hashReporterIp("203.0.113.9")).toBe(hash);
  });
});

describe("fileReport", () => {
  it("files one open report for an ad found by slug", async () => {
    await ad("sample-ad", "p-1");
    await fileReport({ ad: "sample-ad", reason: "spam", details: "Repeated posts", ip: "203.0.113.9" });
    const rows = await Report.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
    expect(rows[0].severity).toBe("S3");
    expect(rows[0].reporterIpHash).toBe(hashReporterIp("203.0.113.9"));
  });

  it("finds the ad by public id too", async () => {
    await ad("another", "p-2");
    await expect(fileReport({ ad: "p-2", reason: "fake", details: "", ip: "1.1.1.1" })).resolves.toEqual({ ok: true });
  });

  it("refuses an unknown reason, a missing ad and an unknown ad", async () => {
    await ad("known", "p-3");
    await expect(fileReport({ ad: "known", reason: "lol", details: "", ip: "1.1.1.1" })).rejects.toThrow(/reason/i);
    await expect(fileReport({ ad: "", reason: "spam", details: "", ip: "1.1.1.1" })).rejects.toThrow(/ad/i);
    await expect(fileReport({ ad: "nope", reason: "spam", details: "", ip: "1.1.1.1" })).rejects.toThrow(/could not be found/i);
    expect(await Report.countDocuments()).toBe(0);
  });
});
