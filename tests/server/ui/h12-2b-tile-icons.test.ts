import mongoose from "mongoose";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import HowItWorksPage from "@/app/how-it-works/page";
import { HelpArticleView } from "@/components/h714/HelpArticleView";
import { withCategoryIcons } from "@/server/categories/icons";
import { taggedPicture } from "@/server/layout/page-picture";
import { CategoryKindDef, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

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

const media = (tags: string[], extra: Record<string, unknown> = {}) =>
  SiteMedia.create({ url: "/uploads/abcdefabcdefabcdefabcdef.webp", objectKey: `k-${Math.random()}`, alt: "Two people on a video call", contentType: "image/webp", tags, ...extra });

describe("H12.2b a: the icon of a tile with no photo comes from the category setting", () => {
  it("uses the category's own pick first, then the icon of its Kind, then the default for the Kind, then a tag", async () => {
    await CategoryKindDef.create({ key: "goods", name: "Goods", icon: "gem", builtIn: true, order: 0 });
    const rows = await withCategoryIcons([
      { slug: "cars", kind: "vehicle", icon: "car" },
      { slug: "shop", kind: "goods", icon: "" },
      { slug: "homes", kind: "property", icon: "" },
      { slug: "misc", kind: "", icon: "not-an-icon" },
    ]);
    expect(rows.map((row) => row.icon)).toEqual(["car", "gem", "house", "tag"]);
  });

  it("a people listing keeps the people icon unless its own pick says otherwise", async () => {
    const rows = await withCategoryIcons([
      { slug: "dating", kind: "goods", icon: "" },
      { slug: "friendship", kind: "goods", icon: "users" },
    ]);
    expect(rows.map((row) => row.icon)).toEqual(["heart", "users"]);
  });
});

describe("H12.2b b: the How it works picture comes from the Media library", () => {
  it("is the newest picture tagged how-it-works, with its own alt text, never a trashed one", async () => {
    expect(await taggedPicture("how-it-works")).toBeNull();
    await media(["how-it-works"], { alt: "Old picture", createdAt: new Date("2026-01-01") });
    await media(["other"], { alt: "Not this one" });
    await media(["how-it-works"], { alt: "Trashed picture", trashedAt: new Date(), createdAt: new Date("2026-03-01") });
    await media(["how-it-works"], { alt: "Newest picture", createdAt: new Date("2026-02-01") });
    expect(await taggedPicture("how-it-works")).toEqual({ src: "/uploads/abcdefabcdefabcdefabcdef.webp", alt: "Newest picture" });
  });

  it("the page hands that picture to the view, and hands null (no box) when none is tagged", async () => {
    const none = (await HowItWorksPage()) as { props: { photo: unknown } };
    expect(none.props.photo).toBeNull();
    await media(["how-it-works"]);
    const some = (await HowItWorksPage()) as { props: { photo: { alt: string } | null } };
    expect(some.props.photo?.alt).toBe("Two people on a video call");
  });
});

describe("H12.2b c: the Help article breadcrumb shows each step once", () => {
  const crumb = (section: string) =>
    renderToStaticMarkup(
      createElement(HelpArticleView, { helpRoot: "/help/", section, title: "Credits and wallet", updatedLabel: "Updated", readLabel: "2 min", related: [], body: "Text", contactHref: "/contact/" }),
    ).match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? "";

  it("drops the section crumb when the section is just Help", () => {
    const text = crumb("Help").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(text).toBe("Help / Credits and wallet");
  });

  it("keeps a real section between Help and the title", () => {
    const text = crumb("Credits").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(text).toBe("Help / Credits / Credits and wallet");
  });
});
