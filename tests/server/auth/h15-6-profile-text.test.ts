import { describe, expect, it } from "vitest";
import { profileSteps } from "@/lib/ui/profile-progress";
import { sellerProfileBodySchema } from "@/server/auth/seller-profile";

/** FIX-6 (E1-B1, E1-B3): the live chat step opens Settings, and the profile form says what is wrong in plain words. */

const base = { name: "Asha", city: "Mumbai", whatsapp: "", availableNow: false };

function messages(body: Record<string, unknown>) {
  const result = sellerProfileBodySchema.safeParse({ ...base, ...body });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe("FIX-6: the live chat step and the profile messages", () => {
  const input = { hasProfile: false, emailVerified: false, whatsapp: false, idChecked: false, hasAd: false, liveChat: false };

  it("the Turn on live chat step opens Settings, where the switches live", () => {
    const step = profileSteps(input).find((item) => item.key === "chat");
    expect(step?.label).toBe("Turn on live chat");
    expect(step?.href).toBe("/u/account/edit-account/");
  });

  it("an empty city says Choose your city, not a raw validation text", () => {
    expect(messages({ city: "" })).toEqual({ city: "Choose your city." });
  });

  it("a one letter name says what to do", () => {
    expect(messages({ name: "A" })).toEqual({ name: "Add your name, at least 2 letters." });
  });

  it("a number with letters says what to use", () => {
    expect(messages({ whatsapp: "98x" })).toEqual({ whatsapp: "Use digits only, with a + at the start if you like." });
  });

  it("no message of the schema is raw developer text", () => {
    const all = Object.values(messages({ name: "", city: "", whatsapp: "abc", dateOfBirth: "yesterday" }));
    expect(all.length).toBeGreaterThan(3);
    for (const text of all) expect(text).not.toMatch(/expected|Too small|Too big|Invalid|string|>=|<=/);
  });
});
