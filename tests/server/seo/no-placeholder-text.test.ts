import mongoose from "mongoose";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { publicParagraphs } from "@/components/new/legal-copy";
import { TRUST } from "@/content/trust";
import { shardEntries } from "@/lib/seo/sitemaps";
import { Page } from "@/server/models";
import ProhibitedPage from "@/app/prohibited-items/page";
import SafetyPage from "@/app/safety/page";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

async function htmlOf(Page: () => ReactElement): Promise<string> {
  const element = Page();
  const render = element.type as (props: unknown) => ReactElement | Promise<ReactElement>;
  return renderToStaticMarkup(typeof render === "function" ? await render(element.props) : element);
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
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

describe("no placeholder text reaches a visitor (H7.126)", () => {
  it("the trust copy holds no placeholder and no postal address line at all", () => {
    for (const [key, page] of Object.entries(TRUST)) {
      const raw = page.paragraphs.join(" ").toLowerCase();
      expect(raw, key).not.toContain("[placeholder");
      expect(raw, key).not.toContain("postal address");
      expect(raw, key).not.toContain("ved to confirm");
    }
  });

  it("every trust page keeps no placeholder after the public filter", () => {
    for (const [key, page] of Object.entries(TRUST)) {
      const shown = publicParagraphs(page.paragraphs, key).join("\n");
      expect(shown.toLowerCase(), key).not.toContain("[placeholder");
    }
  });

  it("the Safety and Prohibited items pages render no placeholder", async () => {
    for (const Page of [SafetyPage, ProhibitedPage]) {
      const html = await htmlOf(Page);
      expect(html.toLowerCase()).not.toContain("[placeholder");
      expect(html.toLowerCase()).not.toContain("ved to confirm");
    }
  });
});

describe("the content sitemap (H7.126)", () => {
  it("lists a CMS page only when it is published, once, and never the redirecting short paths", async () => {
    await Page.create({ slug: "about", title: "About Tharkoo", body: "About us.", status: "published" });
    const entries = await shardEntries("content");
    const locs = entries.map((entry) => entry.loc);
    expect(locs.filter((loc) => loc.endsWith("/cms/about/"))).toHaveLength(1);
    expect(locs.some((loc) => loc.endsWith("/cms/grievance/"))).toBe(false);
    expect(locs.some((loc) => /\/(about|grievance)\/$/.test(loc) && !loc.includes("/cms/"))).toBe(false);
    expect(new Set(locs).size).toBe(locs.length);
  });
});
