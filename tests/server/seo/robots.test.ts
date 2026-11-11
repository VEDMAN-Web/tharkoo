import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };

const savedNoindex = process.env["SITE_NOINDEX"];

function rulesOf(): Rule[] {
  return ([] as Rule[]).concat(robots().rules as Rule | Rule[]);
}

describe("robots.txt", () => {
  afterEach(() => {
    if (savedNoindex === undefined) delete process.env["SITE_NOINDEX"];
    else process.env["SITE_NOINDEX"] = savedNoindex;
  });

  it("returns exactly one rule set for all crawlers when the site is indexable", () => {
    delete process.env["SITE_NOINDEX"];
    const rules = rulesOf();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/"] });
  });

  it("keeps the sitemap line in the indexable branch", () => {
    delete process.env["SITE_NOINDEX"];
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("disallows the whole site when SITE_NOINDEX is true", () => {
    process.env["SITE_NOINDEX"] = "true";
    const rules = rulesOf();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.disallow).toBe("/");
  });
});
