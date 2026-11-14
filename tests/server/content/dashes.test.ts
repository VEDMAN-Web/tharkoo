import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertNoDashes, dashFields, DASH_CHARS, DASH_MESSAGE } from "@/server/content/dashes";
import { repairDashes, repairDemoListingDashes } from "@/server/content/dash-repair";
import { Category, Listing, User } from "@/server/models";
import { CATEGORIES, demoListings, SEED_USER_EMAIL } from "@/server/seed/data";
import { POST as cronPost } from "@/app/api/cron/expire/route";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** The viewer the mocked staff check returns; each test sets it before calling the action. */
let viewer = { verified: true, kind: "person", email: "staff@example.com", name: "Staff", roles: ["seo_editor"] };

vi.mock("@/lib/admin-auth", () => ({
  getStaffFromHeaders: async () => viewer,
  isStaff: (identity: { verified: boolean; roles: string[] }) => identity.verified && identity.roles.length > 0,
}));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const CRON_SECRET = "dash-cron-secret";

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

/** One demo ad owned by the seed user and one real ad, both with a dash in the title and the description. */
async function insertDemoAndRealAds() {
  const seedUserId = new mongoose.Types.ObjectId();
  const realOwnerId = new mongoose.Types.ObjectId();
  await User.collection.insertMany([
    { _id: seedUserId, email: SEED_USER_EMAIL },
    { _id: realOwnerId, email: "real.owner@example.com" },
  ]);
  await Listing.collection.insertMany([
    {
      ownerId: seedUserId,
      slug: "demo-0001",
      status: "active",
      title: `Coffee in Mumbai ${EM} Mumbai dating`,
      description: `Looking to meet ${EN} Mumbai.`,
    },
    {
      ownerId: realOwnerId,
      slug: "real-ad-1",
      status: "active",
      title: `Bike for sale ${EM} like new`,
      description: `Ring me ${EN} evenings`,
    },
  ]);
}

/** Every seed and content source file, so a dash cannot creep back into the seeded text. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|json|md)$/.test(entry.name) ? [full] : [];
  });
}

describe("dashes in admin text", () => {
  it("detects both an em dash and an en dash, and nothing else", () => {
    expect(DASH_CHARS.test(`a ${EM} b`)).toBe(true);
    expect(DASH_CHARS.test(`a ${EN} b`)).toBe(true);
    expect(DASH_CHARS.test("a | b, c: d.")).toBe(false);
  });

  it("names the fields that contain a dash and refuses them with the clear message", () => {
    expect(dashFields({ seoTitle: `x ${EM} y`, seoDescription: "plain", h1: `z ${EN} w` })).toEqual(["seoTitle", "h1"]);
    let caught: { fields?: Record<string, string[]> } | undefined;
    try {
      assertNoDashes({ seoTitle: `x ${EM} y` });
    } catch (error) {
      caught = error as { fields?: Record<string, string[]> };
    }
    expect(caught?.fields?.seoTitle).toEqual([DASH_MESSAGE]);
    expect(() => assertNoDashes({ seoTitle: "x | y" })).not.toThrow();
  });
});

describe("stored dashes are repaired, idempotently", () => {
  it("replaces dashes in titles with a pipe and in body text with a comma, and a second run changes nothing", async () => {
    await Category.collection.insertOne({
      slug: "cars",
      name: `Cars ${EM} used`,
      seoTitle: `Tharkoo ${EM} Free classifieds in India`,
      introHtml: `Buy and sell ${EN} locally`,
      fields: [],
      enabled: true,
    });
    const first = await repairDashes("req-dash-1");
    expect(first.updated).toBe(1);
    const row = await Category.collection.findOne({ slug: "cars" });
    expect(row?.name).toBe("Cars | used");
    expect(row?.seoTitle).toBe("Tharkoo | Free classifieds in India");
    expect(row?.introHtml).toBe("Buy and sell, locally");
    const second = await repairDashes("req-dash-2");
    expect(second.updated).toBe(0);
  });
});

describe("repair keeps database types intact", () => {
  it("does not turn an ObjectId reference into a plain object", async () => {
    const parent = new mongoose.Types.ObjectId();
    await Category.collection.insertOne({ slug: "child", name: `Child ${EM} thing`, parentId: parent, fields: [], enabled: true });
    await repairDashes("req-dash-3");
    const row = await Category.collection.findOne({ slug: "child" });
    expect(row?.parentId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(row?.parentId)).toBe(String(parent));
  });
});

describe("demo ads are repaired, real ads are never touched", () => {
  it("repairs only the seed user's ads, and a second run changes nothing", async () => {
    await insertDemoAndRealAds();
    const first = await repairDemoListingDashes("req-demo-1");
    expect(first.updated).toBe(1);
    const demo = await Listing.collection.findOne({ slug: "demo-0001" });
    expect(demo?.title).toBe("Coffee in Mumbai, Mumbai dating");
    expect(demo?.description).toBe("Looking to meet, Mumbai.");
    const real = await Listing.collection.findOne({ slug: "real-ad-1" });
    expect(real?.title).toBe(`Bike for sale ${EM} like new`);
    expect(real?.description).toBe(`Ring me ${EN} evenings`);
    const second = await repairDemoListingDashes("req-demo-2");
    expect(second.updated).toBe(0);
  });

  it("the daily cron repairs stored text and demo ads, and leaves a real ad with its dash", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    await insertDemoAndRealAds();
    await Category.collection.insertOne({ slug: "cron-cars", name: `Cars ${EM} used`, fields: [], enabled: true });
    const headers = new Headers({ "x-cron-secret": CRON_SECRET, "content-type": "application/json" });
    const res = await cronPost(new Request("http://localhost/api/cron/expire", { method: "POST", headers, body: "{}" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { dashesUpdated: number; demoListingDashesUpdated: number } };
    expect(body.data.dashesUpdated).toBeGreaterThanOrEqual(1);
    expect(body.data.demoListingDashesUpdated).toBe(1);
    const category = await Category.collection.findOne({ slug: "cron-cars" });
    expect(category?.name).toBe("Cars | used");
    const demo = await Listing.collection.findOne({ slug: "demo-0001" });
    expect(demo?.title).toBe("Coffee in Mumbai, Mumbai dating");
    const real = await Listing.collection.findOne({ slug: "real-ad-1" });
    expect(real?.title).toBe(`Bike for sale ${EM} like new`);
  });
});

describe("the Fix long dashes button", () => {
  it("refuses everyone but a superadmin and leaves the text alone", async () => {
    viewer = { ...viewer, roles: ["admin"] };
    await Category.collection.insertOne({ slug: "button-cars", name: `Cars ${EM} used`, fields: [], enabled: true });
    const { repairDashesAction } = await import("@/app/admin/seo/tools/actions");
    const out = await repairDashesAction();
    expect(out.ok).toBe(false);
    const row = await Category.collection.findOne({ slug: "button-cars" });
    expect(row?.name).toBe(`Cars ${EM} used`);
  });

  it("runs for a superadmin and returns the count it changed", async () => {
    viewer = { ...viewer, roles: ["superadmin"] };
    await Category.collection.insertOne({ slug: "button-bikes", name: `Bikes ${EM} used`, fields: [], enabled: true });
    const { repairDashesAction } = await import("@/app/admin/seo/tools/actions");
    const out = await repairDashesAction();
    expect(out).toMatchObject({ ok: true, updated: 1 });
    const row = await Category.collection.findOne({ slug: "button-bikes" });
    expect(row?.name).toBe("Bikes | used");
  });
});

describe("the demo seed data has no dash", () => {
  it("has no dash in the demo ads or the category text", () => {
    expect(demoListings().length).toBeGreaterThan(0);
    expect(DASH_CHARS.test(JSON.stringify(demoListings()))).toBe(false);
    expect(DASH_CHARS.test(JSON.stringify(CATEGORIES))).toBe(false);
  });

  it("has no dash in the seed, content or data source files", () => {
    const src = fileURLToPath(new URL("../../../src", import.meta.url));
    const files = ["server/seed", "content", "data"].flatMap((dir) => sourceFiles(path.join(src, dir)));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(DASH_CHARS.test(readFileSync(file, "utf8")), file).toBe(false);
  });
});
