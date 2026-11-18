import { describe, expect, it } from "vitest";
import { friendlyError } from "@/lib/ui/api";
import { PUBLISH_MESSAGES, publishMessage } from "@/lib/ui/publish-errors";

const REASONS = [
  "UNDERAGE",
  "AGE_REQUIRED",
  "ADULT_ATTESTATION_REQUIRED",
  "ACCOUNT_NOT_ACTIVE",
  "VERIFICATION_REQUIRED",
  "MEDIA_NOT_CLEARED",
  "CATEGORY_DENIED",
  "CATEGORY_DISABLED",
  "ATTRIBUTE_DENIED",
] as const;

describe("publish error text (H7.100 d)", () => {
  it("has a plain sentence for every publish block reason and never an upper-case code", () => {
    for (const reason of REASONS) {
      const text = PUBLISH_MESSAGES[reason];
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    }
    expect(Object.keys(PUBLISH_MESSAGES).sort()).toEqual([...REASONS].sort());
  });

  it("shows the photo-check and ID sentences the product asked for", () => {
    expect(publishMessage("MEDIA_NOT_CLEARED")).toBe("Your photos are still being checked. Try again in a minute.");
    expect(publishMessage("VERIFICATION_REQUIRED")).toBe("Verify your ID to publish.");
    expect(publishMessage("SOMETHING_ELSE")).toBeNull();
  });

  it("friendlyError turns a policy code from the server into the sentence", () => {
    expect(friendlyError({ code: "POLICY_VIOLATION", message: "MEDIA_NOT_CLEARED" })).toBe("Your photos are still being checked. Try again in a minute.");
    expect(friendlyError({ code: "VERIFICATION_REQUIRED", message: "Identity verification is required" })).toBe("Verify your ID to publish.");
    expect(friendlyError({ code: "POLICY_VIOLATION", message: "This file is too big (max 100 MB)." })).toBe("This file is too big (max 100 MB).");
  });
});
