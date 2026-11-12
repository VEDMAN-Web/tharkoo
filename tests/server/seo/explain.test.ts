import { describe, expect, it } from "vitest";
import { explainIndexability } from "@/server/seo/explain";

describe("explainIndexability", () => {
  it("marks a thin hub noindex and says by how much", () => {
    const out = explainIndexability({ pageType: "city", count: 2, minimum: 3 });
    expect(out.indexable).toBe(false);
    expect(out.reasons).toEqual(["noindex: 2 ads < minimum 3"]);
    expect(out.editor.href).toBe("/admin/seo/templates/");
  });

  it("indexes a hub that meets the minimum, using the district default of 10", () => {
    expect(explainIndexability({ pageType: "city", count: 3, minimum: 3 }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "district", count: 9 }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "district", count: 10 }).indexable).toBe(true);
  });

  it("never indexes page 2 or later", () => {
    const out = explainIndexability({ pageType: "category", count: 50, minimum: 3, page: 2 });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("page 2");
  });

  it("handles filter parameters: indexable with results, noindex with none", () => {
    const withResults = explainIndexability({ pageType: "city", count: 5, minimum: 3, filtered: true });
    expect(withResults.indexable).toBe(true);
    expect(withResults.reasons.join(" ")).toContain("filter parameters");
    expect(explainIndexability({ pageType: "city", count: 0, minimum: 3, filtered: true }).reasons[0]).toContain("filter parameters with no results");
  });

  it("never indexes a demo ad, even when its flag allows it", () => {
    const out = explainIndexability({ pageType: "ad", demoAd: true, adNoindex: false });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("demo ad");
  });

  it("indexes a live ad that is allowed, and not-indexes ended or flagged ads", () => {
    expect(explainIndexability({ pageType: "ad", adNoindex: false }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "ad", adNoindex: true }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "ad", adNoindex: false, adEnded: true }).reasons[0]).toContain("ended");
  });

  it("explains an alias district as a redirect to the city page", () => {
    const out = explainIndexability({ pageType: "district", count: 40, aliasDistrict: true });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("redirects (301) to the city page");
  });

  it("lets a page override noindex win and points the editor at overrides", () => {
    const out = explainIndexability({ pageType: "city", count: 100, minimum: 3, overrideNoindex: true });
    expect(out.indexable).toBe(false);
    expect(out.reasons[0]).toContain("page override");
    expect(out.editor.href).toBe("/admin/urls/");
  });

  it("never indexes search pages and indexes the home page", () => {
    expect(explainIndexability({ pageType: "search" }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "home" }).indexable).toBe(true);
  });
});
