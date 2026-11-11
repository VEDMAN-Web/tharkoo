import { describe, expect, it } from "vitest";
import { listingDateLabel } from "@/lib/format";
import { draftToForm, needsIdCheck, validatePost } from "@/lib/ui/post-form";

const fields = [
  { key: "age", label: "Age", required: true },
  { key: "looking-for", label: "Looking for", required: true },
];

const base = {
  categoryId: "cat",
  cityId: "city",
  nickname: "Asha",
  title: "Coffee in Gurgaon",
  text: "A short note about meeting for coffee this week.",
  phone: "+919876543210",
  contactMode: "phone",
  age: "28",
  ageRequired: true,
  terms: true,
  adult: true,
  attrs: { "looking-for": "Coffee" },
  fields,
};

describe("post form", () => {
  it("asks for an ID check before a publish request when review is not approved", () => {
    expect(needsIdCheck("unsubmitted")).toBe(true);
    expect(needsIdCheck("pending_review")).toBe(true);
    expect(needsIdCheck("approved")).toBe(false);
    expect(needsIdCheck("")).toBe(false);
  });

  it("requires the dating looking-for field and names it", () => {
    const missing = validatePost({ ...base, attrs: {} });
    expect(missing["looking-for"]).toMatch(/fill in this field/i);
    const filled = validatePost(base);
    expect(filled["looking-for"]).toBeUndefined();
  });

  it("restores a saved draft into the preview fields", () => {
    const form = draftToForm({
      title: "Coffee in Gurgaon",
      description: "A short note about meeting for coffee this week.",
      categoryId: "cat",
      cityId: "city",
      attributes: { age: 28, "looking-for": "Coffee", nickname: "Asha" },
      contact: { phone: "+919876543210" },
      mediaIds: ["photo-1"],
    });
    expect(form.title).toBe("Coffee in Gurgaon");
    expect(form.text.length).toBeGreaterThan(20);
    expect(form.lookingFor).toBe("Coffee");
    expect(form.photos).toEqual(["photo-1"]);
    expect(form.nickname).toBe("Asha");
  });

  it("formats a listing date in India time", () => {
    expect(listingDateLabel("2026-11-10T12:00:00.000Z")).toBe("10 NOVEMBER");
    expect(listingDateLabel("2026-11-10T20:30:00.000Z")).toBe("11 NOVEMBER");
    expect(listingDateLabel(new Date("2026-11-10T12:00:00.000Z"))).toBe("10 NOVEMBER");
  });
});
