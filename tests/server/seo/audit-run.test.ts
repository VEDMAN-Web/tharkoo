import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cron } from "@/app/api/cron/seo-audit/route";
import { SeoAuditRun } from "@/server/models";
import { crawlSite, type PageFetcher, pruneRuns, runAudit } from "@/server/seo/audit-run";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});
beforeEach(clearMemoryMongo);

const words = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
const good = (path: string) =>
  `<html><head><title>Office jobs page ${path} Tharkoo</title><meta name="description" content="A description that is long enough to pass the length rule, written for ${path}, with plenty of words."><link rel="canonical" href="http://x.test${path}"></head><body><h1>Heading ${path}</h1><p>${words}</p></body></html>`;

const fetcher: PageFetcher = async (path) => {
  const ok = (html: string, status = 200) => ({ status, location: "", xRobots: "", html });
  if (path === "/sitemap.xml") return ok("<loc>http://x.test/sitemap/a.xml</loc>");
  if (path === "/sitemap/a.xml") return ok("<loc>http://x.test/one/</loc><loc>http://x.test/two/</loc><loc>http://x.test/one/</loc>");
  if (path === "/robots.txt") return ok("User-Agent: *\nDisallow: /u/\nDisallow: /admin/\nDisallow: /api/\n");
  if (path === "/two/") return ok("", 404);
  if (path === "/this-page-does-not-exist/") return ok("", 404);
  return ok(good(path));
};

describe("crawlSite", () => {
  it("dedupes sitemap URLs, adds probes and counts P0 rows", async () => {
    const result = await crawlSite({ base: "http://x.test", agents: ["google"], fetcher });
    expect(result.urls).toBe(2);
    expect(result.rows).toHaveLength(2 + 5);
    expect(result.rows.find((r) => r.path === "/two/")?.p0).toEqual(["sitemap URL returns 404"]);
    expect(result.counts.p0Rows).toBe(1);
    expect(result.robotsIssues).toEqual([]);
  });

  it("crawls a probe once when it is also in the sitemap, so it is not a duplicate of itself", async () => {
    const both: PageFetcher = async (path, agent) =>
      path === "/sitemap/a.xml" ? { status: 200, location: "", xRobots: "", html: "<loc>http://x.test/</loc><loc>http://x.test/cities/</loc>" } : fetcher(path, agent);
    const result = await crawlSite({ base: "http://x.test", agents: ["google"], fetcher: both });
    expect(result.rows.filter((r) => r.path === "/")).toHaveLength(1);
    expect(result.rows).toHaveLength(2 + 3);
    expect(result.rows.flatMap((r) => r.p0).filter((text) => text.startsWith("duplicate"))).toEqual([]);
  });

  it("honours the URL limit and runs every agent", async () => {
    const result = await crawlSite({ base: "http://x.test", limit: 1, fetcher });
    expect(result.urls).toBe(1);
    expect(result.rows).toHaveLength((1 + 5) * 2);
  });
});

describe("runAudit", () => {
  it("stores a run and keeps only the last 30", async () => {
    for (let i = 0; i < 32; i++) {
      await SeoAuditRun.create({ startedAt: new Date(2026, 0, 1 + i), base: "http://x.test", counts: {}, rows: [] });
    }
    const out = await runAudit({ base: "http://x.test", triggeredBy: "test", fetcher });
    expect(out.counts.p0Rows).toBe(1);
    expect(await SeoAuditRun.countDocuments()).toBe(30);
    const newest = await SeoAuditRun.findOne().sort({ startedAt: -1 }).lean();
    expect(newest?.triggeredBy).toBe("test");
    expect(newest?.rows[0].p0).toEqual(["sitemap URL returns 404"]);
    expect(await pruneRuns()).toBe(0);
  });
});

describe("cron route", () => {
  it("refuses a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "secret-for-tests";
    const bare = await cron(new Request("http://x.test/api/cron/seo-audit", { method: "POST", body: "{}" }));
    expect(bare.status).toBe(401);
    const headers = { "x-cron-secret": "nope" };
    const wrong = await cron(new Request("http://x.test/api/cron/seo-audit", { method: "POST", body: "{}", headers }));
    expect(wrong.status).toBe(401);
  });
});
