import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSeoFor } from "@/lib/queries";
import { mergeTemplates, renderTemplate, templateWarnings, unknownVariables } from "@/lib/seo/landing";
import { SeoTemplate } from "@/server/models";
import { deleteTemplate, listTemplates, saveTemplate, validateTemplate } from "@/server/seo/templates";
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

const editor = { roles: ["seo_editor"], email: "editor@example.test" };
const fields = (title: string, description = "", h1 = "", intro = "") => ({ title, description, h1, intro });

describe("template precedence", () => {
  it("uses the page-type default when there is no category template", async () => {
    await SeoTemplate.create({ pageType: "location", title: "Default {category} in {city}" });
    expect((await getSeoFor("location", "jobs"))?.title).toBe("Default {category} in {city}");
  });

  it("lets a category template win field by field, keeping other fields from the default", async () => {
    await SeoTemplate.create({ pageType: "location", title: "Default title", description: "Default description", h1: "Default h1" });
    await SeoTemplate.create({ pageType: "location:jobs", title: "Jobs title", description: "" });
    const out = await getSeoFor("location", "jobs");
    expect(out?.title).toBe("Jobs title");
    expect(out?.description).toBe("Default description");
    expect(out?.h1).toBe("Default h1");
    expect((await getSeoFor("location", "cars"))?.title).toBe("Default title");
  });

  it("falls back from the district type to the city/state type", async () => {
    await SeoTemplate.create({ pageType: "location", title: "City level" });
    expect((await getSeoFor("district", "jobs", "location"))?.title).toBe("City level");
    await SeoTemplate.create({ pageType: "district", title: "District level" });
    expect((await getSeoFor("district", "jobs", "location"))?.title).toBe("District level");
  });

  it("returns nothing when no template exists, and ignores an unsafe category slug", async () => {
    expect(await getSeoFor("category", "jobs")).toBeNull();
    expect(mergeTemplates(null, null)).toBeNull();
    await SeoTemplate.create({ pageType: "category", title: "Plain" });
    expect((await getSeoFor("category", "../x"))?.title).toBe("Plain");
  });
});

describe("template validation and saving", () => {
  it("rejects a forbidden term, an unknown variable, a long title and a bad page type", () => {
    expect(() => validateTemplate({ pageType: "location", fields: fields("Cheap escort in {city}") })).toThrow(/highlighted/);
    expect(() => validateTemplate({ pageType: "location", fields: fields("Jobs in {town}") })).toThrow();
    expect(() => validateTemplate({ pageType: "location", fields: fields("x".repeat(121)) })).toThrow();
    expect(() => validateTemplate({ pageType: "blog", fields: fields("Fine") })).toThrow();
    expect(() => validateTemplate({ pageType: "location", categorySlug: "Bad Slug", fields: fields("Fine") })).toThrow();
  });

  it("returns the field messages of a failed save", () => {
    try {
      validateTemplate({ pageType: "location", fields: fields("Jobs in {town}") });
      throw new Error("should not pass");
    } catch (error) {
      expect((error as { fields?: Record<string, string[]> }).fields?.title?.[0]).toContain("{town}");
    }
  });

  it("saves, lists and deletes a category template, and keeps defaults undeletable", async () => {
    await saveTemplate(editor, { pageType: "location", fields: fields("Default in {city}") });
    await saveTemplate(editor, { pageType: "location", categorySlug: "jobs", fields: fields("Jobs in {city}") });
    const rows = await listTemplates();
    expect(rows.map((row) => row.key)).toEqual(["location", "location:jobs"]);
    expect(rows[1]).toMatchObject({ pageType: "location", categorySlug: "jobs" });
    await expect(deleteTemplate(editor, "location")).rejects.toThrow(/cannot be deleted/);
    await deleteTemplate(editor, "location:jobs");
    expect((await listTemplates()).map((row) => row.key)).toEqual(["location"]);
  });

  it("refuses roles without SEO rights", async () => {
    await expect(saveTemplate({ roles: ["support"], email: "s@example.test" }, { pageType: "home", fields: fields("Home") })).rejects.toThrow(/SEO editor/);
  });

  it("updates the same template when saved twice", async () => {
    await saveTemplate(editor, { pageType: "home", fields: fields("One") });
    await saveTemplate(editor, { pageType: "home", fields: fields("Two") });
    const rows = await listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0].fields.title).toBe("Two");
  });
});

describe("template helpers", () => {
  it("renders variables like the hub pages do", () => {
    expect(renderTemplate("{category} in {city} {year}", { category: "Jobs", city: "Pune", site: "S" }, 2026)).toBe("Jobs in Pune 2026");
    expect(unknownVariables("{city} {districtPref} {nope}")).toEqual(["nope"]);
  });

  it("warns about length, duplicates across cities, a missing keyword and forbidden words", () => {
    const cities = ["Pune", "Delhi", "Goa"];
    const denied = (text: string) => text.includes("badword");
    const base = { category: "Jobs", site: "Tharkoo", samples: cities, denied };
    const same = templateWarnings(fields("Jobs classifieds"), base).map((w) => w.text);
    expect(same.some((t) => t.includes("characters"))).toBe(true);
    expect(same.some((t) => t.includes("same for some of the 3 sample cities"))).toBe(true);
    const missing = templateWarnings(fields("Listings in {city} on {site} today ok"), base).map((w) => w.text);
    expect(missing.some((t) => t.includes('"Jobs" is missing from the title'))).toBe(true);
    const bad = templateWarnings(fields("Jobs in {city} badword for you and for all"), base).map((w) => w.text);
    expect(bad.some((t) => t.includes("not allowed"))).toBe(true);
    const clean = templateWarnings(fields("Jobs in {city} - verified listings | {site}"), base);
    expect(clean).toEqual([]);
  });
});
