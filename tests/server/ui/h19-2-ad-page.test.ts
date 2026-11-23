import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIMILAR_ADS_MAX } from "@/components/new/SimilarAds";
import { TEXT_DEFAULTS } from "@/lib/ui/text";

/** H19.2: the ad page. */

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("the ad page", () => {
  it("shows four similar ads", () => {
    expect(SIMILAR_ADS_MAX).toBe(4);
  });

  it("has no sample box and builds its own place crumbs without the category in the city name", () => {
    const page = read("src/components/new/NewAdDetail.tsx");
    expect(page).not.toContain("sample-banner");
    expect(page).toContain("placeCrumbs");
    expect(page).not.toMatch(/name: `\$\{city\} \$\{categoryName\}`/);
    expect(TEXT_DEFAULTS["ad.crumb.home"]).toBe("Tharkoo India");
  });

  it("the vendor on their own ad gets Edit and Boost instead of the contact buttons", () => {
    const buttons = read("src/components/ContactButtons.tsx");
    expect(buttons).toContain("isOwner && listingId");
    expect(buttons.indexOf("isOwner && listingId")).toBeLessThan(buttons.indexOf('data-tk="chat"'));
    expect(TEXT_DEFAULTS["ad.owner.title"]).toBe("This is your ad");
    expect(TEXT_DEFAULTS["ad.owner.edit"]).toBe("Edit");
    expect(TEXT_DEFAULTS["ad.owner.boost"]).toBe("Boost");
    expect(read("src/app/ad/[slug]/page.tsx")).toContain("ownerId=");
  });
});
