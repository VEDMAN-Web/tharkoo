import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SEO_SETTINGS, llmsExtra, normaliseSeoSettings, robotsLineProblem, validateSeoSettings } from "@/app/admin/seo/settings/rules";
import { adsSkippedBySchema, getSeoSettings, saveSeoSettings } from "@/app/admin/seo/settings/store";
import robots from "@/app/robots";
import { GET as llms } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";
import { invalidateTags } from "@/lib/cache";
import { listingJsonLd, missingSchemaFields, organizationFromSettings } from "@/lib/seo/schema";
import { robotsIssues } from "@/server/seo/audit-rules";
import { Category, Listing, Location } from "@/server/models";
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
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
  delete process.env.SITE_NOINDEX;
});

const superadmin = { roles: ["superadmin"], email: "root@example.test" };
const editor = { roles: ["seo_editor"], email: "editor@example.test" };

function robotsText(rules: { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] }[]) {
  return rules.map((rule) => [`User-Agent: ${rule.userAgent}`, ...[rule.disallow ?? []].flat().map((path) => `Disallow: ${path}`)].join("\n")).join("\n\n");
}

describe("robots disallow lines", () => {
  it("cannot block the whole site, the sitemaps or the build files", () => {
    for (const line of ["/", "/*", "/$", "/sitemap.xml", "/sitemap/", "/sitemap/cities.xml", "/s", "/_next/", "/_next/static/", "/robots.txt"]) {
      expect(robotsLineProblem(line), line).not.toBeNull();
    }
  });

  it("accepts ordinary private paths and rejects bad shapes", () => {
    for (const line of ["/private/", "/drafts/*", "/promo?ref=*"]) expect(robotsLineProblem(line), line).toBeNull();
    for (const line of ["private", "/has space/", "/x".repeat(80), ""]) expect(robotsLineProblem(line), line).not.toBeNull();
  });

  it("refuses a save that disallows /", () => {
    const out = validateSeoSettings({ robotsDisallow: ["/"] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.robotsDisallow[0]).toContain("whole site");
  });
});

describe("saving settings", () => {
  it("lets only a superadmin change the extra robots lines", async () => {
    await expect(saveSeoSettings(editor, { robotsDisallow: ["/private/"] })).rejects.toThrow(/superadmin/);
    await saveSeoSettings(superadmin, { robotsDisallow: ["/private/"] });
    expect((await getSeoSettings()).robotsDisallow).toEqual(["/private/"]);
    await saveSeoSettings(editor, { robotsDisallow: ["/private/"], llmsIntro: "Hello" });
    expect((await getSeoSettings()).llmsIntro).toBe("Hello");
  });

  it("refuses roles without SEO rights and bad data", async () => {
    await expect(saveSeoSettings({ roles: ["support"], email: "s@example.test" }, {})).rejects.toThrow(/SEO editor/);
    await expect(saveSeoSettings(superadmin, { robotsDisallow: ["/"] })).rejects.toThrow(/highlighted/);
    await expect(saveSeoSettings(superadmin, { llmsIntro: "Cheap escort" })).rejects.toThrow();
    await expect(saveSeoSettings(superadmin, { organization: { email: "nope" } })).rejects.toThrow();
    await expect(saveSeoSettings(superadmin, { organization: { sameAs: ["http://insecure.example"] } })).rejects.toThrow();
    await expect(saveSeoSettings(superadmin, { adSchema: { jobs: "Article" } })).rejects.toThrow();
    await expect(saveSeoSettings(superadmin, { defaultOgImage: "javascript:alert(1)" })).rejects.toThrow();
  });

  it("reads broken stored data as defaults", () => {
    expect(normaliseSeoSettings(undefined)).toEqual(DEFAULT_SEO_SETTINGS);
    expect(normaliseSeoSettings({ robotsDisallow: ["/", "/ok/"], adSchema: { jobs: "Bad", cars: "Product" } })).toMatchObject({ robotsDisallow: ["/ok/"], adSchema: { cars: "Product" } });
  });
});

describe("robots.txt and llms.txt output", () => {
  it("adds saved lines to the single rule set and still passes the private-path check", async () => {
    await saveSeoSettings(superadmin, { robotsDisallow: ["/private/", "/search"] });
    const rules = ([] as { userAgent?: string; disallow?: string[] }[]).concat((await robots()).rules as never);
    expect(rules).toHaveLength(1);
    expect(rules[0].disallow).toEqual(["/u/", "/search", "/admin/", "/api/", "/private/"]);
    expect(robotsIssues(robotsText(rules as never))).toEqual([]);
  });

  it("keeps the built-in rules when nothing is saved and when the site is noindex", async () => {
    expect((await robots()).rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/"] }]);
    process.env.SITE_NOINDEX = "true";
    expect((await robots()).rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("writes the saved intro and sections into llms.txt and llms-full.txt", async () => {
    await saveSeoSettings(editor, { llmsIntro: "A neutral place to post local ads.", llmsSections: [{ title: "Contact", body: "Write to support." }] });
    const short = await (await llms()).text();
    expect(short).toContain("A neutral place to post local ads.");
    expect(short).not.toContain("free classifieds site for India");
    expect(short).toContain("## Contact\nWrite to support.");
    const full = await (await llmsFull()).text();
    expect(full).toContain("A neutral place to post local ads.");
    expect(full).toContain("## Contact");
    expect(llmsExtra(DEFAULT_SEO_SETTINGS)).toEqual({ intro: null, sections: [] });
  });
});

describe("structured data", () => {
  const job = {
    category: "jobs",
    name: "Office assistant",
    description: "A role.",
    url: "https://x.test/listing/a/",
    datePosted: "2026-06-01T00:00:00.000Z",
    validThrough: "2026-07-01T00:00:00.000Z",
    hiringOrganization: "Acme",
    jobLocation: "Pune",
  };

  it("omits JobPosting when a required field is missing and lists what is missing", () => {
    expect(listingJsonLd(job)).toMatchObject({ "@type": "JobPosting" });
    expect(listingJsonLd({ ...job, hiringOrganization: undefined })).toBeNull();
    expect(listingJsonLd({ ...job, mapping: "JobPosting", validThrough: undefined })).toBeNull();
    expect(missingSchemaFields("JobPosting", { ...job, hiringOrganization: undefined, validThrough: undefined })).toEqual(["expiry date", "hiring company"]);
  });

  it("follows the category mapping", () => {
    const car = { category: "vehicles", name: "Car", description: "A car.", url: "https://x.test/listing/b/", price: 100000 };
    expect(listingJsonLd(car)).toMatchObject({ "@type": "Product" });
    expect(listingJsonLd({ ...car, mapping: "none" })).toBeNull();
    expect(listingJsonLd({ ...car, category: "weird", mapping: "Product" })).toMatchObject({ "@type": "Product", offers: { price: "100000" } });
    expect(listingJsonLd({ ...car, category: "weird", mapping: "Product", price: null })).toBeNull();
    expect(listingJsonLd({ ...job, category: "weird", mapping: "JobPosting" })).toMatchObject({ "@type": "JobPosting" });
  });

  it("builds Organization fields from the settings", () => {
    const base = organizationFromSettings("Tharkoo", { logo: "https://x.test/logo.svg" }, null);
    expect(base).toMatchObject({ "@type": "Organization", name: "Tharkoo", logo: "https://x.test/logo.svg" });
    const custom = organizationFromSettings("Tharkoo", {}, { name: "Tharkoo Ltd", sameAs: ["https://x.example/a"], email: "help@x.test", phone: "+91 11 5550 0000" });
    expect(custom).toMatchObject({ name: "Tharkoo Ltd", sameAs: ["https://x.example/a"], contactPoint: { email: "help@x.test", telephone: "+91 11 5550 0000" } });
  });

  it("lists the live ads a schema type would skip", async () => {
    const category = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0, fields: [] });
    const state = await Location.create({ type: "state", slug: "india", name: "India", parentId: null, enabled: true, order: 0 });
    const city = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
    const base = { ownerId: new mongoose.Types.ObjectId(), categoryId: category._id, stateId: state._id, cityId: city._id, description: "Role.", status: "active", publishedAt: new Date("2026-06-01T00:00:00.000Z") };
    await Listing.create({ ...base, title: "Complete role", slug: "complete-aaaa1", expiresAt: new Date("2027-01-01T00:00:00.000Z"), attributes: { company: "Acme" } });
    await Listing.create({ ...base, title: "No company", slug: "nocompany-aaaa2", expiresAt: new Date("2027-01-01T00:00:00.000Z") });
    await Listing.create({ ...base, title: "No expiry", slug: "noexpiry-aaaa3", attributes: { company: "Acme" } });
    const out = await adsSkippedBySchema(String(category._id), "JobPosting");
    expect(out.checked).toBe(3);
    expect(out.skipped.map((row) => [row.title, row.missing]).sort()).toEqual([
      ["No company", ["hiring company"]],
      ["No expiry", ["expiry date"]],
    ]);
    expect(await adsSkippedBySchema(String(category._id), "none")).toEqual({ checked: 0, skipped: [] });
  });
});
