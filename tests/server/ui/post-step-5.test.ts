import { describe, expect, it } from "vitest";
import { POST_COPY_DEFAULTS, buildPostCopy } from "@/components/post/copy";
import { ABOUT_YOU_HELP, ABOUT_YOU_TITLE, newStepCopy, newSuccessCopy } from "@/components/post/newCopy";
import { errorsForStep, stepOfError, validateAbout } from "@/lib/ui/post-form";

const now = new Date("2026-11-16T10:00:00Z");

describe("About you checks (H7.86)", () => {
  it("asks nothing when the account already has a date of birth", () => {
    expect(validateAbout({ askDateOfBirth: false, dateOfBirth: "", ageConfirmed: false }, now)).toEqual({});
  });

  it("asks for the date and the 18+ tick the first time", () => {
    expect(validateAbout({ askDateOfBirth: true, dateOfBirth: "", ageConfirmed: false }, now)).toEqual({
      dob: "Enter your date of birth",
      ageConfirmed: "Tick this box to go on",
    });
  });

  it("refuses someone under 18 and a date that does not exist", () => {
    expect(validateAbout({ askDateOfBirth: true, dateOfBirth: "2010-11-17", ageConfirmed: true }, now).dob).toBe("You must be 18 or older to post an ad");
    expect(validateAbout({ askDateOfBirth: true, dateOfBirth: "2000-02-31", ageConfirmed: true }, now).dob).toBe("Enter a valid date");
  });

  it("passes someone who turned 18 today", () => {
    expect(validateAbout({ askDateOfBirth: true, dateOfBirth: "2008-11-16", ageConfirmed: true }, now)).toEqual({});
  });

  it("keeps the date and the tick on the contact step, and lets that step answer for the name and the city only when it is About you", () => {
    expect(stepOfError("dob")).toBe("contact");
    expect(stepOfError("ageConfirmed")).toBe("contact");
    const all = { nickname: "Name is required", city: "Pick a city", title: "Too short", dob: "Enter your date of birth", phone: "Use +91 and 10 digits" };
    expect(Object.keys(errorsForStep(all, "contact")).sort()).toEqual(["dob", "phone"]);
    expect(Object.keys(errorsForStep(all, "contact", true)).sort()).toEqual(["city", "dob", "nickname", "phone"]);
    expect(Object.keys(errorsForStep(all, "details", true)).sort()).toEqual(["city", "nickname", "title"]);
  });
});

describe("wording of steps 4 and 5 (H7.86)", () => {
  it("calls the contact step About you for a first-time account and Contact otherwise", () => {
    expect(newStepCopy("contact", POST_COPY_DEFAULTS, true)).toMatchObject({ title: ABOUT_YOU_TITLE, help: ABOUT_YOU_HELP });
    expect(newStepCopy("contact", POST_COPY_DEFAULTS, false).title).toBe("Contact");
  });

  it("keeps a contact title an admin wrote", () => {
    const copy = { ...POST_COPY_DEFAULTS, steps: { ...POST_COPY_DEFAULTS.steps, contact: { ...POST_COPY_DEFAULTS.steps.contact, title: "How to reach you" } } };
    expect(newStepCopy("contact", copy, true).title).toBe("How to reach you");
  });

  it("writes Publish ad in sentence case, and keeps a button label an admin wrote", () => {
    expect(newStepCopy("review", POST_COPY_DEFAULTS, false).nextLabel).toBe("Publish ad");
    const custom = buildPostCopy([{ id: "r", type: "postStep", visible: true, props: { stepKey: "review", nextLabel: "Go live" } } as never]);
    expect(newStepCopy("review", custom, false).nextLabel).toBe("Go live");
    expect(newStepCopy("review", POST_COPY_DEFAULTS, false).title).toBe("Check your ad");
  });

  it("leaves the other steps as they are", () => {
    expect(newStepCopy("photos", POST_COPY_DEFAULTS, false)).toEqual(POST_COPY_DEFAULTS.steps.photos);
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false)).toEqual(POST_COPY_DEFAULTS.steps.basics);
  });
});

describe("the success screen wording (H7.86)", () => {
  it("says live and offers View my ads and Post another ad", () => {
    const copy = newSuccessCopy(POST_COPY_DEFAULTS, true);
    expect(copy.title).toBe("Your ad is live");
    expect(copy.primary).toEqual({ label: "View my ads", href: "/u/account/ads/" });
    expect(copy.secondary.label).toBe("Post another ad");
  });

  it("says in review when the ad is not live yet", () => {
    expect(newSuccessCopy(POST_COPY_DEFAULTS, false).title).toBe("Your ad is in review");
  });

  it("keeps a button an admin wrote", () => {
    const copy = { ...POST_COPY_DEFAULTS, success: { ...POST_COPY_DEFAULTS.success, primaryCta: { label: "See my page", href: "/u/account/ads/" } } };
    expect(newSuccessCopy(copy, true).primary.label).toBe("See my page");
  });
});
