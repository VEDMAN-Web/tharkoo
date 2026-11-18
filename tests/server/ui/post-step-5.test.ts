import { describe, expect, it } from "vitest";
import { POST_COPY_DEFAULTS, buildPostCopy } from "@/components/post/copy";
import { ABOUT_YOU_HELP, ABOUT_YOU_TITLE, newStepCopy, newSuccessCopy } from "@/components/post/newCopy";
import { creditsText, insufficientFrom, rupeesText, shortfallOf } from "@/components/post/credits";
import { draftToForm, errorsForStep, maskEmail, stepOfError, telegramHandle, validateAbout, validateContact } from "@/lib/ui/post-form";

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
    expect(newStepCopy("review", POST_COPY_DEFAULTS, false).title).toBe("Review and publish");
  });

  it("leaves the other steps as they are", () => {
    expect(newStepCopy("photos", POST_COPY_DEFAULTS, false)).toEqual(POST_COPY_DEFAULTS.steps.photos);
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false)).toEqual(POST_COPY_DEFAULTS.steps.basics);
  });
});

describe("the success screen wording (H7.86)", () => {
  it("says live and offers only Post another ad (H14.2: no View my ads button)", () => {
    const copy = newSuccessCopy(POST_COPY_DEFAULTS, true);
    expect(copy.title).toBe("Your ad is live");
    expect(copy).not.toHaveProperty("primary");
    expect(copy.secondary.label).toBe("Post another ad");
  });

  it("says in review when the ad is not live yet", () => {
    expect(newSuccessCopy(POST_COPY_DEFAULTS, false).title).toBe("Your ad is in review");
  });

  it("no longer shows a first button, even when an admin wrote one", () => {
    const copy = { ...POST_COPY_DEFAULTS, success: { ...POST_COPY_DEFAULTS.success, primaryCta: { label: "See my page", href: "/u/account/ads/" } } };
    expect(newSuccessCopy(copy, true)).not.toHaveProperty("primary");
  });
});

const choices = { mode: "both", whatsappOn: false, whatsappSame: true, whatsappNumber: "", telegramOn: false, telegram: "" };

describe("contact choices (H7.86)", () => {
  it("accepts nothing wrong when WhatsApp and Telegram are off, or WhatsApp is the same as the phone", () => {
    expect(validateContact(choices)).toEqual({});
    expect(validateContact({ ...choices, whatsappOn: true })).toEqual({});
  });

  it("checks a different WhatsApp number as an Indian mobile number", () => {
    const other = { ...choices, whatsappOn: true, whatsappSame: false };
    expect(validateContact({ ...other, whatsappNumber: "" }).whatsapp).toBe("Use +91 and 10 digits");
    expect(validateContact({ ...other, whatsappNumber: "12345" }).whatsapp).toBe("Use +91 and 10 digits");
    expect(validateContact({ ...other, whatsappNumber: "5123456789" }).whatsapp).toBe("Use +91 and 10 digits");
    expect(validateContact({ ...other, whatsappNumber: "+91 91234 56780" })).toEqual({});
  });

  it("ignores WhatsApp when only email is chosen", () => {
    expect(validateContact({ ...choices, mode: "email", whatsappOn: true, whatsappSame: false, whatsappNumber: "1" })).toEqual({});
  });

  it("wants a Telegram username of 5 to 32 letters, digits or underscores, with or without the at sign", () => {
    const on = { ...choices, telegramOn: true };
    expect(validateContact({ ...on, telegram: "" }).telegram).toBe("Enter your Telegram username");
    expect(validateContact({ ...on, telegram: "ab" }).telegram).toBe("Use 5 to 32 letters, digits or underscores");
    expect(validateContact({ ...on, telegram: "bad name!" }).telegram).toBe("Use 5 to 32 letters, digits or underscores");
    expect(validateContact({ ...on, telegram: "a".repeat(33) }).telegram).toBe("Use 5 to 32 letters, digits or underscores");
    expect(validateContact({ ...on, telegram: "asha_walks" })).toEqual({});
    expect(validateContact({ ...on, telegram: "@Asha_99" })).toEqual({});
    expect(telegramHandle(" @asha_walks ")).toBe("asha_walks");
  });

  it("keeps the telegram and whatsapp errors on the contact step", () => {
    expect(errorsForStep({ telegram: "x", whatsapp: "y", title: "z" }, "contact")).toEqual({ telegram: "x", whatsapp: "y" });
  });

  it("masks the account email but keeps the first letter and the domain", () => {
    expect(maskEmail("asha.k@gmail.com")).toBe("a••••@gmail.com");
    expect(maskEmail("a@x.in")).toBe("a••••@x.in");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("no-at-sign")).toBe("");
  });

  it("reads the choice back from a saved draft", () => {
    expect(draftToForm({ contact: { phone: "+919876543210", acceptForm: true } }).contactMode).toBe("both");
    expect(draftToForm({ contact: { phone: "+919876543210" } }).contactMode).toBe("phone");
    expect(draftToForm({ contact: { acceptForm: true } }).contactMode).toBe("email");
    expect(draftToForm({}).contactMode).toBe("both");
    expect(draftToForm({ contact: { phone: "+919876543210", whatsapp: "+919123456780" } }).whatsappNumber).toBe("+919123456780");
  });
});

describe("paid posting helpers (H7.86)", () => {
  it("says credits in singular and plural, and the rupee price at 1 credit = Rs 10", () => {
    expect(creditsText(1)).toBe("1 credit");
    expect(creditsText(30)).toBe("30 credits");
    expect(rupeesText(30)).toBe("₹300");
    expect(rupeesText(100)).toBe("₹1,000");
  });

  it("works out how many credits are missing", () => {
    expect(shortfallOf(30, 12)).toBe(18);
    expect(shortfallOf(30, 45)).toBe(0);
    expect(shortfallOf(30, 30)).toBe(0);
    expect(shortfallOf(30, null)).toBe(0);
  });

  it("reads need and balance from an INSUFFICIENT_CREDITS error, and ignores other errors", () => {
    expect(insufficientFrom({ code: "INSUFFICIENT_CREDITS", details: { need: 30, balance: 12 } as never }, 30)).toEqual({ need: 30, balance: 12 });
    expect(insufficientFrom({ code: "INSUFFICIENT_CREDITS", details: { need: ["30"], balance: ["0"] } }, 30)).toEqual({ need: 30, balance: 0 });
    expect(insufficientFrom({ code: "INSUFFICIENT_CREDITS" }, 30)).toEqual({ need: 30, balance: 0 });
    expect(insufficientFrom({ code: "INSUFFICIENT_CREDITS", need: 30, balance: 12, fee: 30, short: 18 } as never, 30)).toEqual({ need: 30, balance: 12 });
    expect(insufficientFrom({ code: "VERIFICATION_REQUIRED" }, 30)).toBeNull();
    expect(insufficientFrom(undefined, 30)).toBeNull();
  });

  it("has no fee in the first step line when the fee is 0, so free posting shows nothing about credits", () => {
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false, false, 0).help).toBe("Pick a category. This helps the right people find your ad.");
  });

  it("puts the price in the first step line, and keeps a help line an admin wrote", () => {
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false, false, 30).help).toBe("Pick a category. Posting an ad costs 30 credits.");
    const custom = { ...POST_COPY_DEFAULTS, steps: { ...POST_COPY_DEFAULTS.steps, basics: { ...POST_COPY_DEFAULTS.steps.basics, help: "Choose wisely." } } };
    expect(newStepCopy("category", custom, false, false, 30).help).toBe("Choose wisely.");
  });
});
