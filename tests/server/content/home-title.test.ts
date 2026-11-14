import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { saveHomeSeoForAdmin } from "@/app/admin/content-actions";
import { FixDashesPanel } from "@/app/admin/seo/tools/FixDashesPanel";
import { repairDashes } from "@/server/content/dash-repair";
import { DASH_MESSAGE } from "@/server/content/dashes";
import { readContent } from "@/lib/ui/site-content";
import { Site } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** The viewer the mocked staff check returns; each test sets it before calling the action. */
let viewer = { verified: true, kind: "person", email: "admin@example.com", name: "Admin", roles: ["admin"] };

vi.mock("@/lib/admin-auth", () => ({
  getStaffFromHeaders: async () => viewer,
  isStaff: (identity: { verified: boolean; roles: string[] }) => identity.verified && identity.roles.length > 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const STORED_TITLE = "Free classifieds in India | Tharkoo";
const STORED_DESCRIPTION = "Browse free classifieds in India for jobs, homes and vehicles, then contact the poster after an ID check.";

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
  viewer = { verified: true, kind: "person", email: "admin@example.com", name: "Admin", roles: ["admin"] };
  vi.mocked(revalidatePath).mockClear();
});

describe("the repair covers the home title document", () => {
  it("repairs the title and description that getHomepageContent reads, and a second run changes nothing", async () => {
    await Site.collection.insertOne({
      key: "default",
      name: "Tharkoo",
      homepage: {
        content: {
          seoTitle: `Tharkoo ${EM} Free classifieds in India`,
          seoDescription: `Browse dating ${EN} jobs`,
          hero: { desktop: `Find ${EM} near you` },
        },
      },
    });
    await Site.collection.insertOne({ name: "Old copy", homepage: { content: { seoTitle: `Old ${EM} copy` } } });

    const first = await repairDashes("req-home-1");
    expect(first.updated).toBeGreaterThanOrEqual(1);

    const row = await Site.collection.findOne({ key: "default" });
    const home = readContent(row?.homepage);
    expect(home.seoTitle).toBe("Tharkoo | Free classifieds in India");
    expect(home.seoDescription).toBe("Browse dating, jobs");
    expect(home.hero.desktop).toBe("Find, near you");

    const second = await repairDashes("req-home-2");
    expect(second.updated).toBe(0);
  });

  it("refreshes the home page after a repair that changed text", async () => {
    await Site.collection.insertOne({ key: "default", name: "Tharkoo", homepage: { content: { seoTitle: `A ${EM} B` } } });
    await repairDashes("req-home-3");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("the Home page title and description save", () => {
  it("writes the stored value the public home page reads, and keeps the rest of the homepage", async () => {
    await Site.collection.insertOne({
      key: "default",
      name: "Tharkoo",
      homepage: { content: { ...readContent(undefined), hero: { ...readContent(undefined).hero, desktop: "Keep me" } } },
    });

    const out = await saveHomeSeoForAdmin({ seoTitle: `  ${STORED_TITLE}  `, seoDescription: STORED_DESCRIPTION });
    expect(out).toMatchObject({ ok: true, seoTitle: STORED_TITLE, seoDescription: STORED_DESCRIPTION });

    const row = await Site.collection.findOne({ key: "default" });
    expect(row?.homepage?.content?.seoTitle).toBe(STORED_TITLE);
    const home = readContent(row?.homepage);
    expect(home.seoTitle).toBe(STORED_TITLE);
    expect(home.seoDescription).toBe(STORED_DESCRIPTION);
    expect(home.hero.desktop).toBe("Keep me");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a dash and leaves the stored title alone", async () => {
    await Site.collection.insertOne({ key: "default", name: "Tharkoo", homepage: { content: { seoTitle: STORED_TITLE } } });
    const out = await saveHomeSeoForAdmin({ seoTitle: `Tharkoo ${EM} Free`, seoDescription: STORED_DESCRIPTION });
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ fields: { seoTitle: [DASH_MESSAGE] } });
    const row = await Site.collection.findOne({ key: "default" });
    expect(row?.homepage?.content?.seoTitle).toBe(STORED_TITLE);
  });

  it("refuses an empty title", async () => {
    const out = await saveHomeSeoForAdmin({ seoTitle: "   ", seoDescription: STORED_DESCRIPTION });
    expect(out).toMatchObject({ ok: false, message: "Enter a page title" });
  });

  it("refuses a viewer who is not an admin", async () => {
    viewer = { ...viewer, roles: ["seo_editor"] };
    const out = await saveHomeSeoForAdmin({ seoTitle: STORED_TITLE, seoDescription: STORED_DESCRIPTION });
    expect(out).toMatchObject({ ok: false, message: "Only an admin can edit the homepage" });
    expect(await Site.collection.findOne({ key: "default" })).toBeNull();
  });
});

describe("the Tools button text", () => {
  it("is named Remove long dashes from saved text, with the Page titles tab line under it", () => {
    const html = renderToStaticMarkup(createElement(FixDashesPanel, { canRun: true }));
    expect(html).toContain("Remove long dashes from saved text");
    expect(html).toContain("To edit page titles, use the Page titles tab.");
    expect(html).not.toContain("Fix long dashes");
  });
});
