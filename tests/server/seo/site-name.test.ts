import { describe, expect, it } from "vitest";
import { canonical } from "@/lib/seo";
import { homeSiteNodes } from "@/lib/seo/home-blog";
import { organizationNode, webPageNode } from "@/lib/seo/schema";

// canonical("/") is https://www.tharkoo.com/ in production; the test env uses its own origin.
const SITE_ID = `${canonical("/")}#website`;
const ORG_ID = `${canonical("/")}#organization`;

describe("site name for search engines", () => {
  const nodes = homeSiteNodes(organizationNode("Tharkoo"), "Tharkoo", "/search/");
  const sites = nodes.filter((node) => node["@type"] === "WebSite");

  it("has exactly one WebSite named Tharkoo with the alternate name and a stable id", () => {
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ "@id": SITE_ID, name: "Tharkoo", alternateName: ["Tharkoo.com"] });
    expect(sites[0].potentialAction).toMatchObject({ "@type": "SearchAction" });
  });

  it("gives the Organization a stable id", () => {
    expect(nodes.find((node) => node["@type"] === "Organization")).toMatchObject({ "@id": ORG_ID });
  });

  it("points every WebPage at the same site id", () => {
    const page = webPageNode({ name: "Home", path: "/", siteName: "Tharkoo" });
    expect(page.isPartOf["@id"]).toBe(SITE_ID);
  });

  it("renders blocks that parse as JSON", () => {
    const page = webPageNode({ name: "Home", path: "/", siteName: "Tharkoo" });
    for (const node of [...nodes, page]) expect(() => JSON.parse(JSON.stringify(node))).not.toThrow();
  });
});
