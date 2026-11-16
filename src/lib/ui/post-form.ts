export type PostField = { key: string; label: string; required?: boolean };

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
  if (!input.categoryId) next.category = "Please, fill in this field";
  if (input.needsSubcategory && !input.subcategoryId) next.subcategory = "Please, fill in this field";
  if (!input.cityId) next.city = "Please, fill in this field";
  if (!input.nickname.trim()) next.nickname = "Name / Nickname is required";
  const alnum = (input.title.match(/[a-z0-9]/gi) || []).length;
  if (input.title.trim().length < 5 || alnum < 5) next.title = "You must enter at least 5 alphanumeric characters (a,b,c...z,0,1,2,3...)";
  if (input.text.trim().length < 20) next.text = "You must enter at least 20 characters";
  if (input.contactMode !== "email" && !input.phone.replace(/[\s-]/g, "")) next.phone = "If you want to be contacted by phone, please fill in this field";
  if (input.ageRequired && !input.age.trim()) next.age = "Please, fill in this field";
  else if (input.age && (Number(input.age) < 18 || Number(input.age) > 99)) next.age = "Invalid field";
  if (!input.terms) next.terms = "Please, fill in this field";
  if (!input.adult) next.adult = "Please, fill in this field";
  for (const field of input.fields) {
    if (!field.required || field.key === "age") continue;
    const answer = input.attrs[field.key];
    const empty = Array.isArray(answer) ? answer.length === 0 : textOf(answer).trim() === "";
    if (empty) next[field.key] = "Please, fill in this field";
  }
  return next;
}

export type SavedDraft = {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  attributes?: Record<string, unknown> | null;
  price?: number | null;
  nickname?: string | null;
  contact?: { phone?: string | null; whatsapp?: string | null; telegram?: string | null } | null;
  mediaIds?: string[] | null;
};

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
    telegram: row.contact?.telegram || "",
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
export type NewPostStep = (typeof NEW_POST_STEPS)[number];

/** The step a validation key belongs to. Any key not listed is a detail (title, text, city, a category field...). */
export function stepOfError(key: string): NewPostStep {
  if (key === "category" || key === "subcategory") return "category";
  if (key === "phone") return "contact";
  if (key === "terms" || key === "adult") return "review";
  return "details";
}

/** The errors one step is responsible for. Continue on a step checks only these, so a later step cannot block an earlier one. */
export function errorsForStep(errors: Record<string, string>, step: NewPostStep): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (stepOfError(key) === step) out[key] = message;
  }
  return out;
}
