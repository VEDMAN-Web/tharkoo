import mongoose from "mongoose";
import { revalidatePath, revalidateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_GROUPS } from "@/lib/seo/page-title-defaults";
import { defaultSiteContent } from "@/lib/ui/site-content";
import { cleanPath, countryPath, postAdPath, readPaths } from "@/lib/urls";
import { AuditEvent, Site, UrlOverride } from "@/server/models";
import { SeoTemplate } from "@/server/models/cms";
import {
  buildPageTitleRows,
  checkPageTitle,
  listPageTitles,
  parsePageTitleTarget,
  readPageTitle,
  resetPageTitle,
  savePageTitle,
  savePageTitleForEditor,
  templateChain,
  type PageTitleTarget,
  type TemplateMap,
} from "@/server/seo/page-titles";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const EM = String.fromCharCode(0x2014);
const admin = { roles: ["admin"], email: "admin@example.com" };
const seoEditor = { roles: ["seo_editor"], email: "seo@example.com" };
const viewer = { roles: ["viewer"], email: "viewer@example.com" };
const jobsTemplate: PageTitleTarget = { kind: "template", pageType: "category", categorySlug: "jobs" };
const cityPath = "/cities/";

/** Runs the call and returns the error it threw, so each test can check the message and field errors. */
async function failure(promise: Promise<unknown>): Promise<{ message: string; fields?: Record<string, string[]> }> {
  try {
    await promise;
  } catch (error) {
    return error as { message: string; fields?: Record<string, string[]> };
  }
  throw new Error("expected the call to fail");
}

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
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(revalidateTag).mockClear();
});

describe("the editors only accept the three kinds of page", () => {
  it("accepts the home page, a stored template and one exact address", () => {
    expect(parsePageTitleTarget({ kind: "home" })).toEqual({ kind: "home" });
    expect(parsePageTitleTarget({ kind: "template", pageType: "category", categorySlug: "jobs" })).toEqual(jobsTemplate);
    expect(parsePageTitleTarget({ kind: "template", pageType: "location", categorySlug: null })).toEqual({
      kind: "template",
      pageType: "location",
      categorySlug: null,
    });
    expect(parsePageTitleTarget({ kind: "url", path: cityPath })).toEqual({ kind: "url", path: cleanPath(cityPath) });
  });

  it("refuses an unknown kind, page type, category slug or outside address", () => {
    expect(() => parsePageTitleTarget({ kind: "other" })).toThrow();
    expect(() => parsePageTitleTarget(null)).toThrow();
    expect(() => parsePageTitleTarget({ kind: "template", pageType: "nope", categorySlug: null })).toThrow();
    expect(() => parsePageTitleTarget({ kind: "template", pageType: "category", categorySlug: "Bad Slug!" })).toThrow();
    expect(() => parsePageTitleTarget({ kind: "url", path: "https://example.org/x" })).toThrow();
  });
});

describe("the save rules refuse empty, dashed and over-long text", () => {
  it("names each empty field", () => {
    const empty = checkPageTitleFailure({ title: "  ", description: "" });
    expect(empty.fields?.title).toEqual(["Enter a page title"]);
    expect(empty.fields?.description).toEqual(["Enter a page description"]);
  });

  it("refuses an em or en dash in either field", () => {
    const dashed = checkPageTitleFailure({ title: `Jobs ${EM} Pune`, description: "Browse jobs in Pune on Tharkoo, free." });
    expect(dashed.fields?.title?.[0]).toMatch(/Use a comma/);
  });

  it("refuses a title over 120 characters", () => {
    const long = checkPageTitleFailure({ title: "x".repeat(121), description: "Browse jobs in Pune on Tharkoo, free of charge." });
    expect(long.fields?.title?.[0]).toMatch(/120 characters or fewer/);
  });

  it("returns the trimmed text when it is fine", () => {
    expect(checkPageTitle({ title: " Jobs in Pune | Tharkoo ", description: " Browse jobs in Pune on Tharkoo. " })).toEqual({
      title: "Jobs in Pune | Tharkoo",
      description: "Browse jobs in Pune on Tharkoo.",
    });
  });
});

function checkPageTitleFailure(input: { title: string; description: string }) {
  try {
    checkPageTitle(input);
  } catch (error) {
    return error as { message: string; fields?: Record<string, string[]> };
  }
  throw new Error("expected the text to be refused");
}

describe("saving keeps the rest of the stored content and is audited", () => {
  it("a category template keeps its heading and intro", async () => {
    await SeoTemplate.collection.insertOne({ pageType: "category:jobs", title: "Old", description: "Old description for jobs.", h1: "Jobs in India", intro: "Intro text." });

    await savePageTitle(seoEditor, jobsTemplate, { title: "Jobs in Pune | Tharkoo", description: "Browse jobs in Pune on Tharkoo, with photos and contact details." });

    const row = await SeoTemplate.collection.findOne({ pageType: "category:jobs" });
    expect(row?.title).toBe("Jobs in Pune | Tharkoo");
    expect(row?.h1).toBe("Jobs in India");
    expect(row?.intro).toBe("Intro text.");
    expect(await AuditEvent.countDocuments({ action: "seo.template.save" })).toBe(1);
  });

  it("an exact address keeps its heading, FAQ and robots setting", async () => {
    await UrlOverride.collection.insertOne({
      path: cityPath,
      title: "Old title | Tharkoo",
      h1: "Cities in India",
      noindex: false,
      faq: [{ q: "Is it free?", a: "Yes, a basic ad is free." }],
    });

    await savePageTitle(admin, { kind: "url", path: cityPath }, { title: "Cities across India | Tharkoo", description: "Pick a city to browse free classifieds across India, with photos." });

    const row = await UrlOverride.collection.findOne({ path: cityPath });
    expect(row?.title).toBe("Cities across India | Tharkoo");
    expect(row?.h1).toBe("Cities in India");
    expect(row?.faq).toEqual([{ q: "Is it free?", a: "Yes, a basic ad is free." }]);
    expect(await AuditEvent.countDocuments({ action: "seo.override.save" })).toBe(1);
  });

  it("the home page takes the same text the public page reads", async () => {
    await Site.collection.insertOne({ key: "default", name: "Tharkoo" });
    await savePageTitle(admin, { kind: "home" }, { title: "Free classifieds in India | Tharkoo", description: "Browse free classifieds for jobs, homes and vehicles in India." });
    expect((await readPageTitle({ kind: "home" })).title).toBe("Free classifieds in India | Tharkoo");
  });
});

describe("who may save", () => {
  it("a viewer with no SEO role is refused", async () => {
    const error = await failure(savePageTitle(viewer, jobsTemplate, { title: "Jobs in Pune | Tharkoo", description: "Browse jobs in Pune on Tharkoo, free." }));
    expect(error.message).toMatch(/SEO editor or admin/);
    expect(await SeoTemplate.collection.countDocuments({})).toBe(0);
  });

  it("the listing and post-ad editors are admin only", async () => {
    const refused = await failure(savePageTitleForEditor(seoEditor, jobsTemplate, { title: "Jobs in Pune | Tharkoo", description: "Browse jobs in Pune on Tharkoo, free." }));
    expect(refused.message).toMatch(/Only an admin/);
    await savePageTitleForEditor(admin, jobsTemplate, { title: "Jobs in Pune | Tharkoo", description: "Browse jobs in Pune on Tharkoo, free." });
    expect((await readPageTitle(jobsTemplate)).title).toBe("Jobs in Pune | Tharkoo");
  });

  it("the home page needs an admin, not only an SEO editor", async () => {
    await Site.collection.insertOne({ key: "default", name: "Tharkoo" });
    const error = await failure(savePageTitle(seoEditor, { kind: "home" }, { title: "Free classifieds in India | Tharkoo", description: "Browse free classifieds in India, with photos." }));
    expect(error.message).toMatch(/Only an admin/);
  });

  it("a dash in a URL override is refused and nothing is written", async () => {
    const error = await failure(savePageTitle(admin, { kind: "url", path: cityPath }, { title: `Cities ${EM} India`, description: "Pick a city to browse free classifieds." }));
    expect(error.fields?.title?.[0]).toMatch(/Use a comma/);
    expect(await UrlOverride.collection.countDocuments({})).toBe(0);
  });
});

describe("reset to template", () => {
  it("a category's own row with only a title and description is removed, so it inherits again", async () => {
    await SeoTemplate.collection.insertOne({ pageType: "category:jobs", title: "Jobs in Pune", description: "Browse jobs in Pune on Tharkoo, free." });

    const after = await resetPageTitle(admin, jobsTemplate);

    expect(await SeoTemplate.collection.findOne({ pageType: "category:jobs" })).toBeNull();
    expect(after.saved).toBe(false);
    expect(after.title).toBe("{category} classifieds across India | Tharkoo");
  });

  it("a category's row with a heading keeps the heading and clears the title and description", async () => {
    await SeoTemplate.collection.insertOne({ pageType: "category:jobs", title: "Jobs in Pune", description: "Browse jobs in Pune on Tharkoo, free.", h1: "Jobs in Pune" });

    await resetPageTitle(admin, jobsTemplate);

    const row = await SeoTemplate.collection.findOne({ pageType: "category:jobs" });
    expect(row?.title).toBe("");
    expect(row?.description).toBe("");
    expect(row?.h1).toBe("Jobs in Pune");
  });

  it("the all-category default is cleared, so the page uses its built-in copy", async () => {
    await SeoTemplate.collection.insertOne({ pageType: "category", title: "Custom default", description: "A custom default description for categories." });

    await resetPageTitle(admin, { kind: "template", pageType: "category", categorySlug: null });

    const row = await SeoTemplate.collection.findOne({ pageType: "category" });
    expect(row?.title).toBe("");
    expect(row?.description).toBe("");
  });

  it("an exact address with only a title is deleted; one with an intro keeps the intro", async () => {
    await UrlOverride.collection.insertOne({ path: cityPath, title: "Only a title | Tharkoo", description: "Only a description here." });
    await resetPageTitle(admin, { kind: "url", path: cityPath });
    expect(await UrlOverride.collection.findOne({ path: cityPath })).toBeNull();

    await UrlOverride.collection.insertOne({ path: cityPath, title: "Title | Tharkoo", description: "Description here.", intro: "Kept intro." });
    await resetPageTitle(admin, { kind: "url", path: cityPath });
    const row = await UrlOverride.collection.findOne({ path: cityPath });
    expect(row?.title).toBe("");
    expect(row?.intro).toBe("Kept intro.");
  });

  it("the home page goes back to the built-in title and description", async () => {
    await Site.collection.insertOne({ key: "default", name: "Tharkoo", homepage: { content: { seoTitle: "Custom home title", seoDescription: "A custom home description for the site." } } });

    const after = await resetPageTitle(admin, { kind: "home" });

    expect(after.title).toBe(defaultSiteContent().seoTitle);
    expect(after.description).toBe(defaultSiteContent().seoDescription);
    expect(after.saved).toBe(false);
  });
});

describe("the list covers every page type", () => {
  const paths = readPaths(undefined);
  const templates: TemplateMap = new Map([["category:jobs", { title: "Jobs ads in {city}" }]]);

  it("has a group for each page type, with a row for each category, city and country", () => {
    const rows = buildPageTitleRows({
      siteName: "Tharkoo",
      paths,
      home: { title: "Home title", description: "Home description for the site.", saved: false },
      categories: [{ slug: "jobs", name: "Jobs" }],
      countries: [{ slug: "india", name: "India" }],
      templates,
      overrides: new Map(),
    });

    expect(new Set(rows.map((row) => row.group))).toEqual(new Set(PAGE_GROUPS.map((group) => group.id)));
    expect(rows.find((row) => row.id === "home")?.target).toEqual({ kind: "home" });
    expect(rows.find((row) => row.id === "template:category:jobs")).toMatchObject({ title: "Jobs ads in {city}", saved: true, target: jobsTemplate });
    expect(rows.find((row) => row.id === "template:location:jobs")?.target).toEqual({ kind: "template", pageType: "location", categorySlug: "jobs" });
    expect(rows.find((row) => row.id === "template:subcategory:jobs")?.target).toEqual({ kind: "template", pageType: "subcategory", categorySlug: "jobs" });
    expect(rows.find((row) => row.group === "ad")?.target).toBeNull();
    expect(rows.find((row) => row.id === `url:${cleanPath(countryPath("india"))}`)?.target).toEqual({ kind: "url", path: cleanPath(countryPath("india")) });
    expect(rows.find((row) => row.id === `url:${cleanPath(postAdPath(paths))}`)?.target).toEqual({ kind: "url", path: cleanPath(postAdPath(paths)) });
  });

  it("a list read from an empty site still shows the home, fixed pages and the post-ad page", async () => {
    const rows = await listPageTitles();
    expect(rows.find((row) => row.id === "home")).toBeDefined();
    expect(rows.some((row) => row.group === "static")).toBe(true);
    expect(rows.find((row) => row.label === "Post an ad page")?.title).toBe("Post an ad | Tharkoo");
  });

  it("a district page inherits the city and state default when it has no district default", () => {
    const withCityOnly: TemplateMap = new Map([["location", { title: "{category} in {city} | {site}", description: "City default description." }]]);
    const chain = templateChain("district", "jobs", withCityOnly, null);
    expect(chain.title).toBe("{category} in {city} | {site}");
    expect(chain.saved).toBe(false);
  });
});
