import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeoAuditRun } from "@/server/models";
import { kpisFrom, loadOverview, runNow } from "@/server/seo/overview";
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

const row = (path: string, extra: Record<string, unknown> = {}) => ({
  path,
  agent: "google",
  status: 200,
  inSitemap: true,
  title: path,
  p0: [] as string[],
  p1: [] as string[],
  ...extra,
});

describe("seo overview", () => {
  it("shows no numbers before any run", async () => {
    const out = await loadOverview();
    expect(out.hasRun).toBe(false);
    expect(out.kpis).toBeNull();
    expect(out.waiting).toBe(false);
  });

  it("builds KPIs only from real run data", async () => {
    const kpis = kpisFrom(
      {
        counts: { urls: 3, sitemapUrls: 10, requests: 3, p0Rows: 1, p1Rows: 2, robotsIssues: 0 },
        robotsIssues: [],
        rows: [
          row("/a/", { p1: ["thin: 20 words"] }),
          row("/b/", { noindex: true }),
          row("/c/", { p0: ["duplicate title (2 pages)"], p1: ["thin: 30 words"] }),
          row("/d/", { agent: "browser" }),
        ],
      },
      4,
    );
    expect(kpis).toEqual({ urls: 10, checked: 3, indexable: 2, p0Rows: 1, p1Rows: 2, thin: 2, duplicates: 1, robotsIssues: 0, redirects: 4 });
  });

  it("refuses staff without an SEO role", async () => {
    await expect(runNow({ roles: ["support"], email: "a@example.test" })).rejects.toThrow(/SEO editor/);
  });

  it("allows one run per 10 minutes", async () => {
    await SeoAuditRun.create({ startedAt: new Date(), base: "http://x.test", counts: {}, rows: [] });
    await expect(runNow({ roles: ["seo_editor"], email: "a@example.test" })).rejects.toThrow(/Try again in/);
    expect((await loadOverview()).waiting).toBe(true);
  });
});
