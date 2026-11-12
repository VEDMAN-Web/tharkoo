import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isListingBuiltin, listingHeading, listingScopes } from "@/lib/layout/listing";
import { getPageBlocks } from "@/lib/layout/read";
import { LISTING_TEMPLATE_VARS, listingDefaultBlocks } from "@/server/layout/defaults/listing";
import { publish, saveDraft, validateBlocks } from "@/server/layout/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

beforeAll(async () => {
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("listing default blocks", () => {
  it("are valid blocks for a listing page", () => {
    const blocks = validateBlocks("listing", listingDefaultBlocks(), new Set());
    expect(blocks.map((block) => block.type)).toEqual(["filters", "listingHeader", "listingFeed", "relatedCategories", "nearbyCities"]);
  });

  it("keep today's look: 6-ad band, 5 nearby links, h1 left to the SEO templates, Updated line on", () => {
    const [filters, header, feed, related, nearby] = listingDefaultBlocks();
    expect(filters.props.enabled).toEqual(["verified", "photos"]);
    expect(header.props).toMatchObject({ h1Template: "{h1}", showCount: false, showUpdated: true });
    expect(feed.props.inFeedEvery).toBe(6);
    expect(related.props.max).toBe(6);
    expect(nearby.props.max).toBe(5);
    expect(LISTING_TEMPLATE_VARS).toContain("h1");
  });

  it("have fixed ids so a page works without a published layout", () => {
    expect(listingDefaultBlocks().map((block) => block.id)).toEqual(listingDefaultBlocks().map((block) => block.id));
    expect(new Set(listingDefaultBlocks().map((block) => block.id)).size).toBe(5);
  });
});

describe("listing scopes and headings", () => {
  it("try the exact URL, then the category, then the default", () => {
    expect(listingScopes("/property/surat/", "property")).toEqual(["url:/property/surat/", "category:property", "default"]);
    expect(listingScopes("property/surat/?photos=1", "property")[0]).toBe("url:/property/surat/");
    expect(listingScopes("/property/", "Bad Slug")).toEqual(["url:/property/", "default"]);
  });

  it("uses the page's own h1 unless the layout gives a template", () => {
    const vars = { category: "Property", city: "Surat", count: 12 };
    expect(listingHeading("{h1}", "Property in Surat", vars)).toBe("Property in Surat");
    expect(listingHeading("", "Property in Surat", vars)).toBe("Property in Surat");
    expect(listingHeading("{category} for rent in {city} ({count} ads)", "Property in Surat", vars)).toBe("Property for rent in Surat (12 ads)");
    expect(listingHeading("{h1} - updated daily", "Property in Surat", vars)).toBe("Property in Surat - updated daily");
  });

  it("knows which block types the page draws itself", () => {
    for (const type of ["filters", "listingHeader", "listingFeed", "districtLinks", "nearbyCities", "relatedCategories"]) expect(isListingBuiltin(type)).toBe(true);
    for (const type of ["richText", "banner", "faq", "seoText"]) expect(isListingBuiltin(type)).toBe(false);
  });
});

describe("listing layouts per scope", () => {
  const withText = (text: string) => [...listingDefaultBlocks().map(({ id: _id, ...rest }) => rest), { type: "richText", visible: true, props: { body: text } }];

  it("a category layout changes only that category, a url layout only that page", async () => {
    for (const [scope, text] of [["default", "everyone"], ["category:property", "property pages"], ["url:/property/surat/", "surat only"]] as const) {
      await saveDraft({ key: "listing", scope, blocks: withText(text), ...admin });
      await publish({ key: "listing", scope, ...admin });
    }
    const text = async (path: string, category: string) =>
      (await getPageBlocks("listing", listingScopes(path, category)))!.find((block) => block.type === "richText")!.props.body;
    expect(await text("/property/surat/", "property")).toBe("surat only");
    expect(await text("/property/pune/", "property")).toBe("property pages");
    expect(await text("/jobs/pune/", "jobs")).toBe("everyone");
  });

  it("refuses a layout that drops the heading or the ads once they are saved", async () => {
    const saved = await saveDraft({ key: "listing", scope: "default", blocks: withText("x"), ...admin });
    const withoutFeed = saved.blocks.filter((block) => block.type !== "listingFeed");
    await expect(saveDraft({ key: "listing", scope: "default", blocks: withoutFeed, ...admin })).rejects.toThrow(/required/i);
    const withoutHeader = saved.blocks.filter((block) => block.type !== "listingHeader");
    await expect(saveDraft({ key: "listing", scope: "default", blocks: withoutHeader, ...admin })).rejects.toThrow(/required/i);
  });
});
