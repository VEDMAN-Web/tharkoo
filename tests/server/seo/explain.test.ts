import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { kpisFrom, loadOverview, runNow } from "@/app/admin/seo/overview";
import { SeoAuditRun } from "@/server/models";
import { explainIndexability } from "@/server/seo/explain";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

describe("explainIndexability", () => {
  it("marks a thin hub noindex and says by how much", () => {
    const out = explainIndexability({ pageType: "city", count: 2, minimum: 3 });
    expect(out.indexable).toBe(false);
    expect(out.reasons).toEqual(["noindex: 2 ads < minimum 3"]);
    expect(out.editor.href).toBe("/admin/seo/templates/");
  });

  it("indexes a hub that meets the minimum, using the district default of 10", () => {
    expect(explainIndexability({ pageType: "city", count: 3, minimum: 3 }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "district", count: 9 }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "district", count: 10 }).indexable).toBe(true);
  });

  it("never indexes page 2 or later", () => {
    const out = explainIndexability({ pageType: "category", count: 50, minimum: 3, page: 2 });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("page 2");
  });

  it("handles filter parameters: indexable with results, noindex with none", () => {
    const withResults = explainIndexability({ pageType: "city", count: 5, minimum: 3, filtered: true });
    expect(withResults.indexable).toBe(true);
    expect(withResults.reasons.join(" ")).toContain("filter parameters");
    expect(explainIndexability({ pageType: "city", count: 0, minimum: 3, filtered: true }).reasons[0]).toContain("filter parameters with no results");
  });

  it("never indexes a demo ad, even when its flag allows it", () => {
    const out = explainIndexability({ pageType: "ad", demoAd: true, adNoindex: false });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("demo ad");
  });

  it("indexes a live ad that is allowed, and not-indexes ended or flagged ads", () => {
    expect(explainIndexability({ pageType: "ad", adNoindex: false }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "ad", adNoindex: true }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "ad", adNoindex: false, adEnded: true }).reasons[0]).toContain("ended");
  });

  it("explains an alias district as a redirect to the city page", () => {
    const out = explainIndexability({ pageType: "district", count: 40, aliasDistrict: true });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("redirects (301) to the city page");
  });

  it("lets a page override noindex win and points the editor at overrides", () => {
    const out = explainIndexability({ pageType: "city", count: 100, minimum: 3, overrideNoindex: true });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("page override");
    expect(out.editor.href).toBe("/admin/urls/");
  });

  it("never indexes search pages and indexes the home page", () => {
    expect(explainIndexability({ pageType: "search" }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "home" }).indexable).toBe(true);
  });
});

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
