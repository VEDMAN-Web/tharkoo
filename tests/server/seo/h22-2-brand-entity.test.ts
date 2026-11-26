import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeSiteNodes } from "@/lib/seo/home-blog";
import { ORGANIZATION_DESCRIPTION, organizationFromSettings, organizationId } from "@/lib/seo/schema";

/** H22.2: the home page's Organization and WebSite say who the brand is. */

beforeEach(() => vi.stubEnv("SITE_URL", "https://www.tharkoo.com"));
afterEach(() => vi.unstubAllEnvs());

const home = (settings?: { sameAs?: string[] }) => homeSiteNodes(organizationFromSettings("Tharkoo", {}, settings), "Tharkoo", "/search/") as unknown as Record<string, unknown>[];
const pick = (nodes: Record<string, unknown>[], type: string) => nodes.find((node) => node["@type"] === type)!;

describe("H22.2 brand entity signals", () => {
  it("describes the Organization on the home page", () => {
    const org = pick(home(), "Organization");
    expect(org).toMatchObject({
      name: "Tharkoo",
      alternateName: ["Tharkoo.com"],
      description: "Tharkoo (tharkoo.com) is a free classifieds website in India. Post an ad, find local listings and contact people after an ID check.",
      areaServed: { "@type": "Country", name: "India" },
      url: "https://www.tharkoo.com/",
    });
    expect(org.description).toBe(ORGANIZATION_DESCRIPTION);
  });

  it("points the WebSite at the Organization and says its language", () => {
    const nodes = home();
    const site = pick(nodes, "WebSite");
    expect(site.publisher).toEqual({ "@id": pick(nodes, "Organization")["@id"] });
    expect(site.publisher).toEqual({ "@id": organizationId() });
    expect(site.inLanguage).toBe("en-IN");
  });

  it("writes no sameAs while the admin list is empty, and keeps the admin links when there are some", () => {
    expect(pick(home(), "Organization")).not.toHaveProperty("sameAs");
    expect(pick(home({ sameAs: [] }), "Organization")).not.toHaveProperty("sameAs");
    expect(pick(home({ sameAs: ["https://x.example/tharkoo"] }), "Organization").sameAs).toEqual(["https://x.example/tharkoo"]);
  });
});
