import { isAtLeast18, parseDateOnly } from "@/server/shared/age";

export type PostField = { key: string; label: string; required?: boolean; /** Set for a field answered by picking chips: "one" for one pick, "many" for a list. */ pick?: "one" | "many" };

/** The words under a field that is not filled in. Short and friendly; the same on every step. */
export const FILL_THIS_IN = "Fill this in.";
export const AGE_WORDS = "Enter your age (18 or over).";

/** Chip answers: one value for a pick-one field, a list for a pick-many field. */
export type PostAttrs = Record<string, string | string[]>;

/** Most picks on a pick-many field when the admin set no limit. Matches the server default. */
export const DEFAULT_PICK_LIMIT = 20;

/** The picks in a chip answer, as a list. */
export function picksOf(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/** A text answer, or empty when the answer is a list. */
export function textOf(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/** The answers to send: empty text and empty picks are left out, so optional fields do not fail on "". */
export function cleanAttrs(attrs: PostAttrs): PostAttrs {
  return Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value.trim() !== "")),
  );
}

export type PostDraftInput = {
  categoryId: string;
  /** Needed only when the category has sub-categories. */
  subcategoryId?: string;
  needsSubcategory?: boolean;
  cityId: string;
  nickname: string;
  title: string;
  text: string;
  phone: string;
  contactMode: string;
  age: string;
  ageRequired?: boolean;
  terms: boolean;
  adult: boolean;
  attrs: PostAttrs;
  fields: PostField[];
};

export function validatePost(input: PostDraftInput) {
  const next: Record<string, string> = {};
  if (!input.categoryId) next.category = FILL_THIS_IN;
  if (input.needsSubcategory && !input.subcategoryId) next.subcategory = FILL_THIS_IN;
  if (!input.cityId) next.city = FILL_THIS_IN;
  if (!input.nickname.trim()) next.nickname = FILL_THIS_IN;
  const alnum = (input.title.match(/[a-z0-9]/gi) || []).length;
  if (input.title.trim().length < 5 || alnum < 5) next.title = "Write a title of at least 5 letters or numbers.";
  if (input.contactMode !== "email" && !input.phone.replace(/[\s-]/g, "")) next.phone = FILL_THIS_IN;
  if (input.ageRequired && !input.age.trim()) next.age = AGE_WORDS;
  else if (input.age && (Number(input.age) < 18 || Number(input.age) > 99)) next.age = AGE_WORDS;
  if (!input.terms) next.terms = FILL_THIS_IN;
  if (!input.adult) next.adult = FILL_THIS_IN;
  for (const field of input.fields) {
    if (!field.required || field.key === "age") continue;
    const answer = input.attrs[field.key];
    const empty = Array.isArray(answer) ? answer.length === 0 : textOf(answer).trim() === "";
    if (empty) next[field.key] = field.pick === "one" ? "Pick one." : field.pick === "many" ? "Pick at least one." : FILL_THIS_IN;
  }
  return next;
}

export type SavedDraft = {
  status?: string | null;
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  attributes?: Record<string, unknown> | null;
  price?: number | null;
  nickname?: string | null;
  contact?: { phone?: string | null; whatsapp?: string | null; telegram?: string | null; acceptForm?: boolean | null } | null;
  mediaIds?: string[] | null;
};

function contactModeOf(contact: SavedDraft["contact"]) {
  if (!contact) return "both";
  const phone = Boolean(contact.phone);
  if (contact.acceptForm) return phone ? "both" : "email";
  return phone ? "phone" : "both";
}

export function draftToForm(row: SavedDraft) {
  const attributes = row.attributes || {};
  const attrs: PostAttrs = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "age" || value === undefined || value === null) continue;
    attrs[key] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return {
    title: row.title || "",
    text: row.description || "",
    categoryId: row.categoryId || "",
    subcategoryId: row.subcategoryId || "",
    cityId: row.cityId || "",
    districtId: row.districtId || "",
    age: attributes.age === undefined || attributes.age === null ? "" : String(attributes.age),
    nickname: row.nickname || (typeof attributes.nickname === "string" ? attributes.nickname : ""),
    price: row.price === undefined || row.price === null ? "" : String(row.price),
    address: typeof attributes.address === "string" ? attributes.address : "",
    postal: typeof attributes.postal === "string" ? attributes.postal : "",
    area: typeof attributes.area === "string" ? attributes.area : "",
    phone: row.contact?.phone || "",
    whatsapp: Boolean(row.contact?.whatsapp),
    whatsappNumber: row.contact?.whatsapp || "",
    telegram: row.contact?.telegram || "",
    contactMode: contactModeOf(row.contact),
    lookingFor: textOf(attrs["looking-for"]),
    attrs,
    photos: row.mediaIds || [],
  };
}

export function needsIdCheck(status?: string | null) {
  return Boolean(status) && status !== "approved";
}

/**
 * H7.5: the five steps of the New design post-ad form, and which validation keys each one owns.
 * Category: category and sub-category. Details: city, title, text, nickname, age and the category's fields.
 * Photos have no form errors (the photo step checks its own uploads). Contact: phone. Review: the two consents.
 */
export const NEW_POST_STEPS = ["category", "details", "photos", "contact", "review"] as const;
export type NewPostStep = (typeof NEW_POST_STEPS)[number] | "more";

export function stepsFor(split: boolean): NewPostStep[] {
  return split ? ["category", "details", "more", "photos", "contact", "review"] : [...NEW_POST_STEPS];
}

export function urlStepOf(step: NewPostStep): string {
  return step === "more" ? "more" : String(NEW_POST_STEPS.indexOf(step) + 1);
}

export function stepFromUrl(raw: string): NewPostStep | null {
  if (raw === "more" || raw === "photos") return raw;
  const index = Number(raw);
  return Number.isInteger(index) && index >= 1 && index <= NEW_POST_STEPS.length ? NEW_POST_STEPS[index - 1] : null;
}

export type ExtraShape = { type: string; options: string[] };

export const LONG_LIST = 8;
const MORE_STEP_ABOVE = 118;
const CELL_ROW = 70;
const CHIP_BASE = 26;
const CHIP_ROW = 48;
const CHIPS_PER_ROW = 5;

export function isChipField(field: ExtraShape): boolean {
  if (!field.options.length) return false;
  if (field.type === "multiselect") return true;
  return field.type === "select" && field.options.length <= LONG_LIST;
}

export function needsMoreStep(extras: ExtraShape[]): boolean {
  const chips = extras.filter(isChipField);
  const cells = extras.length - chips.length;
  const height = Math.ceil(cells / 2) * CELL_ROW + chips.reduce((sum, field) => sum + CHIP_BASE + Math.ceil(field.options.length / CHIPS_PER_ROW) * CHIP_ROW, 0);
  return height > MORE_STEP_ABOVE;
}

/** The step a validation key belongs to. Any key not listed is a detail (title, text, city, a category field...). */
export function stepOfError(key: string): NewPostStep {
  if (key === "category" || key === "subcategory") return "category";
  if (key === "phone" || key === "whatsapp" || key === "telegram" || key === "dob" || key === "ageConfirmed") return "contact";
  if (key === "terms" || key === "adult") return "review";
  return "details";
}

const ABOUT_KEYS = ["nickname", "city"];

/** The errors one step is responsible for. Continue on a step checks only these, so a later step cannot block an earlier one. */
export function errorsForStep(errors: Record<string, string>, step: NewPostStep, about = false, moreKeys: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const owner: NewPostStep = moreKeys.includes(key) ? "more" : stepOfError(key);
    if (owner === step || (about && step === "contact" && ABOUT_KEYS.includes(key))) out[key] = message;
  }
  return out;
}

export type AboutInput = { askDateOfBirth: boolean; dateOfBirth: string; ageConfirmed: boolean };

export function validateAbout(input: AboutInput, now = new Date()): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input.askDateOfBirth) return out;
  const born = parseDateOnly(input.dateOfBirth);
  if (!input.dateOfBirth) out.dob = "Enter your date of birth";
  else if (!born) out.dob = "Enter a valid date";
  else if (!isAtLeast18(born, now)) out.dob = "You must be 18 or older to post an ad";
  if (!input.ageConfirmed) out.ageConfirmed = "Tick this box to go on";
  return out;
}

const TELEGRAM_PATTERN = /^[A-Za-z0-9_]{5,32}$/;

export function telegramHandle(raw: string) {
  return raw.trim().replace(/^@/, "");
}

export function isIndianMobile(raw: string) {
  return /^(91)?[6-9]\d{9}$/.test(raw.replace(/\D/g, ""));
}

export type ContactChoices = { mode: string; whatsappOn: boolean; whatsappSame: boolean; whatsappNumber: string; telegramOn: boolean; telegram: string };

export function validateContact(input: ContactChoices): Record<string, string> {
  const out: Record<string, string> = {};
  if (input.mode !== "email" && input.whatsappOn && !input.whatsappSame && !isIndianMobile(input.whatsappNumber)) {
    out.whatsapp = "Use +91 and 10 digits";
  }
  if (input.telegramOn) {
    const handle = telegramHandle(input.telegram);
    if (!handle) out.telegram = "Enter your Telegram username";
    else if (!TELEGRAM_PATTERN.test(handle)) out.telegram = "Use 5 to 32 letters, digits or underscores";
  }
  return out;
}

export function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1) return "";
  return `${email.slice(0, 1)}••••${email.slice(at)}`;
}
