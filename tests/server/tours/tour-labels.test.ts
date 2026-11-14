import { describe, expect, it } from "vitest";
import { roomLine, tourRequestLabel, tourStatusLabel, videoVerifiedLabel } from "@/components/ad/tourLabels";

describe("tourRequestLabel", () => {
  it("uses the singular for one coin", () => {
    expect(tourRequestLabel(1)).toBe("Video call and verify, 1 coin");
  });

  it("uses the plural for other prices", () => {
    expect(tourRequestLabel(3)).toBe("Video call and verify, 3 coins");
  });
});

describe("videoVerifiedLabel", () => {
  const now = new Date("2026-11-14T10:00:00Z");

  it("shows the badge with the date while it is in force", () => {
    const label = videoVerifiedLabel("2027-02-12T00:00:00Z", now);
    expect(label).toMatch(/^Video verified · \d{1,2} [A-Z][a-z]{2} 2027$/);
  });

  it("accepts a Date as well as a serialized string", () => {
    expect(videoVerifiedLabel(new Date("2027-02-12T00:00:00Z"), now)).toMatch(/^Video verified · /);
  });

  it("hides the badge once the date has passed", () => {
    expect(videoVerifiedLabel("2026-11-01T00:00:00Z", now)).toBeNull();
  });

  it("hides the badge at the exact expiry instant", () => {
    expect(videoVerifiedLabel(now, now)).toBeNull();
  });

  it("hides the badge when there is no date or it is not a date", () => {
    expect(videoVerifiedLabel(null, now)).toBeNull();
    expect(videoVerifiedLabel(undefined, now)).toBeNull();
    expect(videoVerifiedLabel("not a date", now)).toBeNull();
  });
});

describe("roomLine", () => {
  it("shows a join link only for an https room", () => {
    expect(roomLine("https://rooms.example.test/abc")).toEqual({ kind: "link", href: "https://rooms.example.test/abc" });
  });

  it("says the room is not set up when there is no link", () => {
    expect(roomLine(null)).toEqual({ kind: "note", text: "Room is not set up yet" });
    expect(roomLine(undefined)).toEqual({ kind: "note", text: "Room is not set up yet" });
  });

  it("does not link to a non-https address", () => {
    expect(roomLine("javascript:alert(1)")).toEqual({ kind: "note", text: "Room is not set up yet" });
  });
});

describe("tourStatusLabel", () => {
  it("labels each known status in plain words", () => {
    expect(tourStatusLabel("requested")).toBe("Waiting for your answer");
    expect(tourStatusLabel("accepted")).toBe("Accepted");
    expect(tourStatusLabel("declined")).toBe("Declined");
  });

  it("falls back for an unknown status", () => {
    expect(tourStatusLabel("something-new")).toBe("Unknown");
  });
});
