import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };

const savedNoindex = process.env["SITE_NOINDEX"];

async function rulesOf(): Promise<Rule[]> {
  return ([] as Rule[]).concat((await robots()).rules as Rule | Rule[]);
}

describe("robots.txt", () => {
  afterEach(() => {
    if (savedNoindex === undefined) delete process.env["SITE_NOINDEX"];
    else process.env["SITE_NOINDEX"] = savedNoindex;
  });

  it("returns exactly one rule set for all crawlers when the site is indexable", async () => {
    delete process.env["SITE_NOINDEX"];
    const rules = await rulesOf();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/"] });
  });

  it("keeps the sitemap line in the indexable branch", async () => {
    delete process.env["SITE_NOINDEX"];
    expect((await robots()).sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("disallows the whole site when SITE_NOINDEX is true", async () => {
    process.env["SITE_NOINDEX"] = "true";
    const rules = await rulesOf();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.disallow).toBe("/");
  });
});
