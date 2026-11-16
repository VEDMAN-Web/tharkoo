import { describe, expect, it } from "vitest";
import { dateLabel, lastSeenLabel, maskEmail, staffRoleLabels, statusLook, subLine } from "@/app/admin/users/_list/format";

const NOW = new Date("2026-11-17T08:00:00Z");

describe("last seen", () => {
  it("reads minutes, then hours and minutes, then a date", () => {
    expect(lastSeenLabel("2026-11-17T07:59:40Z", NOW)).toBe("just now");
    expect(lastSeenLabel("2026-11-17T07:19:00Z", NOW)).toBe("41 min ago");
    expect(lastSeenLabel("2026-11-17T05:50:00Z", NOW)).toBe("2 h 10 min ago");
    expect(lastSeenLabel("2026-11-17T06:00:00Z", NOW)).toBe("2 h ago");
    expect(lastSeenLabel("2026-11-14T12:50:00Z", NOW)).toBe("14 Nov, 18:20");
  });

  it("says never when nothing is known", () => {
    expect(lastSeenLabel(null, NOW)).toBe("never");
    expect(dateLabel(null, NOW)).toBe("unknown");
  });
});

describe("dates in Indian time", () => {
  it("drops the year for this year and keeps it for earlier years", () => {
    expect(dateLabel("2026-11-14T12:50:00Z", NOW)).toBe("14 Nov, 18:20");
    expect(dateLabel("2025-12-31T20:00:00Z", NOW)).toBe("1 Jan, 01:30");
    expect(dateLabel("2025-10-02T10:00:00Z", NOW)).toBe("2 Oct 2025, 15:30");
    expect(dateLabel("2025-10-02T10:00:00Z", NOW, false)).toBe("2 Oct 2025");
  });
});

describe("list text", () => {
  it("shortens the address", () => {
    expect(maskEmail("priya.sharma@gmail.com")).toBe("priya.s@\u2026");
    expect(maskEmail("ann@x.com")).toBe("ann@\u2026");
  });

  it("picks one status badge: banned, then the ID check, then active", () => {
    const base = { status: "active" as const, verification: "unsubmitted" as const, roles: ["user"], city: null as string | null };
    expect(statusLook({ ...base, status: "suspended", verification: "approved" })).toEqual({ tone: "bad", text: "Banned" });
    expect(statusLook({ ...base, verification: "pending_review" }).text).toBe("ID waiting");
    expect(statusLook({ ...base, verification: "approved" }).text).toBe("ID verified");
    expect(statusLook({ ...base, verification: "rejected" }).text).toBe("ID refused");
    expect(statusLook({ ...base, city: "Surat" }).text).toBe("ID not done");
    expect(statusLook(base).text).toBe("Active");
  });

  it("names staff roles in words and leaves normal users out", () => {
    expect(staffRoleLabels(["user", "trust_safety", "support"])).toEqual(["Trust and safety", "Support"]);
    expect(staffRoleLabels(["user"])).toEqual([]);
    expect(subLine({ email: "riya.thakur@x.com", roles: ["user"], city: "Jammu" })).toBe("riya.th@\u2026 \u00b7 seller");
    expect(subLine({ email: "a@x.com", roles: ["user"], city: null })).toBe("a@\u2026 \u00b7 member");
    expect(subLine({ email: "s@x.com", roles: ["support"], city: null })).toBe("s@\u2026 \u00b7 support");
  });
});
