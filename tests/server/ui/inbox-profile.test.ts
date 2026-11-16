import { describe, expect, it } from "vitest";
import { chatTime } from "@/lib/ui/chat-time";
import { profileProgress, profileSteps } from "@/lib/ui/profile-progress";

const now = new Date("2026-11-16T10:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

describe("chat time (H7.82)", () => {
  it("says Now, minutes, hours, Yesterday, then the date", () => {
    expect(chatTime(ago(0), now)).toBe("Now");
    expect(chatTime(ago(5), now)).toBe("5 min");
    expect(chatTime(ago(125), now)).toBe("2 h");
    expect(chatTime(ago(60 * 30), now)).toBe("Yesterday");
    expect(chatTime(ago(60 * 24 * 5), now)).toBe("11 Nov");
    expect(chatTime("not a date", now)).toBe("");
  });
});

describe("your profile card (H7.82)", () => {
  const base = { hasProfile: true, emailVerified: false, whatsapp: false, idChecked: false, hasAd: false, liveChat: false };

  it("counts what is done and lists the first three missing steps with their links", () => {
    const result = profileProgress(base);
    expect(result.percent).toBe(17);
    expect(result.missing.map((step) => step.key)).toEqual(["email", "whatsapp", "id"]);
    expect(result.missing[2].href).toBe("/u/account/kyc/");
  });

  it("reaches 100 percent with nothing missing", () => {
    const full = profileProgress({ hasProfile: true, emailVerified: true, whatsapp: true, idChecked: true, hasAd: true, liveChat: true });
    expect(full).toEqual({ percent: 100, missing: [] });
  });

  it("moves on to the next missing steps as steps are done", () => {
    const result = profileProgress({ ...base, emailVerified: true, whatsapp: true });
    expect(result.percent).toBe(50);
    expect(result.missing.map((step) => step.key)).toEqual(["id", "ad", "chat"]);
    expect(profileSteps(base)).toHaveLength(6);
  });
});
