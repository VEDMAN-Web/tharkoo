import { describe, expect, it } from "vitest";
import { evaluatePublishGate, parseDateOnly, type PublishGateInput } from "@/server/shared";

const now = new Date("2026-10-28T12:00:00.000Z");

function input(overrides: Partial<PublishGateInput> = {}): PublishGateInput {
  return {
    dateOfBirth: parseDateOnly("1995-04-02"),
    attestedAdult: true,
    verificationStatus: "approved",
    accountStatus: "active",
    categorySlug: "vehicles",
    categoryName: "Vehicles",
    categoryEnabled: true,
    mediaCleared: true,
    attributes: { make: "Honda", year: 2018 },
    now,
    ...overrides,
  };
}

describe("publish gates", () => {
  it("allows an approved adult with cleared media in an allowed category", () => {
    expect(evaluatePublishGate(input())).toEqual({ ok: true });
  });

  it("blocks underage dates of birth", () => {
    expect(evaluatePublishGate(input({ dateOfBirth: parseDateOnly("2012-01-01") })).ok).toBe(false);
    expect(evaluatePublishGate(input({ dateOfBirth: parseDateOnly("2012-01-01") }))).toMatchObject({
      reason: "UNDERAGE",
    });
  });

  it("blocks a missing adult attestation", () => {
    expect(evaluatePublishGate(input({ attestedAdult: false }))).toMatchObject({
      reason: "ADULT_ATTESTATION_REQUIRED",
    });
  });

  it.each(["unsubmitted", "pending_review", "rejected"] as const)(
    "blocks verification status %s",
    (verificationStatus) => {
      expect(evaluatePublishGate(input({ verificationStatus }))).toMatchObject({
        reason: "VERIFICATION_REQUIRED",
      });
    },
  );

  it("blocks uncleared media after KYC is approved", () => {
    expect(evaluatePublishGate(input({ mediaCleared: false }))).toMatchObject({
      reason: "MEDIA_NOT_CLEARED",
    });
  });

  it("blocks suspended accounts", () => {
    expect(evaluatePublishGate(input({ accountStatus: "suspended" }))).toMatchObject({
      reason: "ACCOUNT_NOT_ACTIVE",
    });
  });

  it("blocks denied categories even when the advertiser is verified", () => {
    const result = evaluatePublishGate(
      input({ categorySlug: "escort", categoryName: "Escort", categoryEnabled: true }),
    );
    expect(result).toMatchObject({ ok: false, reason: "CATEGORY_DENIED" });
    expect(
      evaluatePublishGate(input({ categorySlug: "paid-meetings", categoryName: "Paid meetings" }))
        .ok,
    ).toBe(false);
    expect(
      evaluatePublishGate(input({ categorySlug: "roommates", categoryName: "Roommates" })).ok,
    ).toBe(false);
  });

  it("blocks disabled categories and pricing attributes", () => {
    expect(evaluatePublishGate(input({ categoryEnabled: false }))).toMatchObject({
      reason: "CATEGORY_DISABLED",
    });
    expect(evaluatePublishGate(input({ attributes: { hourlyRate: 2000 } }))).toMatchObject({
      ok: false,
      reason: "ATTRIBUTE_DENIED",
    });
    expect(evaluatePublishGate(input({ attributes: { age: 17 } }))).toMatchObject({
      reason: "UNDERAGE",
    });
  });
});
