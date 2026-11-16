import { describe, expect, it } from "vitest";
import { blogDescription, blogIndexJsonLd, homeSiteNodes, newestFirst } from "@/lib/seo/home-blog";
import { organizationNode } from "@/lib/seo/schema";

const types = (nodes: Record<string, unknown>[]) => nodes.map((node) => node["@type"]);

describe("home JSON-LD", () => {
  it("adds one Organization and one WebSite, and no second WebPage", () => {
    const nodes = homeSiteNodes(organizationNode("Tharkoo"), "Tharkoo", "/search/");
    expect(types(nodes)).toEqual(["Organization", "WebSite"]);
    expect(nodes[1]).toMatchObject({ name: "Tharkoo" });
  });
});

describe("blog description", () => {
  it("keeps whole sentences up to 155 characters with no newlines", () => {
    const body = "Meeting someone new is exciting.\nHere is how to stay safe.\n\nAlways meet in a public place and tell a friend where you are going. Never send money in advance to anyone you have not met.";
    const out = blogDescription(body);
    expect(out).toBe("Meeting someone new is exciting. Here is how to stay safe. Always meet in a public place and tell a friend where you are going.");
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out).not.toMatch(/\n/);
  });

  it("cuts a long first sentence on a word boundary", () => {
    const body = `${"word ".repeat(60)}end.`;
    const out = blogDescription(body);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("word")).toBe(true);
    expect(out).not.toMatch(/\s{2}|\n/);
  });
});

describe("blog index", () => {
  it("sorts posts newest first and keeps posts with no date last", () => {
    const sorted = newestFirst([
      { slug: "old", date: "2026-01-05" },
      { slug: "none" },
      { slug: "new", date: "2026-09-30" },
      { slug: "mid", date: "2026-05-10" },
    ]);
    expect(sorted.map((post) => post.slug)).toEqual(["new", "mid", "old", "none"]);
  });

  it("writes Blog and CollectionPage nodes with an ItemList in the same order", () => {
    const nodes = blogIndexJsonLd({
      name: "Tharkoo Blog",
      path: "/blog/",
      posts: [
        { title: "First", path: "/blog/first/" },
        { title: "Second", path: "/blog/second/" },
      ],
    });
    expect(types(nodes)).toEqual(["Blog", "CollectionPage"]);
    const list = (nodes[1].mainEntity as { "@type": string; itemListElement: { position: number; name: string; url: string }[] });
    expect(list["@type"]).toBe("ItemList");
    expect(list.itemListElement.map((item) => [item.position, item.name])).toEqual([[1, "First"], [2, "Second"]]);
    expect(list.itemListElement[0].url).toMatch(/\/blog\/first\/$/);
  });
});
