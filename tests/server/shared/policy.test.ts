import { describe, expect, it } from "vitest";
import { attributeDenied, categoryDenied, denyTerm, productCodeDenied, textDenied } from "@/server/shared/policy";

describe("category deny-list", () => {
  it.each([
    ["escort", ""],
    ["escorts", "Escorts"],
    ["adult", "Adult"],
    ["adult-services", "Adult services"],
    ["adult_entertainment", "Adult entertainment"],
    ["paid-meetings", "Paid meetings"],
    ["paid_meetings", ""],
    ["companionship", "Companionship"],
    ["companions-for-pay", "Companions for pay"],
    ["sexual-services", "Sexual services"],
    ["sex-work", ""],
    ["roommates", "Roommates"],
    ["roommate", "Roommate"],
    ["incall", ""],
    ["happy-ending", "Happy ending"],
    ["call-girls", "Call girls"],
  ])("rejects %s", (slug, name) => {
    expect(categoryDenied(slug, name).denied).toBe(true);
  });

  it("rejects the fragment-built term", () => {
    const slug = denyTerm("esc", "ort");
    expect(categoryDenied(slug, "").denied).toBe(true);
    expect(categoryDenied(denyTerm("compan", "ionship"), "").denied).toBe(true);
    expect(categoryDenied(denyTerm("sex", "ual-services"), "").denied).toBe(true);
  });

  it.each(["vehicles", "electronics", "furniture", "dating"])("allows %s", (slug) => {
    expect(categoryDenied(slug, slug).denied).toBe(false);
  });
});

describe("attribute deny-list", () => {
  it.each([
    "hourlyRate",
    "nightlyRate",
    "hourly_fee",
    "nightly-fee",
    "rate",
    "rates",
    "price",
    "fees",
    "donation",
    "servicesOffered",
    "serviceMenu",
    "incall",
    "companionshipPrice",
  ])("rejects key %s", (key) => {
    expect(attributeDenied({ [key]: "1000" }).denied).toBe(true);
  });

  it("allows ordinary listing attributes", () => {
    expect(
      attributeDenied({
        make: "Honda",
        year: 2018,
        km: 12000,
        condition: "Used",
      }).denied,
    ).toBe(false);
  });

  it("rejects prohibited values hidden under an allowed key", () => {
    expect(attributeDenied({ notes: "escort" }).denied).toBe(true);
    expect(attributeDenied({ notes: "weekend paid meetings" }).denied).toBe(true);
    expect(attributeDenied({ notes: "garage kept" }).denied).toBe(false);
  });
});

describe("text and product deny-list", () => {
  it("rejects blocked copy and allows ordinary adult wording", () => {
    expect(textDenied("escort available tonight").denied).toBe(true);
    expect(textDenied("paid meetings").denied).toBe(true);
    expect(textDenied("adults selling a used bicycle").denied).toBe(false);
    expect(textDenied("Garage kept hatchback").denied).toBe(false);
  });

  it("allows placement products and rejects blocked SKUs", () => {
    expect(productCodeDenied("featured").denied).toBe(false);
    expect(productCodeDenied("top").denied).toBe(false);
    expect(productCodeDenied("highlight").denied).toBe(false);
    expect(productCodeDenied("super-top").denied).toBe(false);
    expect(productCodeDenied("flash").denied).toBe(false);
    expect(productCodeDenied("companionship-hourly").denied).toBe(true);
    expect(productCodeDenied("vip-night").denied).toBe(true);
  });
});
